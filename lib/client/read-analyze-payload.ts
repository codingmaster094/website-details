type AnalyzeErrorPayload = {
  success: false;
  error: { code: string; message: string };
};

type AnalyzeOkPayload<T> = {
  success: true;
  data: T;
};

export type AnalyzePayload<T> = AnalyzeOkPayload<T> | AnalyzeErrorPayload;

const TIMEOUT_MESSAGE = "This website took too long to analyze. Skipped so the list can continue.";

export function messageFromFailedResponse(raw: string, status: number): string {
  if (
    status === 504 ||
    /FUNCTION_INVOCATION_TIMEOUT|An error occurred with your deployment|timed? ?out/i.test(raw)
  ) {
    return TIMEOUT_MESSAGE;
  }
  if (/Unexpected token|is not valid JSON/i.test(raw)) {
    return TIMEOUT_MESSAGE;
  }
  return "Server returned an invalid response. Skipped this website.";
}

export async function readAnalyzePayload<T>(response: Response): Promise<AnalyzePayload<T>> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as AnalyzePayload<T>;
  } catch {
    return {
      success: false,
      error: {
        code: "TIMEOUT",
        message: messageFromFailedResponse(raw, response.status),
      },
    };
  }
}

export function friendlyClientError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Analysis failed.";
  if (
    message.includes("is not valid JSON") ||
    message.includes("Unexpected token") ||
    error instanceof SyntaxError
  ) {
    return TIMEOUT_MESSAGE;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return TIMEOUT_MESSAGE;
  }
  return message;
}
