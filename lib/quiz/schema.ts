export type QuizLevel = "easy" | "medium" | "hard";
export type QuizDifficulty = QuizLevel | "mixed";
export type QuizQuestionFormat = "multiple_choice" | "identification" | "mixed";
export type QuizQuestionType = Exclude<QuizQuestionFormat, "mixed">;

type QuizQuestionBase = {
  slot: number;
  type: QuizQuestionType;
  difficulty: QuizLevel;
  question: string;
  explanation: string;
  sourceEvidence: string;
};

export type MultipleChoiceQuestionDraft = QuizQuestionBase & {
  type: "multiple_choice";
  options: Record<"A" | "B" | "C" | "D", string>;
  correctAnswer: "A" | "B" | "C" | "D";
};

export type IdentificationQuestionDraft = QuizQuestionBase & {
  type: "identification";
  answer: string;
  acceptedAnswers: string[];
};

export type QuizQuestionDraft = MultipleChoiceQuestionDraft | IdentificationQuestionDraft;

export type QuizPlanSlot = {
  index: number;
  difficulty: QuizLevel;
  type: QuizQuestionType;
};

/** Provider-facing schema. Type-specific fields are checked again in application code. */
export const quizBatchJsonSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          slot: { type: "INTEGER" },
          type: { type: "STRING", enum: ["multiple_choice", "identification"] },
          difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
          question: { type: "STRING" },
          explanation: { type: "STRING" },
          sourceEvidence: { type: "STRING" },
          options: {
            type: "OBJECT",
            properties: {
              A: { type: "STRING" }, B: { type: "STRING" },
              C: { type: "STRING" }, D: { type: "STRING" },
            },
            required: ["A", "B", "C", "D"],
          },
          correctAnswer: { type: "STRING", enum: ["A", "B", "C", "D"] },
          answer: { type: "STRING" },
          acceptedAnswers: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["slot", "type", "difficulty", "question", "explanation", "sourceEvidence"],
      },
    },
  },
  required: ["summary", "questions"],
} as const;

export type PublicQuizQuestion = {
  id: string;
  type: QuizQuestionType;
  difficulty: QuizLevel;
  question: string;
  explanation?: string;
  sourceCitation?: string;
  pageNumber?: string;
  options?: Record<"A" | "B" | "C" | "D", string>;
  correctAnswer?: "A" | "B" | "C" | "D";
  answerId?: string;
};
