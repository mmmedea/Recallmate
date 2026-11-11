import { describe, expect, it, vi } from "vitest";

describe("Reviewer AI provider configuration", () => {
  it("rejects Anthropic API keys accidentally pasted into the provider variable", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "sk-ant-redacted-test-key");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    await expect(import("@/lib/ai/config")).rejects.toThrow(
      "REVIEWER_AI_PROVIDER contains an Anthropic API key"
    );
  });

  it("supports Claude Sonnet 5 as the required Reviewer intelligence provider", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "anthropic");
    vi.stubEnv("REVIEWER_AI_MODEL", "claude-sonnet-5");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    const { ModelRegistry } = await import("@/lib/ai/config");

    expect(ModelRegistry.generate_reviewer.provider).toBe("anthropic");
    expect(ModelRegistry.generate_reviewer.model).toBe("claude-sonnet-5");
  });

  it("does not silently fall back to Gemini when Anthropic key is missing", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "");
    vi.stubEnv("REVIEWER_AI_MODEL", "");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    const { ModelRegistry, assertReviewerAIConfigured } = await import("@/lib/ai/config");

    expect(ModelRegistry.generate_reviewer.provider).toBe("anthropic");
    expect(ModelRegistry.generate_reviewer.model).toBe("claude-sonnet-5");
    expect(() => assertReviewerAIConfigured()).toThrow("No Anthropic API key is configured");
  });

  it("does not send Sonnet 5-incompatible sampling or manual-thinking parameters", async () => {
    const create = vi.fn(async () => ({
      content: [
        {
          type: "tool_use",
          name: "return_structured_reviewer",
          input: { ok: true },
        },
      ],
      usage: { input_tokens: 12, output_tokens: 6 },
    }));

    vi.resetModules();
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: vi.fn().mockImplementation(function AnthropicMock() {
        return {
        messages: { create },
        };
      }),
    }));
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "anthropic");
    vi.stubEnv("REVIEWER_AI_MODEL", "claude-sonnet-5");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    const { ProviderAdapter } = await import("@/lib/ai/provider");

    await ProviderAdapter.executeStructuredGeneration(
      "generate_reviewer",
      "System",
      "Prompt",
      {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      }
    );

    const calls = create.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const payload = calls[0]?.[0] ?? {};
    expect(payload.model).toBe("claude-sonnet-5");
    expect(payload.temperature).toBeUndefined();
    expect(payload.top_p).toBeUndefined();
    expect(payload.top_k).toBeUndefined();
    expect(payload.thinking).toBeUndefined();
    expect(payload.tools).toEqual([
      expect.objectContaining({
        name: "return_structured_reviewer",
        strict: true,
      }),
    ]);
  });

  it("fails over from a revoked Anthropic key to the next configured key", async () => {
    const createForKey: Record<string, ReturnType<typeof vi.fn>> = {
      revoked: vi.fn(async () => {
        const error: any = new Error("API key is invalid");
        error.status = 401;
        error.error = { type: "authentication_error" };
        throw error;
      }),
      working: vi.fn(async () => ({
        content: [
          {
            type: "tool_use",
            name: "return_structured_reviewer",
            input: { ok: true },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      })),
    };

    vi.resetModules();
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: vi.fn().mockImplementation(function AnthropicMock(options: { apiKey: string }) {
        return {
          messages: { create: createForKey[options.apiKey] },
        };
      }),
    }));
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_1", "revoked");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "working");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    vi.stubEnv("ANTHROPIC_API_KEY_4", "");
    vi.stubEnv("ANTHROPIC_API_KEY_5", "");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "anthropic");
    vi.stubEnv("REVIEWER_AI_MODEL", "claude-sonnet-5");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    const { ProviderAdapter } = await import("@/lib/ai/provider");

    const result = await ProviderAdapter.executeStructuredGeneration(
      "generate_reviewer",
      "System",
      "Prompt",
      {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      }
    );

    expect(result.metadata?.credentialSlot).toBe(2);
    expect(result.metadata?.credentialGroup).toBe("primary");
    expect(result.metadata?.credentialAttempts).toEqual([
      expect.objectContaining({ slot: 1, group: "primary", status: 401, category: "key" }),
    ]);
    expect(createForKey.revoked).toHaveBeenCalledTimes(1);
    expect(createForKey.working).toHaveBeenCalledTimes(1);
  });

  it("does not rotate to another Anthropic group when rate limited", async () => {
    const createForKey: Record<string, ReturnType<typeof vi.fn>> = {
      primary1: vi.fn(async () => {
        const error: any = new Error("organization rate limit reached");
        error.status = 429;
        error.error = { type: "rate_limit_error" };
        error.headers = { "retry-after": "90" };
        throw error;
      }),
      primary2: vi.fn(),
      primary3: vi.fn(),
      backup1: vi.fn(async () => ({
        content: [
          {
            type: "tool_use",
            name: "return_structured_reviewer",
            input: { ok: true },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      })),
    };

    vi.resetModules();
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: vi.fn().mockImplementation(function AnthropicMock(options: { apiKey: string }) {
        return {
          messages: { create: createForKey[options.apiKey] },
        };
      }),
    }));
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_1", "primary1");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "primary2");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "primary3");
    vi.stubEnv("ANTHROPIC_API_KEY_4", "backup1");
    vi.stubEnv("ANTHROPIC_API_KEY_5", "");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "anthropic");
    vi.stubEnv("REVIEWER_AI_MODEL", "claude-sonnet-5");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    const { ProviderAdapter } = await import("@/lib/ai/provider");

    await expect(
      ProviderAdapter.executeStructuredGeneration(
        "generate_reviewer",
        "System",
        "Prompt",
        {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        }
      )
    ).rejects.toThrow("backing off instead of rotating keys");

    expect(createForKey.primary1).toHaveBeenCalledTimes(1);
    expect(createForKey.primary2).not.toHaveBeenCalled();
    expect(createForKey.primary3).not.toHaveBeenCalled();
    expect(createForKey.backup1).not.toHaveBeenCalled();
  });

  it("uses the backup Anthropic group for billing or permission failures", async () => {
    const createForKey: Record<string, ReturnType<typeof vi.fn>> = {
      primary1: vi.fn(async () => {
        const error: any = new Error("billing information must be updated");
        error.status = 402;
        error.error = { type: "billing_error" };
        throw error;
      }),
      primary2: vi.fn(),
      backup1: vi.fn(async () => ({
        content: [
          {
            type: "tool_use",
            name: "return_structured_reviewer",
            input: { ok: true },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      })),
    };

    vi.resetModules();
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: vi.fn().mockImplementation(function AnthropicMock(options: { apiKey: string }) {
        return {
          messages: { create: createForKey[options.apiKey] },
        };
      }),
    }));
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_1", "primary1");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "primary2");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    vi.stubEnv("ANTHROPIC_API_KEY_4", "backup1");
    vi.stubEnv("ANTHROPIC_API_KEY_5", "");
    vi.stubEnv("REVIEWER_AI_PROVIDER", "anthropic");
    vi.stubEnv("REVIEWER_AI_MODEL", "claude-sonnet-5");
    vi.stubEnv("GEMINI_MODEL_CHAT", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_NOTES", "gemini-test");
    vi.stubEnv("GEMINI_MODEL_QUIZ", "gemini-test");

    const { ProviderAdapter } = await import("@/lib/ai/provider");

    const result = await ProviderAdapter.executeStructuredGeneration(
      "generate_reviewer",
      "System",
      "Prompt",
      {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      }
    );

    expect(result.metadata?.credentialSlot).toBe(4);
    expect(result.metadata?.credentialGroup).toBe("secondary");
    expect(result.metadata?.credentialAttempts).toEqual([
      expect.objectContaining({ slot: 1, group: "primary", status: 402, category: "group" }),
    ]);
    expect(createForKey.primary1).toHaveBeenCalledTimes(1);
    expect(createForKey.primary2).not.toHaveBeenCalled();
    expect(createForKey.backup1).toHaveBeenCalledTimes(1);
  });
});
