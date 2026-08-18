export class AnalysisError extends Error {
  constructor(
    public readonly code:
      | "INVALID_URL"
      | "WEBSITE_UNAVAILABLE"
      | "TIMEOUT"
      | "ACCESS_DENIED"
      | "NO_CONTENT"
      | "GEMINI_ERROR"
      | "INVALID_GEMINI_RESPONSE"
      | "RATE_LIMITED"
      | "SSRF_BLOCKED"
      | "CONFIG_ERROR"
      | "INVALID_MAPS_URL"
      | "PLACES_ERROR",
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

export const CRAWLER_DENIED_MESSAGE = "The website denied access to this crawler.";

export const GEMINI_QUOTA_MESSAGE =
  "Gemini quota is exhausted. Wait for the daily reset, or enable billing in Google AI Studio.";

export function isGeminiQuotaError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "RATE_LIMITED") return true;
  return /quota is exhausted|429|Too Many Requests/i.test(error.message || "");
}

export function isCrawlerDenied(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "ACCESS_DENIED") return true;
  return (error.message || "").toLowerCase().includes("denied access to this crawler");
}

export function errorResponse(error: unknown) {
  if (error instanceof AnalysisError) {
    return {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return {
    success: false as const,
    error: {
      code: "WEBSITE_UNAVAILABLE" as const,
      message,
    },
  };
}
