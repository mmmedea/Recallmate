import { v4 as uuidv4 } from "uuid";
import { buildQuizPrompt } from "./prompt";
import { planQuiz } from "./planner";
import { quizBatchJsonSchema, type PublicQuizQuestion, type QuizDifficulty, type QuizQuestionFormat } from "./schema";
import { validateQuizDrafts } from "./validation";

export const QUIZ_GENERATION_RETRY_MESSAGE = "We couldn't generate a good quiz right now. Please try again in a moment.";
const QUIZ_BATCH_SIZE = 10;
const MAX_BATCH_ATTEMPTS = 3;

export type ProtectedIdentificationAnswer = {
  id: string;
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
  sourceEvidence: string;
};

export type QuizGenerationResult = {
  summary: string;
  questions: PublicQuizQuestion[];
  protectedAnswers: ProtectedIdentificationAnswer[];
  difficulty: QuizDifficulty;
  format: QuizQuestionFormat;
  requestedCount: number;
  report: { acceptedCount: number; rejectedCount: number; attempts: number };
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function shuffleOptions(
  options: Record<(typeof OPTION_KEYS)[number], string>,
  correctAnswer: (typeof OPTION_KEYS)[number],
): {
  options: Record<(typeof OPTION_KEYS)[number], string>;
  correctAnswer: (typeof OPTION_KEYS)[number];
} {
  const shuffled = OPTION_KEYS.map((key) => ({
    text: options[key],
    isCorrect: key === correctAnswer,
  }));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const shuffledOptions = Object.fromEntries(
    OPTION_KEYS.map((key, index) => [key, shuffled[index].text]),
  ) as Record<(typeof OPTION_KEYS)[number], string>;
  const shuffledCorrectAnswer = OPTION_KEYS[shuffled.findIndex((option) => option.isCorrect)];

  return { options: shuffledOptions, correctAnswer: shuffledCorrectAnswer };
}

type GenerateJson = <T>(request: { system: string; user: string; schema: unknown }) => Promise<T>;

async function generateJsonWithSharedProviders<T>(request: { system: string; user: string; schema: unknown }): Promise<T> {
  const { generateJson } = await import("@/lib/ai/provider");
  return generateJson<T>({ ...request, operation: "generate_quiz" });
}

export async function generateQuiz({
  sourceText,
  fileName,
  count,
  difficulty,
  format,
  generateJson = generateJsonWithSharedProviders,
}: {
  sourceText: string;
  fileName: string;
  count: number;
  difficulty: QuizDifficulty;
  format: QuizQuestionFormat;
  generateJson?: GenerateJson;
}): Promise<QuizGenerationResult> {
  const slots = planQuiz(count, difficulty, format);
  const minimumAccepted = Math.ceil(slots.length * 0.8);
  let lastSummary = "";
  let attempts = 0;
  const acceptedBySlot = new Map<number, (ReturnType<typeof validateQuizDrafts>["questions"])[number]>();
  const seenFingerprints = new Set<string>();

  for (let offset = 0; offset < slots.length; offset += QUIZ_BATCH_SIZE) {
    const batchSlots = slots.slice(offset, offset + QUIZ_BATCH_SIZE);
    let pendingSlots = batchSlots;

    for (let batchAttempt = 1; batchAttempt <= MAX_BATCH_ATTEMPTS && pendingSlots.length > 0; batchAttempt += 1) {
      attempts += 1;
      try {
        const prompt = buildQuizPrompt({ sourceText, fileName, slots: pendingSlots });
        const generated = await generateJson<{ summary?: unknown; questions?: unknown }>({
          ...prompt,
          schema: quizBatchJsonSchema,
        });
        lastSummary = typeof generated.summary === "string" ? generated.summary.trim() : lastSummary;
        const validated = validateQuizDrafts({ drafts: generated.questions, slots: pendingSlots, sourceText });

        for (const question of validated.questions) {
          if (seenFingerprints.has(question.fingerprint)) continue;
          seenFingerprints.add(question.fingerprint);
          acceptedBySlot.set(question.slot, question);
        }
        pendingSlots = pendingSlots.filter((slot) => !acceptedBySlot.has(slot.index + 1));
      } catch {
        if (batchAttempt === MAX_BATCH_ATTEMPTS) {
          throw new Error(QUIZ_GENERATION_RETRY_MESSAGE);
        }
      }
    }
  }

  if (acceptedBySlot.size < minimumAccepted) throw new Error(QUIZ_GENERATION_RETRY_MESSAGE);

  const publicQuestions: PublicQuizQuestion[] = [];
  const protectedAnswers: ProtectedIdentificationAnswer[] = [];
  for (const draft of Array.from(acceptedBySlot.values()).sort((left, right) => left.slot - right.slot)) {
    const id = uuidv4();
    if (draft.type === "multiple_choice") {
      const shuffled = shuffleOptions(draft.options, draft.correctAnswer);
      publicQuestions.push({
        id,
        type: draft.type,
        difficulty: draft.difficulty,
        question: draft.question,
        options: shuffled.options,
        correctAnswer: shuffled.correctAnswer,
        explanation: draft.explanation,
        sourceCitation: draft.sourceEvidence,
      });
    } else {
      const answerId = uuidv4();
      protectedAnswers.push({
        id: answerId,
        answer: draft.answer,
        acceptedAnswers: draft.acceptedAnswers,
        explanation: draft.explanation,
        sourceEvidence: draft.sourceEvidence,
      });
      publicQuestions.push({
        id,
        type: draft.type,
        difficulty: draft.difficulty,
        question: draft.question,
        answerId,
      });
    }
  }

  return {
    summary: lastSummary,
    questions: publicQuestions,
    protectedAnswers,
    difficulty,
    format,
    requestedCount: slots.length,
    report: {
      acceptedCount: publicQuestions.length,
      rejectedCount: slots.length - publicQuestions.length,
      attempts,
    },
  };
}
