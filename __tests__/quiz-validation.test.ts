import { describe, expect, it } from "vitest";
import { planQuiz } from "@/lib/quiz/planner";
import { validateQuizDrafts } from "@/lib/quiz/validation";

const source = "Calibration compares instrument response with a known reference standard in analytical testing.";

describe("generated quiz validation", () => {
  it("accepts source-grounded identification questions while rejecting reviewer metadata", () => {
    const slots = planQuiz(2, "easy", "identification");
    const result = validateQuizDrafts({
      slots,
      sourceText: source,
      drafts: [
        {
          slot: 1,
          type: "identification",
          difficulty: "easy",
          question: "What does calibration compare in analytical testing?",
          answer: "instrument response",
          acceptedAnswers: ["instrument response"],
          explanation: "Calibration compares this response with a reference.",
          sourceEvidence: "Calibration compares instrument response with a known reference standard",
        },
        {
          slot: 2,
          type: "identification",
          difficulty: "easy",
          question: "What is the purpose of this reviewer?",
          answer: "instrument response",
          acceptedAnswers: ["instrument response"],
          explanation: "This is reviewer metadata.",
          sourceEvidence: "Calibration compares instrument response with a known reference standard",
        },
      ],
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({ type: "identification", answer: "instrument response" });
    expect(result.rejectedCount).toBe(1);
  });

  it("rejects unsupported answer variants and evidence not present in the source", () => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "easy", "identification"),
      sourceText: source,
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "easy",
        question: "Which reference is used during calibration?",
        answer: "blue wavelength",
        acceptedAnswers: ["blue wavelength"],
        explanation: "Not supported by the source.",
        sourceEvidence: "Calibration requires a different wavelength",
      }],
    });

    expect(result.questions).toHaveLength(0);
    expect(result.rejectedCount).toBe(1);
  });

  it.each([
    [
      "a one-line analysis question",
      "Why is calibration performed?",
    ],
    [
      "a five-sentence case",
      "A clinical case describes a sample. The instrument drifts beyond range. The analyst records the result. The sample is rechecked. The report is released.",
    ],
  ])("rejects a Hard %s instead of accepting it as a scenario", (_description, question) => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "hard", "identification"),
      sourceText: "Calibration compares instrument response with a known reference standard in analytical testing.",
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "hard",
        question,
        answer: "instrument response",
        acceptedAnswers: [],
        explanation: "Calibration compares the response against a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
    });

    expect(result.questions).toHaveLength(0);
  });

  it("accepts a source-grounded two-sentence Hard case", () => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "hard", "identification"),
      sourceText: "Calibration compares instrument response with a known reference standard in analytical testing. A drift outside the accepted range requires recalibration before sample results are interpreted.",
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "hard",
        question: "A laboratory analyst observes the instrument response drifting outside the accepted range during a sample batch. What must happen before the results can be interpreted?",
        answer: "recalibration",
        acceptedAnswers: [],
        explanation: "The source says an out-of-range drift requires recalibration before interpreting sample results.",
        sourceEvidence: "A drift outside the accepted range requires recalibration before sample results are interpreted.",
      }],
    });

    expect(result.questions).toHaveLength(1);
  });

  it("rejects a two-sentence Hard story that does not require a multi-step decision", () => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "hard", "identification"),
      sourceText: source,
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "hard",
        question: "A clinical case describes calibration. The analyst sees an instrument response.",
        answer: "instrument response",
        acceptedAnswers: [],
        explanation: "Calibration compares the response against a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
    });

    expect(result.questions).toHaveLength(0);
  });

  it("enforces the pasted identification answer and explanation limits", () => {
    const overlongAnswer = "calibration".repeat(8);
    const sourceText = `Calibration compares instrument response with a known reference standard. ${overlongAnswer} is a deliberately long source token.`;
    const result = validateQuizDrafts({
      slots: planQuiz(1, "easy", "identification"),
      sourceText,
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        answer: overlongAnswer,
        acceptedAnswers: ["known reference standard"],
        explanation: "Too short.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard.",
      }],
    });

    expect(result.questions).toHaveLength(0);
  });

  it("rejects a correct identification answer over eighty characters", () => {
    const longAnswer = "x".repeat(81);
    const result = validateQuizDrafts({
      slots: planQuiz(1, "easy", "identification"),
      sourceText: `${source} ${longAnswer}`,
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        answer: longAnswer,
        acceptedAnswers: [],
        explanation: "Calibration compares the response against a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
    });

    expect(result.questions).toHaveLength(0);
  });

  it("rejects multiple-choice options that exceed the supported option length", () => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "easy", "multiple_choice"),
      sourceText: source,
      drafts: [{
        slot: 1,
        type: "multiple_choice",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        options: {
          A: "Instrument response",
          B: `Known reference standard ${"comparison details ".repeat(10)}`,
          C: "Analytical testing",
          D: "Calibration procedure",
        },
        correctAnswer: "A",
        explanation: "Calibration compares the response against a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
    });

    expect(result.questions).toHaveLength(0);
  });

  it("rejects more than six source-supported identification variants", () => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "easy", "identification"),
      sourceText: "Calibration compares instrument response with a known reference standard in analytical testing.",
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        answer: "instrument response",
        acceptedAnswers: ["calibration", "instrument", "response", "known", "reference", "standard", "testing"],
        explanation: "Calibration compares the response against a known reference.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard.",
      }],
    });

    expect(result.questions).toHaveLength(0);
  });

  it("accepts evidence with at least seventy percent source-word coverage when extraction spacing differs", () => {
    const result = validateQuizDrafts({
      slots: planQuiz(1, "easy", "identification"),
      sourceText: "Calibration compares instrument response with a known reference standard in analytical testing.",
      drafts: [{
        slot: 1,
        type: "identification",
        difficulty: "easy",
        question: "What does calibration compare in analytical testing?",
        answer: "instrument response",
        acceptedAnswers: [],
        explanation: "Calibration compares the instrument response against a reference.",
        sourceEvidence: "Calibration compares a known reference standard.",
      }],
    });

    expect(result.questions).toHaveLength(1);
  });
});
