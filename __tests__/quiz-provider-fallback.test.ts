import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let providerModule: typeof import("@/lib/ai/provider");

describe("structured quiz provider failover", () => {
  beforeAll(async () => {
    vi.stubEnv("AI_PROVIDER_QUIZ", "google");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-3.7-flash");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-chat-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-notes-test");
    vi.stubEnv("GEMINI_API_KEY", "test-google-key");
    vi.stubEnv("GEMINI_API_KEY_02", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    providerModule = await import("@/lib/ai/provider");
  });

  afterAll(() => vi.unstubAllEnvs());

  it("orders configured quiz providers and uses safe model defaults", () => {
    expect(providerModule.getQuizProviderCandidates("google")).toEqual([
      { provider: "google", model: "gemini-3.7-flash" },
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "anthropic", model: "claude-sonnet-5" },
    ]);
  });

  it("retries a transient primary-provider error before using the recovered primary", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(providerModule.ProviderAdapter, "generateStructuredForProvider")
      .mockRejectedValueOnce(new Error("This model is currently experiencing high demand. Please try again later."))
      .mockResolvedValueOnce({ data: { questions: ["recovered"] }, usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, thoughtsTokens: 0 } });

    try {
      const pending = providerModule.generateJson<{ questions: string[] }>({
        system: "system",
        user: "user",
        schema: { type: "OBJECT" },
      });
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toEqual({ questions: ["recovered"] });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.map((call) => call[1])).toEqual(["google", "google"]);
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("fails over only after the transient retry budget is exhausted", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(providerModule.ProviderAdapter, "generateStructuredForProvider")
      .mockRejectedValueOnce(Object.assign(new Error("high demand"), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error("high demand"), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error("high demand"), { status: 503 }))
      .mockResolvedValueOnce({ data: { questions: ["deepseek result"] }, usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, thoughtsTokens: 0 } });

    try {
      const pending = providerModule.generateJson<{ questions: string[] }>({
        system: "system",
        user: "user",
        schema: { type: "OBJECT" },
      });
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toEqual({ questions: ["deepseek result"] });
      expect(spy).toHaveBeenCalledTimes(4);
      expect(spy.mock.calls.map((call) => call[1])).toEqual([
        "google",
        "google",
        "google",
        "deepseek",
      ]);
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("tries the next configured provider when the primary structured request fails", async () => {
    const spy = vi.spyOn(providerModule.ProviderAdapter, "generateStructuredForProvider")
      .mockRejectedValueOnce(new Error("temporary primary outage"))
      .mockResolvedValueOnce({ data: { questions: ["safe"] }, usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, thoughtsTokens: 0 } });

    try {
      const result = await providerModule.generateJson<{ questions: string[] }>({
        system: "system",
        user: "user",
        schema: { type: "OBJECT" },
      });
      expect(result).toEqual({ questions: ["safe"] });
      expect(spy.mock.calls.slice(0, 2).map((call) => call[1])).toEqual(["google", "deepseek"]);
    } finally {
      spy.mockRestore();
    }
  });
});
