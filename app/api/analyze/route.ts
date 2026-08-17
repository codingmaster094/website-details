import { NextRequest, NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/crawler/website-crawler";
import { AnalysisError, errorResponse } from "@/lib/errors";
import { analyzeCompanyWithGemini } from "@/lib/gemini/company-analyzer";
import { rateLimit } from "@/lib/security/rate-limit";
import { normalizeWebsiteUrl } from "@/lib/security/url-validator";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    normalizeWebsiteUrl(url);

    const crawl = await crawlWebsite(url);
    const data = await analyzeCompanyWithGemini(crawl);

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
