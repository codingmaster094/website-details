import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisError } from "@/lib/errors";
import type { CrawlResult } from "@/lib/crawler/website-crawler";
import { OUTPUT_SCHEMA_INSTRUCTIONS, SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { companyAnalysisSchema, type CompanyAnalysis } from "@/lib/validation/company-schema";

const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("CONFIG_ERROR", "GEMINI_API_KEY is not configured on the server.", 500);
  }
  return apiKey;
}

function normalizeModelName(value?: string | null) {
  const name = value?.trim().replace(/^["']|["']$/g, "");
  if (!name || name === "gemini-2.5-flash") return DEFAULT_MODEL;
  return name;
}

function modelCandidates() {
  return [...new Set([normalizeModelName(process.env.GEMINI_MODEL), ...FALLBACK_MODELS])];
}

function getModel(modelName: string) {
  const genAI = new GoogleGenerativeAI(getApiKey());
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|Too Many Requests|quota|RESOURCE_EXHAUSTED/i.test(message);
}

function buildUserPrompt(crawl: CrawlResult): string {
  const pages = crawl.pages.map((page) => ({
    url: page.url,
    title: page.title,
    description: page.description,
    headings: page.headings,
    content: page.content.slice(0, 8000),
    sourceUrl: page.sourceUrl,
  }));

  return JSON.stringify(
    {
      websiteUrl: crawl.websiteUrl,
      extractedEmails: crawl.emails,
      extractedPhones: crawl.phones,
      extractedSocial: crawl.socialLinks,
      jsonLd: crawl.jsonLd.slice(0, 20),
      detectedTechnologies: crawl.technologies,
      pages,
    },
    null,
    2,
  );
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

export async function analyzeCompanyWithGemini(crawl: CrawlResult): Promise<CompanyAnalysis> {
  const userPayload = buildUserPrompt(crawl);
  const prompt = `${SYSTEM_PROMPT}\n\n${OUTPUT_SCHEMA_INSTRUCTIONS}\n\nWebsite research payload:\n${userPayload}`;
  const models = modelCandidates();

  let lastError: unknown;
  let lastQuotaError: unknown;

  for (const modelName of models) {
    const model = getModel(modelName);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const text = result.response.text();
        if (!text) {
          throw new AnalysisError("GEMINI_ERROR", "Gemini returned an empty response.", 502);
        }
        const parsed = extractJson(text);
        const validated = companyAnalysisSchema.safeParse(parsed);
        if (!validated.success) {
          lastError = validated.error;
          continue;
        }
        return mergeDeterministicSignals(validated.data, crawl);
      } catch (error) {
        lastError = error;
        if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
        if (isQuotaError(error)) {
          lastQuotaError = error;
          break;
        }
      }
    }
  }

  if (lastQuotaError) {
    throw new AnalysisError(
      "RATE_LIMITED",
      "Gemini quota is exhausted. Wait for the daily reset, or enable billing in Google AI Studio.",
      429,
    );
  }

  throw new AnalysisError(
    "INVALID_GEMINI_RESPONSE",
    `Gemini response could not be validated. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
    502,
  );
}

function mergeDeterministicSignals(analysis: CompanyAnalysis, crawl: CrawlResult): CompanyAnalysis {
  const social = analysis.socialMedia.length > 0 ? analysis.socialMedia : crawl.socialLinks;
  const company = {
    ...analysis.company,
    website: analysis.company.website || crawl.websiteUrl,
    email: analysis.company.email || crawl.emails[0] || null,
    phone: analysis.company.phone || crawl.phones[0] || null,
  };

  const techNames = new Set(analysis.technologies.map((t) => t.name.toLowerCase()));
  const extraTech = crawl.technologies
    .filter((t) => !techNames.has(t.name.toLowerCase()))
    .map((t) => ({
      name: t.name,
      category: t.category,
      evidence: t.evidence,
      sourceUrl: t.sourceUrl,
      confidence: t.confidence,
    }));

  const importantPages =
    analysis.importantPages.length > 0
      ? analysis.importantPages
      : crawl.pages.map((page) => ({
          title: page.title,
          url: page.url,
          purpose: "Crawled internal page",
        }));

  return {
    ...analysis,
    company,
    socialMedia: social,
    technologies: [...analysis.technologies, ...extraTech],
    importantPages,
  };
}
