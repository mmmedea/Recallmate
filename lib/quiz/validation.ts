import { reviewerMetadataPattern } from "@/lib/source/academic-source";
import { applyQuizEngineV2, classifyQuizSkill, semanticQuestionFingerprint, type StudyQuizQuestion } from "@/lib/ai/quiz-engine-v2";
import type { QuizPlanSlot, QuizQuestionDraft, QuizQuestionType } from "./schema";

function normalizeText(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}%+-]+/gu, " ").replace(/\s+/g, " ").trim();
}

function supportedBySource(value: string, sourceText: string) {
  const normalized = normalizeText(value);
  const normalizedSource = normalizeText(sourceText);
  if (normalized.length < 10) return false;
  if (normalizedSource.includes(normalized)) return true;

  const evidenceWords = normalized.split(" ").filter((word) => word.length > 3);
  if (evidenceWords.length === 0) return false;
  const matchingWords = evidenceWords.filter((word) => normalizedSource.includes(word)).length;
  return matchingWords / evidenceWords.length >= 0.7;
}

function validIdentificationDifficulty(question: string, difficulty: QuizPlanSlot["difficulty"]) {
  const skill = classifyQuizSkill(question);
  if (difficulty === "easy") return true;
  if (difficulty === "medium") return skill !== "recall";
  return hasHardScenarioShape(question);
}

const hardScenarioCue = /\b(?:case|scenario|situation|suppose|imagine|patient|clinician|clinical|laboratory|lab|analyst|technician|researcher|engineer|operator|student|learner|specimen|sample)\b/i;
const hardReasoningCue = /\b(?:before|after|then|next|most likely|best next step|best supported|both|combine|connect|relationship between|consequence|result)\b/i;

function hasHardScenarioShape(question: string) {
  const sentenceCount = question
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .length;
  return hardScenarioCue.test(question) && hardReasoningCue.test(question) && sentenceCount >= 2 && sentenceCount <= 4;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateQuizDrafts({
  drafts,
  slots,
  sourceText,
}: {
  drafts: unknown;
  slots: QuizPlanSlot[];
  sourceText: string;
}) {
  const accepted: Array<QuizQuestionDraft & { fingerprint: string }> = [];
  const seenSlots = new Set<number>();
  const seenFingerprints = new Set<string>();
  let rejectedCount = 0;

  if (!Array.isArray(drafts)) return { questions: accepted, rejectedCount: slots.length };

  for (const raw of drafts) {
    if (!isRecord(raw)) { rejectedCount += 1; continue; }
    const slotNumber = Number(raw.slot);
    const slot = slots.find((candidate) => candidate.index + 1 === slotNumber);
    const type = raw.type as QuizQuestionType;
    if (
      !slot || seenSlots.has(slotNumber) ||
      type !== slot.type || raw.difficulty !== slot.difficulty ||
      typeof raw.question !== "string" || raw.question.trim().length < 15 ||
      typeof raw.explanation !== "string" || raw.explanation.trim().length < 20 ||
      typeof raw.sourceEvidence !== "string" || !supportedBySource(raw.sourceEvidence, sourceText) ||
      (slot.difficulty === "hard" && !hasHardScenarioShape(String(raw.question))) ||
      reviewerMetadataPattern.test(`${raw.question} ${raw.sourceEvidence}`)
    ) { rejectedCount += 1; continue; }

    let fingerprint: string;
    if (type === "multiple_choice") {
      const options = raw.options;
      const correctAnswer = raw.correctAnswer;
      if (!isRecord(options) || !["A", "B", "C", "D"].every((key) => typeof options[key] === "string" && String(options[key]).trim().length > 0) ||
          !["A", "B", "C", "D"].includes(String(correctAnswer)) ||
          ["A", "B", "C", "D"].some((key) => String(options[key]).trim().length > 160)) {
        rejectedCount += 1;
        continue;
      }
      const values = ["A", "B", "C", "D"].map((key) => normalizeText(String(options[key])));
      if (new Set(values).size !== 4) { rejectedCount += 1; continue; }
      const candidate: StudyQuizQuestion = {
        question: raw.question,
        options: options as Record<string, string>,
        correctAnswer: String(correctAnswer),
        explanation: raw.explanation,
        sourceCitation: raw.sourceEvidence,
      };
      const quality = applyQuizEngineV2({ questions: [candidate], sourceText, difficulty: slot.difficulty, requestedCount: 1 });
      if (quality.questions.length !== 1) { rejectedCount += 1; continue; }
      const normalized = quality.questions[0];
      fingerprint = normalized.semanticFingerprint || semanticQuestionFingerprint(normalized.question, classifyQuizSkill(normalized.question), normalized.options[normalized.correctAnswer]);
      accepted.push({
        slot: slotNumber,
        type,
        difficulty: slot.difficulty,
        question: normalized.question,
        options: normalized.options as Record<"A" | "B" | "C" | "D", string>,
        correctAnswer: normalized.correctAnswer as "A" | "B" | "C" | "D",
        explanation: normalized.explanation || raw.explanation,
        sourceEvidence: raw.sourceEvidence,
        fingerprint,
      });
    } else {
      const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
      const rawVariants = raw.acceptedAnswers === undefined ? [] : raw.acceptedAnswers;
      const variants = Array.isArray(rawVariants) ? rawVariants.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
      const allAnswers = Array.from(new Set([answer, ...variants].map((value) => value.trim()).filter(Boolean)));
      if (!answer || allAnswers.length === 0 || allAnswers.length > 8 ||
          answer.length > 80 || answer.split(/\s+/).length > 5 ||
          !Array.isArray(rawVariants) || variants.length !== rawVariants.length ||
          variants.length > 6 || variants.some((value) => value.length > 80) ||
          !validIdentificationDifficulty(raw.question, slot.difficulty) ||
          !allAnswers.every((value) => supportedBySource(value, sourceText))) {
        rejectedCount += 1;
        continue;
      }
      fingerprint = semanticQuestionFingerprint(raw.question, classifyQuizSkill(raw.question), answer);
      accepted.push({
        slot: slotNumber,
        type,
        difficulty: slot.difficulty,
        question: raw.question,
        answer,
        acceptedAnswers: allAnswers,
        explanation: raw.explanation,
        sourceEvidence: raw.sourceEvidence,
        fingerprint,
      });
    }

    if (seenFingerprints.has(fingerprint)) {
      accepted.pop();
      rejectedCount += 1;
      continue;
    }
    seenFingerprints.add(fingerprint);
    seenSlots.add(slotNumber);
  }

  return { questions: accepted, rejectedCount: Math.max(rejectedCount, slots.length - accepted.length) };
}
