import { describe, expect, it } from "vitest";
import { normalizeQuizCount, normalizeQuizDifficulty, quizDifficultyInstruction } from "@/lib/ai/quiz-policy";

describe("quiz policy", () => {
  it("normalizes question counts to the allowed slider step and entitlement cap", () => {
    expect(normalizeQuizCount(37, false)).toBe(30);
    expect(normalizeQuizCount(37, true)).toBe(35);
    expect(normalizeQuizCount(49, true)).toBe(50);
    expect(normalizeQuizCount(2, false)).toBe(5);
  });

  it("makes hard materially more situational than medium", () => {
    expect(quizDifficultyInstruction("medium")).toContain("50-60% of questions should be light application");
    expect(quizDifficultyInstruction("medium")).toContain("Avoid long multi-step scenarios");
    expect(quizDifficultyInstruction("hard")).toContain("75-90% of questions MUST be application");
    expect(quizDifficultyInstruction("hard")).toContain("multi-step reasoning");
  });

  it("preserves Mixed as a first-class setup choice", () => {
    expect(normalizeQuizDifficulty("mixed")).toBe("mixed");
  });
});
