import { describe, expect, it } from "vitest";
import { buildQuizPrompt } from "@/lib/quiz/prompt";

describe("quiz prompt rubric", () => {
  it("requires every Hard item to be a concrete two-to-four-sentence scenario", () => {
    const prompt = buildQuizPrompt({
      sourceText: "Calibration compares instrument response with a known reference standard.",
      fileName: "Lab notes",
      slots: [{ index: 0, difficulty: "hard", type: "multiple_choice" }],
    });

    expect(prompt.user).toMatch(/every hard question must be a realistic source-grounded application\/scenario case/i);
    expect(prompt.user).toMatch(/2-4 sentences/i);
    expect(prompt.user).toMatch(/combines at least two distinct source ideas/i);
  });
});
