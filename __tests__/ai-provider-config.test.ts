import { describe, expect, it } from "vitest";
import { GEMINI_DEFAULT_MODEL, GEMINI_MODEL, resolveGeminiModel } from "@/lib/ai-provider";

describe("AI provider configuration", () => {
  it("does not default to the retired Gemini 1.5 Flash model", () => {
    expect(GEMINI_DEFAULT_MODEL).toBe("gemini-3.7-flash");
    expect(GEMINI_MODEL).not.toBe("gemini-1.5-flash");
  });

  it("ignores retired Gemini model overrides", () => {
    expect(resolveGeminiModel("gemini-1.5-flash")).toBe("gemini-3.7-flash");
    expect(resolveGeminiModel("gemini-2.0-flash")).toBe("gemini-3.7-flash");
    expect(resolveGeminiModel("gemini-3.6-flash")).toBe("gemini-3.6-flash");
  });
});
