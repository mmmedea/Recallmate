/**
 * lib/ai-provider.ts
 *
 * Shared AI provider utility for RecallMate.
 *
 * Strategy:
 *   Primary  → Google Gemini 1.5 Flash (free tier: 1,500 req/day, 15 RPM)
 *   Fallback → Groq  Llama 3.1 70B     (free tier: ~14,400 req/day, 30 RPM)
 *
 * Both providers are cloud-hosted, always-on, and 100% free at these volumes.
 */

import OpenAI from "openai";

// Best free Groq model — excellent at structured JSON, math & science
export const GROQ_MODEL = "llama-3.1-70b-versatile";

/**
 * Lazy Groq client getter.
 * We MUST NOT instantiate the OpenAI SDK at module level because Next.js runs
 * module-level code during the build step (static page data collection), where
 * env vars like GROQ_API_KEY don't exist yet. Lazy initialization ensures the
 * client is only created at request time — when the key is actually available.
 */
function getGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// ── Gemini REST helper ────────────────────────────────────────────────────────
export function getGeminiKey(): string {
  return process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY || "";
}

export const GEMINI_MODEL = "gemini-1.5-flash";

/**
 * Call the Gemini REST API directly.
 * Returns the raw text from the first candidate.
 * Throws on HTTP error or empty response.
 */
export async function callGeminiRest(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string } = {}
): Promise<string> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 3000,
        ...(options.responseMimeType
          ? { responseMimeType: options.responseMimeType }
          : {}),
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

/**
 * Call Groq (Llama 3.1 70B) with a system + user message.
 * Forces JSON output mode.
 * Returns the raw content string from the first choice.
 */
export async function callGroqChat(
  systemPrompt: string,
  userContent: string,
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured.");

  const completion = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 3000,
    ...(options.jsonMode !== false
      ? { response_format: { type: "json_object" } }
      : {}),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const content = completion.choices[0]?.message?.content || "";
  if (!content) throw new Error("Groq returned an empty response.");
  return content;
}

/**
 * Generic automatic failover wrapper.
 * Tries `primary()` first; if it throws, logs a warning and tries `fallback()`.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  label = "AI"
): Promise<T> {
  try {
    return await primary();
  } catch (primaryErr: any) {
    console.warn(
      `[${label}] Primary provider failed (${primaryErr?.message || primaryErr}). Switching to fallback...`
    );
    return await fallback();
  }
}
