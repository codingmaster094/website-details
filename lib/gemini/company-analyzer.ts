import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisError, GEMINI_QUOTA_MESSAGE } from "@/lib/errors";
import type { CrawlResult } from "@/lib/crawler/website-crawler";
import { OUTPUT_SCHEMA_INSTRUCTIONS, SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { companyAnalysisSchema, type CompanyAnalysis } from "@/lib/validation/company-schema";

const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"];

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("CONFIG_ERROR", "GEMINI_API_KEY is not configured on the server.", 500);
  }
  return apiKey;
}

function normalizeModelName(value?: string | null) {
  const name = value?.trim().replace(/^["']|["']$/g, "") || DEFAULT_MODEL;
  if (/gemini-2\./i.test(name) || /2\.5-flash/i.test(name)) return DEFAULT_MODEL;
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
      maxOutputTokens: 4096,
    },
  });
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|Too Many Requests|quota|RESOURCE_EXHAUSTED/i.test(message);
}

function isUnavailableModel(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /404 Not Found|no longer available|not found/i.test(message);
}

function buildUserPrompt(crawl: CrawlResult, contentLimit: number): string {
  const pages = crawl.pages.map((page) => ({
    url: page.url,
    title: page.title,
    description: page.description,
    headings: page.headings,
    content: page.content.slice(0, contentLimit),
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

export function analysisFromCrawl(crawl: CrawlResult): CompanyAnalysis {
  const homepage = crawl.pages[0];
  const host = (() => {
    try {
      return new URL(crawl.websiteUrl).hostname.replace(/^www\./, "");
    } catch {
      return crawl.websiteUrl;
    }
  })();

  return {
    company: {
      name: homepage?.title || host,
      website: crawl.websiteUrl,
      description: homepage?.description || homepage?.content.slice(0, 280) || null,
      industry: null,
      address: null,
      phone: crawl.phones[0] || null,
      email: crawl.emails[0] || null,
      owner: null,
      foundedYear: null,
    },
    services: [],
    technologies: crawl.technologies.map((t) => ({
      name: t.name,
      category: t.category,
      evidence: t.evidence,
      sourceUrl: t.sourceUrl,
      confidence: t.confidence,
    })),
    serviceTechnologyMapping: [],
    team: [],
    socialMedia: crawl.socialLinks,
    importantPages: crawl.pages.map((page) => ({
      title: page.title || page.url,
      url: page.url,
      purpose: "Crawled page",
    })),
    summary: homepage?.content.slice(0, 500) || `Website crawled: ${crawl.websiteUrl}`,
    dataQuality: {
      overallConfidence: 0.35,
      limitations: ["AI enrichment was skipped or timed out; values below come from the public website crawl."],
    },
  };
}

export async function analyzeCompanyWithGemini(
  crawl: CrawlResult,
  options: { fast?: boolean } = {},
): Promise<CompanyAnalysis> {
  const userPayload = buildUserPrompt(crawl, options.fast ? 1500 : 5000);
  const prompt = `${SYSTEM_PROMPT}\n\n${OUTPUT_SCHEMA_INSTRUCTIONS}\n\nWebsite research payload:\n${userPayload}`;
  const models = options.fast
    ? [...new Set([normalizeModelName(process.env.GEMINI_MODEL), "gemini-3.5-flash-lite"])]
    : modelCandidates();
  const attempts = 1;

  let lastQuotaError: unknown;

  for (const modelName of models) {
    const model = getModel(modelName);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const text = result.response.text();
        if (!text) continue;
        const parsed = extractJson(text);
        const validated = companyAnalysisSchema.safeParse(parsed);
        if (!validated.success) continue;
        return mergeDeterministicSignals(validated.data, crawl);
      } catch (error) {
        if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
        if (isQuotaError(error)) {
          lastQuotaError = error;
          break;
        }
        if (isUnavailableModel(error)) break;
      }
    }
  }

  if (lastQuotaError && !options.fast) {
    throw new AnalysisError("RATE_LIMITED", GEMINI_QUOTA_MESSAGE, 429);
  }

  return analysisFromCrawl(crawl);
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
