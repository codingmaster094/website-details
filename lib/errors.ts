export class AnalysisError extends Error {
  constructor(
    public readonly code:
      | "INVALID_URL"
      | "WEBSITE_UNAVAILABLE"
      | "TIMEOUT"
      | "ACCESS_DENIED"
      | "NO_CONTENT"
      | "AI_ERROR"
      | "INVALID_AI_RESPONSE"
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
  "Gemini rate limit reached. Please wait a moment and try again, or review your Google AI Studio quota limits.";

export const GROQ_QUOTA_MESSAGE = GEMINI_QUOTA_MESSAGE;

export function isAiQuotaError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "RATE_LIMITED") return true;
  return /rate limit|429|Too Many Requests|quota|RESOURCE_EXHAUSTED/i.test(error.message || "");
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
