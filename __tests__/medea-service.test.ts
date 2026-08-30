import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateText, providerGenerate } = vi.hoisted(() => ({ generateText: vi.fn(), providerGenerate: vi.fn() }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/provider", () => ({ ProviderAdapter: { generate: providerGenerate } }));

import { generateMedeaReply, shouldGroundWithGoogleSearch, solveSafeArithmetic } from "@/lib/ai/medea-service";

describe("Medea service", () => {
  beforeEach(() => {
    generateText.mockReset();
    providerGenerate.mockReset();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("uses the current Vercel AI Gateway model and returns the generated answer", async () => {
    generateText.mockResolvedValue({ text: "Earth is the third planet from the Sun." });
    const answer = await generateMedeaReply({ system: "Teach clearly", prompt: "What is Earth?", userId: "student-1" });
    expect(answer).toBe("Earth is the third planet from the Sun.");
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ model: "google/gemini-3.7-flash" }));
  });

  it("solves safe arithmetic locally so basic tutoring still works during provider outages", async () => {
    expect(solveSafeArithmetic("27-22")).toContain("5");
    const result = await generateMedeaReply({ system: "Teach clearly", prompt: "27-22", userId: "student-1" });
    expect(result).toContain("5");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("solves the latest raw question even when the generation prompt contains conversation context", async () => {
    generateText.mockImplementation(() => {
      throw new Error("AI Gateway requires customer verification");
    });
    expect(solveSafeArithmetic("1+1")).toContain("2");

    const result = await generateMedeaReply({
      system: "Teach clearly",
      prompt: "--- RECENT CONVERSATION ---\nMedea: Hello\nStudent: 1+1\n--- END CONVERSATION ---",
      question: "1+1",
      userId: "student-1",
    });

    expect(result).toContain("2");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("uses the direct Gemini provider for complex questions when its production credential is configured", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    providerGenerate.mockResolvedValue({
      text: "Relativity models gravity as curved spacetime.",
      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
    });

    const result = await generateMedeaReply({
      system: "Give a rigorous but clear answer",
      prompt: "Compare Newtonian gravity with general relativity.",
      question: "Compare Newtonian gravity with general relativity.",
      userId: "student-1",
    });

    expect(result).toContain("curved spacetime");
    expect(providerGenerate).toHaveBeenCalledWith(expect.objectContaining({ operation: "chat" }));
    expect(providerGenerate).not.toHaveBeenCalledWith(expect.objectContaining({ tools: expect.anything() }));
    expect(generateText).not.toHaveBeenCalled();
  });

  it("uses Google Search for current questions and retries plain Gemini if grounding is rate limited", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    providerGenerate
      .mockRejectedValueOnce(new Error("429 search quota exceeded"))
      .mockResolvedValueOnce({ text: "Here is the best available answer.", usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 } });

    const result = await generateMedeaReply({ system: "Be accurate", prompt: "What is the latest science news?", question: "What is the latest science news?", userId: "student-1" });

    expect(shouldGroundWithGoogleSearch("What is the latest science news?")).toBe(true);
    expect(result).toContain("best available answer");
    expect(providerGenerate).toHaveBeenNthCalledWith(1, expect.objectContaining({ tools: [{ type: "google_search" }] }));
    expect(providerGenerate).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ tools: expect.anything() }));
    expect(generateText).not.toHaveBeenCalled();
  });
});
