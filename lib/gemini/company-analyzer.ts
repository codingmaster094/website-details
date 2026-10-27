import { AnalysisError } from "@/lib/errors";
import type { CrawlResult } from "@/lib/crawler/website-crawler";
import { ownerFromJsonLd, ownerFromPageText, pickVerifiedOwner } from "@/lib/analysis/owner";
import { isContactPageUrl, pickCompanyEmail } from "@/lib/crawler/emails";
import { pickCompanyPhone } from "@/lib/crawler/phones";
import { generateGeminiText } from "@/lib/gemini/client";
import { OUTPUT_SCHEMA_INSTRUCTIONS, SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { companyAnalysisSchema, type CompanyAnalysis } from "@/lib/validation/company-schema";

function buildUserPrompt(crawl: CrawlResult, contentLimit: number): string {
  const pages = [...crawl.pages]
    .sort((a, b) => Number(isContactPageUrl(b.url)) - Number(isContactPageUrl(a.url)))
    .map((page) => ({
      url: page.url,
      title: page.title,
      description: page.description,
      headings: page.headings,
      emails: page.emails,
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
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Unable to parse JSON from AI response");
  }
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

  const cleanName = cleanCompanyName(homepage?.title, host);

  return {
    company: {
      name: cleanName,
      website: crawl.websiteUrl,
      description: homepage?.description || homepage?.content.slice(0, 280) || null,
      industry: null,
      address: null,
      phone: pickCompanyPhone(crawl.phones),
      email: pickCompanyEmail(
        crawl.emails,
        crawl.websiteUrl,
        crawl.pages.filter((page) => isContactPageUrl(page.url)).flatMap((page) => page.emails),
      ),
      owner: ownerFromJsonLd(crawl.jsonLd) || ownerFromPageText(crawl.pages.map((page) => page.content).join("\n")),
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

function cleanCompanyName(title: string | null | undefined, fallback: string): string {
  if (!title) return fallback;
  const parts = title.split(/[|\-–—:]/);
  const first = parts[0]?.trim();
  if (first && first.length >= 2 && first.length <= 50 && !/^(home|welcome|index|homepage)/i.test(first)) {
    return first;
  }
  return fallback;
}

export async function analyzeCompanyWithGemini(
  crawl: CrawlResult,
): Promise<CompanyAnalysis> {
  const userPayload = buildUserPrompt(crawl, 8000);
  const prompt = `${SYSTEM_PROMPT}\n\n${OUTPUT_SCHEMA_INSTRUCTIONS}\n\nWebsite research payload:\n${userPayload}`;

  try {
    const text = await generateGeminiText(prompt, {
      maxTokens: 6000,
      jsonMode: true,
    });

    if (text) {
      const parsed = extractJson(text);
      const validated = companyAnalysisSchema.safeParse(parsed);
      if (validated.success) {
        return mergeDeterministicSignals(validated.data, crawl);
      }
    }
  } catch (error) {
    if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") {
      throw error;
    }
    if (error instanceof AnalysisError && error.code === "RATE_LIMITED") {
      throw error;
    }
    // Fall back to crawl data if Gemini encounters non-fatal issue
    console.error("Gemini analysis error:", error);
  }

  return analysisFromCrawl(crawl);
}

// Backwards-compatibility alias
export const analyzeCompanyWithGroq = analyzeCompanyWithGemini;

function mergeDeterministicSignals(analysis: CompanyAnalysis, crawl: CrawlResult): CompanyAnalysis {
  const social = analysis.socialMedia.length > 0 ? analysis.socialMedia : crawl.socialLinks;
  const company = {
    ...analysis.company,
    website: analysis.company.website || crawl.websiteUrl,
    email: pickCompanyEmail(
      [...(analysis.company.email ? [analysis.company.email] : []), ...crawl.emails],
      crawl.websiteUrl,
      crawl.pages.filter((page) => isContactPageUrl(page.url)).flatMap((page) => page.emails),
    ),
    phone: pickCompanyPhone([analysis.company.phone, ...crawl.phones]),
    owner: pickVerifiedOwner(
      analysis,
      crawl.jsonLd,
      crawl.pages.map((page) => `${page.title}\n${page.headings.join(" ")}\n${page.content}`).join("\n"),
    ),
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
