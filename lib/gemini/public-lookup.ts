import { z } from "zod";
import { pickCompanyPhone } from "@/lib/crawler/phones";
import { AnalysisError, GEMINI_QUOTA_MESSAGE } from "@/lib/errors";
import { generateGeminiText } from "@/lib/gemini/client";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

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

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|Too Many Requests|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(message);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Unable to parse JSON from lookup response");
  }
}

const LOOKUP_PROMPT = `Use Google Search to find verified public facts for this company.

Return JSON only in this exact format:
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
- ownerVerified must be true ONLY when a reliable source explicitly names that person as Founder, Co-Founder, Owner, CEO, President, or Managing Director.
- Reliable sources: official company website, official LinkedIn company profile/founder, Wikipedia, or reputable press.
- If no verified founder or CEO is confirmed, set owner to null and ownerVerified to false.
- Do NOT use a random employee, designer, or team member as owner.
- Do NOT guess or hallucinate. Unverified fields must be null.
- email and phone must only be genuine public contact details from official listings. Invalid or dummy strings must be null.
- services: list the actual commercial services the company provides.
- technologies: list technologies or platforms publicly associated with the company or their website.`;

export async function lookupPublicCompanyFacts(
  websiteUrl: string,
  companyName?: string | null,
): Promise<PublicCompanyFacts | null> {
  const prompt = `${LOOKUP_PROMPT}\n\nWebsite: ${websiteUrl}\nCompany name hint: ${companyName || "unknown"}`;
  let lastQuota: unknown;

  try {
    const text = await generateGeminiText(prompt, {
      maxTokens: 2048,
      googleSearch: true,
      timeoutMs: 8_000,
    });
    if (text) {
      const parsed = publicFactsSchema.safeParse(extractJson(text));
      if (parsed.success) {
        const facts = parsed.data;
        if (!facts.ownerVerified) facts.owner = null;
        return facts;
      }
    }
  } catch (error) {
    if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
    if (isQuotaError(error)) lastQuota = error;
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
