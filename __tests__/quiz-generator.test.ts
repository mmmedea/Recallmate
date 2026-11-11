import { describe, expect, it, vi } from "vitest";
import { generateQuiz } from "@/lib/quiz/generator";

const source = "Calibration compares instrument response with a known reference standard in analytical testing.";

function slotPlanFromPrompt(user: string) {
  const match = user.match(/Requested slot plan: (\[[^\n]*\])/);
  if (!match) throw new Error("Quiz prompt did not contain a requested slot plan.");
  return JSON.parse(match[1]) as Array<{ slot: number }>;
}

describe("quiz generation", () => {
  it("returns identification prompts without returning their accepted answers or explanation", async () => {
    const generateJson = vi.fn().mockResolvedValue({
      summary: "Calibration uses a known reference.",
      questions: [{
        slot: 1,
        type: "identification",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        answer: "instrument response",
        acceptedAnswers: ["instrument response"],
        explanation: "Calibration compares instrument response with a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
    });

    const result = await generateQuiz({
      sourceText: source,
      fileName: "Lab.pdf",
      count: 1,
      difficulty: "easy",
      format: "identification",
      generateJson,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({ type: "identification", question: expect.any(String), answerId: expect.any(String) });
    expect(result.questions[0]).not.toHaveProperty("answer");
    expect(result.questions[0]).not.toHaveProperty("acceptedAnswers");
    expect(result.questions[0]).not.toHaveProperty("explanation");
    expect(result.protectedAnswers[0]).toMatchObject({ answer: "instrument response", acceptedAnswers: ["instrument response"] });
  });

  it("retries invalid model output and fails with retry copy below the 80 percent quality threshold", async () => {
    const generateJson = vi.fn().mockResolvedValue({ summary: "", questions: [] });

    await expect(generateQuiz({
      sourceText: source,
      fileName: "Lab.pdf",
      count: 5,
      difficulty: "easy",
      format: "multiple_choice",
      generateJson,
    })).rejects.toThrow("We couldn't generate a good quiz right now. Please try again in a moment.");
    expect(generateJson).toHaveBeenCalledTimes(3);
  });

  it("keeps large provider requests to batches of ten slots", async () => {
    const requests: string[] = [];
    const generateJson: NonNullable<Parameters<typeof generateQuiz>[0]["generateJson"]> = async <T>({ user }: { user: string }) => {
      requests.push(user);
      return { summary: "", questions: [] } as T;
    };

    await expect(generateQuiz({
      sourceText: source,
      fileName: "Lab.pdf",
      count: 12,
      difficulty: "easy",
      format: "identification",
      generateJson,
    })).rejects.toThrow("We couldn't generate a good quiz right now. Please try again in a moment.");

    expect(slotPlanFromPrompt(requests[0])).toHaveLength(10);
  });

  it("retries only the missing question slots after a partial valid response", async () => {
    const batchSource = "Calibration compares instrument response with a known reference standard. Recalibration corrects instrument drift before the next sample is processed.";
    const requests: string[] = [];
    const generateJson: NonNullable<Parameters<typeof generateQuiz>[0]["generateJson"]> = async <T>({ user }: { user: string }) => {
      requests.push(user);
      if (requests.length === 1) {
        return {
          summary: "Calibration and recalibration.",
          questions: [{
            slot: 1,
            type: "identification",
            difficulty: "easy",
            question: "What does calibration compare?",
            answer: "instrument response",
            acceptedAnswers: [],
            explanation: "Calibration compares the response against a standard.",
            sourceEvidence: "Calibration compares instrument response with a known reference standard.",
          }],
        } as T;
      }
      return {
        summary: "Recalibration corrects drift.",
        questions: [{
          slot: 2,
          type: "identification",
          difficulty: "easy",
          question: "What does recalibration correct before the next sample is processed?",
          answer: "instrument drift",
          acceptedAnswers: [],
          explanation: "Recalibration corrects instrument drift before processing another sample.",
          sourceEvidence: "Recalibration corrects instrument drift before the next sample is processed.",
        }],
      } as T;
    };

    const result = await generateQuiz({
      sourceText: batchSource,
      fileName: "Lab.pdf",
      count: 2,
      difficulty: "easy",
      format: "identification",
      generateJson,
    });

    expect(result.questions).toHaveLength(2);
    expect(requests).toHaveLength(2);
    expect(slotPlanFromPrompt(requests[1]).map(({ slot }) => slot)).toEqual([2]);
  });

  it("shuffles multiple-choice options without changing the correct answer", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const generateJson = vi.fn().mockResolvedValue({
      summary: "Calibration uses a reference.",
      questions: [{
        slot: 1,
        type: "multiple_choice",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        options: {
          A: "Instrument response",
          B: "Known reference standard",
          C: "Analytical testing",
          D: "Calibration procedure",
        },
        correctAnswer: "A",
        explanation: "Calibration compares the response against a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
    });

    try {
      const result = await generateQuiz({
        sourceText: source,
        fileName: "Lab.pdf",
        count: 1,
        difficulty: "easy",
        format: "multiple_choice",
        generateJson,
      });
      const question = result.questions[0];
      expect(question.options?.[question.correctAnswer!]).toBe("Instrument response");
      expect(question.correctAnswer).not.toBe("A");
    } finally {
      random.mockRestore();
    }
  });
});
