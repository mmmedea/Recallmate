import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock("ai", () => ({ generateText }));

import { generateMedeaReply, solveSafeArithmetic } from "@/lib/ai/medea-service";

describe("Medea service", () => {
  beforeEach(() => generateText.mockReset());

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
});
