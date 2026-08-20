import { NextRequest, NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/crawler/website-crawler";
import { AnalysisError, errorResponse } from "@/lib/errors";
import { analyzeCompanyWithGemini, analysisFromCrawl } from "@/lib/gemini/company-analyzer";
import { analysisFromPublicFacts, enrichAnalysisFromPublicWeb, lookupPublicCompanyFacts } from "@/lib/gemini/public-lookup";
import { rateLimit } from "@/lib/security/rate-limit";
import { normalizeWebsiteUrl } from "@/lib/security/url-validator";

export const runtime = "nodejs";
export const maxDuration = 60;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AnalysisError("TIMEOUT", message, 504));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function jsonAnalysis(data: unknown, crawledPages = 0, warnings: string[] = []) {
  return NextResponse.json({
    success: true,
    data,
    meta: { crawledPages, warnings },
  });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  try {
    normalizeWebsiteUrl(url);

    const started = Date.now();
    const crawl = await crawlWebsite(url, {
      maxPages: 5,
      fetchTimeoutMs: 8_000,
      maxRetries: 0,
      deadlineAt: started + 16_000,
    });

    const remaining = 54_000 - (Date.now() - started);
    let data;
    if (remaining < 4_000) {
      data = analysisFromCrawl(crawl);
    } else {
      try {
        data = await withTimeout(
          analyzeCompanyWithGemini(crawl),
          remaining,
          "Gemini analysis timed out for this website.",
        );
      } catch (error) {
        if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
        if (error instanceof AnalysisError && error.code === "RATE_LIMITED") throw error;
        data = analysisFromCrawl(crawl);
      }
    }

    const enrichBudget = Math.min(15_000, 54_000 - (Date.now() - started));
    if (enrichBudget > 6_000) {
      try {
        data = await withTimeout(
          enrichAnalysisFromPublicWeb(data, crawl.websiteUrl),
          enrichBudget,
          "Public lookup timed out.",
        );
      } catch (error) {
        if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
        if (error instanceof AnalysisError && error.code === "RATE_LIMITED") throw error;
      }
    }

    return jsonAnalysis(data, crawl.pages.length, crawl.warnings);
  } catch (error) {
    if (error instanceof AnalysisError && (error.code === "ACCESS_DENIED" || error.code === "NO_CONTENT")) {
      try {
        const facts = await withTimeout(
          lookupPublicCompanyFacts(normalizeWebsiteUrl(url)),
          20_000,
          "Public lookup timed out.",
        );
        return jsonAnalysis(
          analysisFromPublicFacts(
            normalizeWebsiteUrl(url),
            facts,
            error.code === "ACCESS_DENIED"
              ? "Website blocked the crawler; details filled from public sources."
              : "Website had no readable content; details filled from public sources.",
          ),
          0,
          [error.message],
        );
      } catch (lookupError) {
        if (lookupError instanceof AnalysisError && lookupError.code === "CONFIG_ERROR") throw lookupError;
        if (lookupError instanceof AnalysisError && lookupError.code === "RATE_LIMITED") {
          const payload = errorResponse(lookupError);
          return NextResponse.json(payload, { status: lookupError.status });
        }
        return jsonAnalysis(
          analysisFromPublicFacts(normalizeWebsiteUrl(url), null, error.message),
          0,
          [error.message],
        );
      }
    }
    const payload = errorResponse(error);
    const status = error instanceof AnalysisError ? error.status : 500;
    return NextResponse.json(payload, { status });
  }
}
