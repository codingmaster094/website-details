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
  const t0 = Date.now();
  console.log(`[API] Analyze request started at ${new Date().toISOString()}`);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    console.log(`[API] Rate limited`);
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
  console.log(`[API] Target URL: ${url}`);

  try {
    normalizeWebsiteUrl(url);

    const started = Date.now();
    console.log(`[API] Starting crawlWebsite...`);
    const crawl = await crawlWebsite(url, {
      maxPages: 5,
      fetchTimeoutMs: 5_000,
      maxRetries: 0,
      deadlineAt: started + 8_000,
    });
    console.log(`[API] Crawl finished in ${Date.now() - started}ms, pages: ${crawl.pages.length}`);

    const remaining = 25_000 - (Date.now() - started);
    let data;
    if (remaining < 3_000) {
      console.log(`[API] Remaining budget low (${remaining}ms), using crawl data directly`);
      data = analysisFromCrawl(crawl);
    } else {
      try {
        console.log(`[API] Starting Gemini analysis with budget ${remaining}ms...`);
        data = await withTimeout(
          analyzeCompanyWithGemini(crawl),
          remaining,
          "Gemini analysis timed out for this website.",
        );
        console.log(`[API] Gemini analysis finished in ${Date.now() - started}ms`);
      } catch (error) {
        console.error(`[API] Gemini analysis non-fatal error:`, error instanceof Error ? error.message : error);
        if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
        // Graceful fallback to verified crawl data so the user always gets their result!
        data = analysisFromCrawl(crawl);
      }
    }

    const enrichBudget = Math.min(8_000, 30_000 - (Date.now() - started));
    if (enrichBudget > 4_000) {
      try {
        console.log(`[API] Starting public web enrichment with budget ${enrichBudget}ms...`);
        data = await withTimeout(
          enrichAnalysisFromPublicWeb(data, crawl.websiteUrl),
          enrichBudget,
          "Public lookup timed out.",
        );
        console.log(`[API] Public web enrichment finished in ${Date.now() - started}ms`);
      } catch (error) {
        console.error(`[API] Public enrichment non-fatal error:`, error instanceof Error ? error.message : error);
        if (error instanceof AnalysisError && error.code === "CONFIG_ERROR") throw error;
      }
    }

    console.log(`[API] Completed successfully in ${Date.now() - t0}ms`);
    return jsonAnalysis(data, crawl.pages.length, crawl.warnings);
  } catch (error) {
    console.error(`[API] Request failed in ${Date.now() - t0}ms with error:`, error);
    if (error instanceof AnalysisError && (error.code === "ACCESS_DENIED" || error.code === "NO_CONTENT")) {
      try {
        console.log(`[API] Attempting fallback public lookup...`);
        const facts = await withTimeout(
          lookupPublicCompanyFacts(normalizeWebsiteUrl(url)),
          10_000,
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
