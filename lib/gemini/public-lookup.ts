import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { pickCompanyPhone } from "@/lib/crawler/phones";
import { AnalysisError, GEMINI_QUOTA_MESSAGE } from "@/lib/errors";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

const publicFactsSchema = z.object({
  name: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  ownerVerified: z.boolean().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  services: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
});

export type PublicCompanyFacts = z.infer<typeof publicFactsSchema>;

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("CONFIG_ERROR", "GEMINI_API_KEY is not configured on the server.", 500);
  }
  return apiKey;
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|Too Many Requests|quota|RESOURCE_EXHAUSTED/i.test(message);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

const LOOKUP_PROMPT = `Use Google Search on public sources for this company.

Return JSON only:
{
  "name": null,
  "owner": null,
  "ownerVerified": false,
  "email": null,
  "phone": null,
  "services": [],
  "technologies": []
}

Rules:
- ownerVerified must be true only when a reliable source names that person as Founder, Co-Founder, Owner, CEO, Director, Managing Director, or equivalent.
- Reliable sources: official company website, LinkedIn company/founder profile, news, or the person publicly stating they founded the company.
- If the official website does not name a founder and other sources are weak or conflicting, set owner to null and ownerVerified to false.
- Do not use a random employee, designer, or team member as owner.
- Do not guess. Unverified names must be null.
- email and phone only from public contact listings, not invented. Invalid or junk digit strings must be null.
- services and technologies only if publicly listed.`;

export async function lookupPublicCompanyFacts(
  websiteUrl: string,
  companyName?: string | null,
): Promise<PublicCompanyFacts | null> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const prompt = `${LOOKUP_PROMPT}\n\nWebsite: ${websiteUrl}\nCompany name hint: ${companyName || "unknown"}`;
  let lastQuota: unknown;

  for (const modelName of [...new Set([process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL, ...FALLBACK_MODELS])]) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ googleSearchRetrieval: {} }] as never,
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text) continue;
      const parsed = publicFactsSchema.safeParse(extractJson(text));
      if (!parsed.success) continue;
      const facts = parsed.data;
      if (!facts.ownerVerified) facts.owner = null;
      return facts;
    } catch (error) {
      if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
      if (isQuotaError(error)) {
        lastQuota = error;
        break;
      }
    }
  }

  if (lastQuota) {
    throw new AnalysisError("RATE_LIMITED", GEMINI_QUOTA_MESSAGE, 429);
  }
  return null;
}

function hostName(websiteUrl: string): string {
  try {
    return new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl;
  }
}

export function analysisFromPublicFacts(
  websiteUrl: string,
  facts: PublicCompanyFacts | null,
  limitation: string,
): CompanyAnalysis {
  const services = (facts?.services ?? []).filter(Boolean).map((name) => ({
    name,
    description: name,
    evidence: "Public web sources",
    sourceUrl: websiteUrl,
    confidence: 0.55,
  }));
  const technologies = (facts?.technologies ?? []).filter(Boolean).map((name) => ({
    name,
    category: "Detected",
    evidence: "Public web sources",
    sourceUrl: websiteUrl,
    confidence: 0.5,
  }));

  return {
    company: {
      name: facts?.name || hostName(websiteUrl),
      website: websiteUrl,
      description: null,
      industry: null,
      address: null,
      phone: pickCompanyPhone([facts?.phone ?? null]),
      email: facts?.email ?? null,
      owner: facts?.ownerVerified ? facts.owner ?? null : null,
      foundedYear: null,
    },
    services,
    technologies,
    serviceTechnologyMapping: [],
    team: [],
    socialMedia: [],
    importantPages: [],
    summary: limitation,
    dataQuality: {
      overallConfidence: facts ? 0.5 : 0.2,
      limitations: [limitation],
    },
  };
}

export async function enrichAnalysisFromPublicWeb(
  analysis: CompanyAnalysis,
  websiteUrl: string,
): Promise<CompanyAnalysis> {
  const needsOwner = !analysis.company.owner;
  const needsEmail = !analysis.company.email;
  const needsServices = analysis.services.length === 0;
  if (!needsOwner && !needsEmail && !needsServices) return analysis;

  const facts = await lookupPublicCompanyFacts(websiteUrl, analysis.company.name);
  if (!facts) return analysis;

  const services =
    analysis.services.length > 0
      ? analysis.services
      : (facts.services ?? []).filter(Boolean).map((name) => ({
          name,
          description: name,
          evidence: "Public web sources",
          sourceUrl: websiteUrl,
          confidence: 0.55,
        }));

  const extraTech = (facts.technologies ?? [])
    .filter((name) => name && !analysis.technologies.some((tech) => tech.name.toLowerCase() === name.toLowerCase()))
    .map((name) => ({
      name,
      category: "Detected",
      evidence: "Public web sources",
      sourceUrl: websiteUrl,
      confidence: 0.5,
    }));

  return {
    ...analysis,
    company: {
      ...analysis.company,
      owner: analysis.company.owner || (facts.ownerVerified ? facts.owner ?? null : null),
      email: analysis.company.email || facts.email || null,
      phone: pickCompanyPhone([analysis.company.phone, facts.phone]),
      name: analysis.company.name || facts.name || null,
    },
    services,
    technologies: [...analysis.technologies, ...extraTech],
  };
}
