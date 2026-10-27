import { AnalysisError, GEMINI_QUOTA_MESSAGE } from "@/lib/errors";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const FALLBACK_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
];

export type GeminiOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  googleSearch?: boolean;
  timeoutMs?: number;
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

let cachedValidModels: string[] | null = null;

export function getGeminiApiKey(): string {
  let key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!key || !key.trim()) {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (groqKey && !groqKey.startsWith("gsk_")) {
      key = groqKey;
    }
  }

  if (!key || !key.trim()) {
    throw new AnalysisError(
      "CONFIG_ERROR",
      "GEMINI_API_KEY is not configured on the server. Please add your Google Gemini API key to .env.local (e.g. GEMINI_API_KEY=AIzaSy...)",
      500,
    );
  }
  return key.trim();
}

export function isGeminiQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|Too Many Requests|quota|RESOURCE_EXHAUSTED|RATE_LIMIT/i.test(message);
}

export function isGeminiModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /404|NOT_FOUND|not found|not supported|is not found|no longer available/i.test(message);
}

async function discoverSupportedModels(apiKey: string): Promise<string[]> {
  if (cachedValidModels && cachedValidModels.length > 0) return cachedValidModels;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const generateModels = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter(
        (name) =>
          !name.includes("tts") &&
          !name.includes("image") &&
          !name.includes("transcribe") &&
          !name.includes("computer-use") &&
          !name.includes("robotics") &&
          (name.includes("flash") || name.includes("pro")),
      )
      .sort((a, b) => {
        // Prefer flash-lite and flash-latest
        if (a.includes("flash-lite") && !b.includes("flash-lite")) return -1;
        if (!a.includes("flash-lite") && b.includes("flash-lite")) return 1;
        if (a.includes("flash-latest") && !b.includes("flash-latest")) return -1;
        if (!a.includes("flash-latest") && b.includes("flash-latest")) return 1;
        return 0;
      });

    console.log("[Gemini] Supported text models for this key:", generateModels);
    if (generateModels.length > 0) {
      cachedValidModels = generateModels;
      return generateModels;
    }
  } catch (err) {
    console.warn("[Gemini] Could not list models:", err instanceof Error ? err.message : err);
  }
  return [];
}

export async function generateGeminiText(
  prompt: string,
  options: GeminiOptions = {},
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const available = await discoverSupportedModels(apiKey);

  const preferredModel = options.model?.trim() || process.env.GEMINI_MODEL?.trim();
  const candidateModels = [
    ...(preferredModel ? [preferredModel] : []),
    ...available,
    ...FALLBACK_GEMINI_MODELS,
  ];
  const uniqueModels = [...new Set(candidateModels)];

  let lastQuotaError: unknown = null;
  let lastError: unknown = null;

  for (const model of uniqueModels) {
    try {
      return await callGeminiApi(model, prompt, apiKey, options);
    } catch (err) {
      if (err instanceof AnalysisError && err.code === "CONFIG_ERROR") {
        throw err;
      }
      if (isGeminiQuotaError(err)) {
        lastQuotaError = err;
        continue; // Try flash-lite or alternative model before failing!
      }
      lastError = err;
      console.warn(`[Gemini] Model ${model} failed, trying next candidate:`, err instanceof Error ? err.message : err);
    }
  }

  if (lastQuotaError) {
    throw new AnalysisError("RATE_LIMITED", GEMINI_QUOTA_MESSAGE, 429);
  }

  const errorMsg =
    lastError instanceof Error ? lastError.message : String(lastError || "Unknown Gemini API error");
  throw new AnalysisError("AI_ERROR", `Google Gemini API failed: ${errorMsg}`, 502);
}

async function callGeminiApi(
  model: string,
  prompt: string,
  apiKey: string,
  options: GeminiOptions,
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const useSearch = Boolean(options.googleSearch);
  const useJson = options.jsonMode !== false && !useSearch;

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens ?? 8192,
      ...(useJson ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (useSearch) {
    requestBody.tools = [{ googleSearch: {} }];
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new Error(`Gemini API call timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json().catch(() => null)) as GeminiApiResponse | null;

  if (!response.ok) {
    const errorDetail = data?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    const status = data?.error?.status || "";

    if (response.status === 401 || response.status === 403 || status === "PERMISSION_DENIED") {
      throw new AnalysisError(
        "CONFIG_ERROR",
        `Google Gemini rejected the API key: ${errorDetail}. Please check your GEMINI_API_KEY in .env.local.`,
        500,
      );
    }

    if (
      response.status === 429 ||
      response.status === 503 ||
      status === "RESOURCE_EXHAUSTED" ||
      /quota|rate.?limit|high demand/i.test(errorDetail)
    ) {
      throw new AnalysisError("RATE_LIMITED", GEMINI_QUOTA_MESSAGE, 429);
    }

    if (response.status === 404 || status === "NOT_FOUND" || /not found|no longer available/i.test(errorDetail)) {
      throw new Error(`Model ${model} not found: ${errorDetail}`);
    }

    throw new Error(`${response.status}: ${errorDetail}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const content = parts?.map((p) => p.text || "").join("") || "";

  return content;
}
