import { NextRequest, NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/crawler/website-crawler";
import { AnalysisError, errorResponse } from "@/lib/errors";
import { analyzeCompanyWithGemini } from "@/lib/gemini/company-analyzer";
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

  try {
    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url : "";
    const fast = body?.fast === true;
    normalizeWebsiteUrl(url);

    const started = Date.now();
    const crawl = await crawlWebsite(url, {
      maxPages: fast ? 1 : 4,
      fetchTimeoutMs: fast ? 5_000 : 8_000,
      maxRetries: 0,
      deadlineAt: started + (fast ? 12_000 : 22_000),
    });

    const remaining = 40_000 - (Date.now() - started);
    if (remaining < 4_000) {
      throw new AnalysisError("TIMEOUT", "This website took too long to analyze.", 504);
    }

    const data = await withTimeout(
      analyzeCompanyWithGemini(crawl, { fast }),
      remaining,
      "Gemini analysis timed out for this website.",
    );

    return NextResponse.json({
      success: true,
      data,
      meta: {
        crawledPages: crawl.pages.length,
        warnings: crawl.warnings,
      },
    });
  } catch (error) {
    const payload = errorResponse(error);
    const status = error instanceof AnalysisError ? error.status : 500;
    return NextResponse.json(payload, { status });
  }
}
