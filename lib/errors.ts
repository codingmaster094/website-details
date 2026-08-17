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
      | "CONFIG_ERROR",
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
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
