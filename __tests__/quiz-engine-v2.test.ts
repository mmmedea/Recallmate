import { describe, expect, it } from "vitest";
import { applyQuizEngineV2, classifyQuizSkill, semanticQuestionFingerprint, type StudyQuizQuestion } from "@/lib/ai/quiz-engine-v2";

const source = `
Stress increases ACTH, Cortisol, and Catecholamines.
Hyperventilation increases Total Cholesterol and PRL.
Posture decreases HDL.
Diurnal Variation peaks in the early morning.
Cortisol is lowest from 8 pm to 12 am.
ACTH is lower at night.
`;

function q(question: string, correct = "Stress increases ACTH, Cortisol, and Catecholamines."): StudyQuizQuestion {
  return {
    question,
    options: {
      A: correct,
      B: "Hyperventilation increases Total Cholesterol and PRL.",
      C: "Posture decreases HDL.",
      D: "ACTH is lower at night.",
    },
    correctAnswer: "A",
    explanation: `The source states: ${correct}`,
    sourceCitation: correct,
    pageNumber: "source",
  };
}

const compactAnalyteOptions = {
  A: "Cortisol",
  B: "HDL",
  C: "PRL",
  D: "Glucose",
};

describe("quiz engine v2", () => {
  it("collapses exact and paraphrased duplicates by concept, relationship, and skill", () => {
    const variants = [
      q("Which substances increase during stress?"),
      q("What increases when a patient is stressed?"),
      q("Stress causes an increase in which substances?"),
    ];

    const result = applyQuizEngineV2({
      questions: variants,
      sourceText: source,
      difficulty: "easy",
      requestedCount: 3,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.report.duplicateRejected).toBe(2);
    expect(result.report.exhausted).toBe(true);
  });

  it("allows the same source relationship when the cognitive skill is genuinely different", () => {
    const recall = {
      ...q("Which substances increase during stress?", "Cortisol"),
      options: compactAnalyteOptions,
    };
    const scenario = {
      ...q("A patient during collection: which substances increase during stress?", "Cortisol"),
      options: compactAnalyteOptions,
    };

    const result = applyQuizEngineV2({
      questions: [recall, scenario],
      sourceText: source,
      difficulty: "easy",
      requestedCount: 2,
    });

    expect(result.questions.map((item) => item.cognitiveSkill)).toEqual(["recall", "scenario"]);
    expect(new Set(result.questions.map((item) => item.semanticFingerprint)).size).toBe(2);
    expect(result.report.duplicateRejected).toBe(0);
  });

  it("rejects direct-recall questions in medium difficulty", () => {
    const result = applyQuizEngineV2({
      questions: [q("Which substances increase during stress?")],
      sourceText: source,
      difficulty: "medium",
      requestedCount: 1,
    });

    expect(result.questions).toHaveLength(0);
    expect(result.report.difficultyRejected).toBe(1);
  });

  it("rejects hard direct-recall questions even when they are labeled hard by the caller", () => {
    const result = applyQuizEngineV2({
      questions: [q("Which analytes increase during stress?")],
      sourceText: source,
      difficulty: "hard",
      requestedCount: 1,
    });

    expect(result.questions).toHaveLength(0);
    expect(result.report.difficultyRejected).toBe(1);
  });

  it("rejects useless metadata questions and ambiguous duplicate options", () => {
    const metadata = q("What is the filename of this uploaded lesson?");
    const ambiguous = q("A patient is stressed before collection. Which source-grounded effect is expected?");
    ambiguous.options.B = ambiguous.options.A;

    const result = applyQuizEngineV2({
      questions: [metadata, ambiguous],
      sourceText: source,
      difficulty: "medium",
      requestedCount: 2,
    });

    expect(result.questions).toHaveLength(0);
    expect(result.report.usefulRejected).toBe(1);
    expect(result.report.ambiguousRejected).toBe(1);
  });

  it("classifies application and scenario wording separately from recall", () => {
    expect(classifyQuizSkill("Which substances increase during stress?")).toBe("recall");
    expect(classifyQuizSkill("A patient hyperventilates before collection. Which change is expected?")).toBe("scenario");
    expect(semanticQuestionFingerprint("Which substances increase during stress?", "recall", "ACTH, Cortisol, Catecholamines")).toContain("recall:increase");
  });

  it("includes the answer target in the semantic identity", () => {
    const cortisolTarget = semanticQuestionFingerprint("Which substances increase during stress?", "recall", "ACTH, Cortisol, Catecholamines");
    const cholesterolTarget = semanticQuestionFingerprint("Which substances increase during stress?", "recall", "Total Cholesterol and PRL");

    expect(cortisolTarget).not.toBe(cholesterolTarget);
    expect(cortisolTarget).toContain("target=acth-catecholamin-cortisol");
  });
});
