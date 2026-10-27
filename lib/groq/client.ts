import { AnalysisError } from "@/lib/errors";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

type GroqOptions = {
  model?: string;
  maxTokens?: number;
  browserSearch?: boolean;
};

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

export async function generateGroqText(prompt: string, options: GroqOptions = {}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("CONFIG_ERROR", "GROQ_API_KEY is not configured on the server.", 500);
  }

  // browserSearch and response_format:json_object are mutually exclusive in Groq API.
  // When using browserSearch, we send as plain text and parse JSON from the response ourselves.
  const useBrowserSearch = !!options.browserSearch;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: options.maxTokens || 4096,
      // Only set json_object when NOT using browser_search — they conflict on Groq
      ...(!useBrowserSearch ? { response_format: { type: "json_object" } } : {}),
      ...(useBrowserSearch ? { tools: [{ type: "browser_search" }], tool_choice: "auto" } : {}),
    }),
  });

  const result = (await response.json().catch(() => null)) as GroqResponse | null;
  if (!response.ok) {
    const message = result?.error?.message || `Groq API request failed with status ${response.status}.`;
    if (response.status === 401 || response.status === 403) {
      throw new AnalysisError("CONFIG_ERROR", "Groq rejected the API key. Check GROQ_API_KEY.", 500);
    }
    throw new Error(`${response.status}: ${message}`);
  }

  return result?.choices?.[0]?.message?.content || "";
}