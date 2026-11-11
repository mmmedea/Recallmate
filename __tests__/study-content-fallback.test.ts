import { describe, expect, it } from "vitest";
import { buildStudyContentFallback } from "@/lib/ai/study-content-fallback";

const definitionSource = `
Colorimetry is the measurement of color intensity used to estimate the concentration of a substance.
Spectrophotometry is the measurement of how much light a sample absorbs at selected wavelengths.
Calibration is the process of comparing instrument response with a known reference standard.
Quality control is the process used to verify that analytical results remain reliable over time.
`;

const sourceWithLoadingArtifact = `
Loading...
${definitionSource}
`;

describe("study content fallback", () => {
  it("creates validated Easy fallback questions from four source definitions", () => {
    const result = buildStudyContentFallback(definitionSource, "Instrumentation.pdf", "easy", 10);

    expect(result.fileName).toBe("Instrumentation.pdf");
    expect(result.difficulty).toBe("easy");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.length).toBeLessThanOrEqual(10);
    expect(result.quizEngine.requestedCount).toBe(10);
    expect(result.questions[0].options.A).toBe("Colorimetry");
    expect(result.questions[0].correctAnswer).toBe("A");
    expect(result.questions[0].sourceCitation).toBeTruthy();
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.availability).toBe("limited_fallback");
  });

  it("does not silently downgrade Medium requests to Easy fallback questions", () => {
    const result = buildStudyContentFallback(definitionSource, "Instrumentation.pdf", "medium", 10);

    expect(result.difficulty).toBe("medium");
    expect(result.questions).toEqual([]);
    expect(result.quizEngine.requestedCount).toBe(10);
    expect(result.availability).toBe("generation_unavailable");
    expect(result.notice).toMatch(/no local questions passed the medium quality requirements/i);
  });

  it("normalizes unsupported difficulty to Easy and removes loading artifacts", () => {
    const result = buildStudyContentFallback(sourceWithLoadingArtifact, "Instrumentation.pdf", "expert", 5);

    expect(result.difficulty).toBe("easy");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.length).toBeLessThanOrEqual(5);

    for (const question of result.questions) {
      expect(question.question).not.toMatch(/Loading/i);
      expect(question.sourceCitation).not.toMatch(/Loading/i);

      for (const option of Object.values(question.options)) {
        expect(option).not.toMatch(/Loading/i);
      }
    }
  });

  it("keeps every generated correct answer present in the options", () => {
    const result = buildStudyContentFallback(definitionSource, "Instrumentation.pdf", "easy", 8);

    expect(result.questions.length).toBeGreaterThan(0);

    for (const question of result.questions) {
      expect(Object.keys(question.options)).toContain(question.correctAnswer);
      expect(Object.values(question.options)).toContain(question.options[question.correctAnswer]);
      expect(new Set(Object.values(question.options)).size).toBeGreaterThan(1);
    }
  });

  it("does not manufacture Hard fallback scenarios locally", () => {
    const result = buildStudyContentFallback(definitionSource, "Instrumentation.pdf", "hard", 8);

    expect(result.difficulty).toBe("hard");
    expect(result.questions).toEqual([]);
    expect(result.availability).toBe("generation_unavailable");
  });
});
