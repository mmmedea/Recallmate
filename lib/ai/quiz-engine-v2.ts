import { normalizeQuizDifficulty, type QuizDifficulty } from "@/lib/ai/quiz-policy";
import { reviewerMetadataPattern } from '@/lib/source/academic-source';

export type QuizSkill = "recall" | "comparison" | "application" | "scenario" | "analysis" | "integration";

export type StudyQuizQuestion = {
  id?: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation?: string;
  sourceCitation?: string;
  pageNumber?: string;
  cognitiveSkill?: QuizSkill;
  semanticFingerprint?: string;
  difficultyScore?: number;
};

export type QuizEngineReport = {
  requestedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateRejected: number;
  difficultyRejected: number;
  groundingRejected: number;
  usefulRejected: number;
  ambiguousRejected: number;
  exhausted: boolean;
  applicationRatio: number;
};

type RejectionReason =
  | "duplicate"
  | "difficulty"
  | "grounding"
  | "useful"
  | "ambiguous";

const optionKeys = ["A", "B", "C", "D"] as const;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "answer",
  "are",
  "as",
  "best",
  "by",
  "choice",
  "choose",
  "during",
  "from",
  "in",
  "is",
  "lesson",
  "material",
  "most",
  "of",
  "patient",
  "source",
  "student",
  "study",
  "that",
  "the",
  "to",
  "uploaded",
  "what",
  "when",
  "which",
  "with",
]);

const metadataPattern =
  /\b(file ?name|filename|slide number|page number|decorative|contact information|email address|thank you|q\s*&\s*a|welcome|agenda|repeated heading)\b/i;

const scenarioPattern =
  /\b(case|scenario|situation|specimen|collection|immediately before|if a|if the|clinical|learner must|student applies)\b/i;

const applicationPattern =
  /\b(apply|application|consistent with|expected|likely|interpret|conclusion|consequence|effect|best supported|most accurate)\b/i;

const comparisonPattern =
  /\b(compare|comparison|distinguish|differentiate|difference|versus|vs\.?|between|whereas|unlike)\b/i;

const analysisPattern =
  /\b(why|infer|reason|explain|analysis|because|avoid|misconception|predict)\b/i;

const integrationPattern =
  /\b(connect|combine|integrate|multi-step|relationship between|two or more|together)\b/i;

const relationCanonical: Array<[RegExp, string]> = [
  [/\b(increase|increases|increased|higher|rise|rises|elevated|elevation)\b/i, "increase"],
  [/\b(decrease|decreases|decreased|lower|lowest|reduced|reduction)\b/i, "decrease"],
  [/\b(peak|peaks|maximum)\b/i, "peak"],
  [/\b(cause|causes|effect|affect|changes?)\b/i, "effect"],
  [/\b(associated|related|relationship)\b/i, "relationship"],
  [/\b(diagnosis|diagnoses|diagnostic)\b/i, "diagnosis"],
  [/\b(treatment|management|action)\b/i, "management"],
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s%+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemToken(token: string) {
  if (/^stress/.test(token)) return "stress";
  if (/^(increase|increases|increased|increasing|higher|rise|rises|elevated|elevation)$/.test(token)) return "increase";
  if (/^(decrease|decreases|decreased|decreasing|lower|lowest|reduced|reduction)$/.test(token)) return "decrease";
  if (/^(substance|substances)$/.test(token)) return "substance";
  return token
    .replace(/(ing|edly|edly|ed|es|s)$/i, "")
    .replace(/stress$/i, "stress");
}

function contentTokens(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map(stemToken)
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .filter((token) => !/^\d+$/.test(token));
}

function relationFor(value: string) {
  for (const [pattern, canonical] of relationCanonical) {
    if (pattern.test(value)) return canonical;
  }
  return "fact";
}

export function classifyQuizSkill(question: string): QuizSkill {
  if (integrationPattern.test(question)) return "integration";
  if (comparisonPattern.test(question)) return "comparison";
  if (scenarioPattern.test(question)) return "scenario";
  if (analysisPattern.test(question)) return "analysis";
  if (applicationPattern.test(question)) return "application";
  return "recall";
}

export function semanticQuestionFingerprint(question: string, skill: QuizSkill = classifyQuizSkill(question), answerTarget = "") {
  const relation = relationFor(question);
  const conceptTokens = Array.from(new Set(contentTokens(question)))
    .filter((token) => token !== relation)
    .sort()
    .slice(0, 8);
  const targetTokens = Array.from(new Set(contentTokens(answerTarget)))
    .filter((token) => token !== relation)
    .sort()
    .slice(0, 8);
  return `${skill}:${relation}:${conceptTokens.join("-")}:target=${targetTokens.join("-")}`;
}

function parseFingerprint(fingerprint: string) {
  const [skill, relation, tokenPart = "", targetPart = "target="] = fingerprint.split(":");
  return {
    skill,
    relation,
    tokens: tokenPart.split("-").filter(Boolean),
    targetTokens: targetPart.replace(/^target=/, "").split("-").filter(Boolean),
  };
}

function semanticallyEquivalent(left: string, right: string) {
  if (left === right) return true;
  const a = parseFingerprint(left);
  const b = parseFingerprint(right);
  if (a.skill !== b.skill || a.relation !== b.relation) return false;
  if (a.tokens.length === 0 || b.tokens.length === 0) return false;
  const aSet = new Set(a.tokens);
  const bSet = new Set(b.tokens);
  const overlap = a.tokens.filter((token) => bSet.has(token)).length;
  const smaller = Math.min(aSet.size, bSet.size);
  const larger = Math.max(aSet.size, bSet.size);
  const targetOverlap = a.targetTokens.length && b.targetTokens.length
    ? a.targetTokens.filter((token) => b.targetTokens.includes(token)).length / Math.min(a.targetTokens.length, b.targetTokens.length)
    : 1;
  return targetOverlap >= 0.75 && (overlap / smaller >= 0.75 || overlap / larger >= 0.5);
}

export function scoreQuizDifficulty(question: StudyQuizQuestion) {
  const skill = question.cognitiveSkill ?? classifyQuizSkill(question.question);
  const questionText = question.question;
  const optionText = optionKeys.map((key) => question.options?.[key] ?? "").join(" ");
  let score = 0;

  if (skill === "application") score += 2;
  if (skill === "scenario") score += 3;
  if (skill === "analysis") score += 3;
  if (skill === "comparison") score += 2;
  if (skill === "integration") score += 4;
  if (scenarioPattern.test(questionText)) score += 2;
  if (integrationPattern.test(questionText)) score += 2;
  if (comparisonPattern.test(questionText)) score += 1;
  if (questionText.length > 115) score += 1;
  if (new Set(contentTokens(`${questionText} ${optionText}`)).size >= 12) score += 1;
  if (question.sourceCitation && normalizeText(questionText).includes(normalizeText(question.sourceCitation))) score -= 1;

  return Math.max(0, score);
}

function hasFourOptions(question: StudyQuizQuestion) {
  return optionKeys.every((key) => typeof question.options?.[key] === "string" && question.options[key].trim().length > 0);
}

function hasExactlyOneCorrectAnswer(question: StudyQuizQuestion) {
  if (!optionKeys.includes(question.correctAnswer as any)) return false;
  if (!hasFourOptions(question)) return false;

  const normalizedOptions = optionKeys.map((key) => normalizeText(question.options[key]));
  if (new Set(normalizedOptions).size !== 4) return false;

  const correct = normalizeText(question.options[question.correctAnswer]);
  const duplicatedCorrect = normalizedOptions.filter((option) => option === correct).length;
  if (duplicatedCorrect !== 1) return false;

  const correctTokens = new Set(contentTokens(correct));
  if (correctTokens.size < 3) return true;

  return normalizedOptions.every((option, index) => {
    if (optionKeys[index] === question.correctAnswer) return true;
    const otherTokens = contentTokens(option);
    if (otherTokens.length < 3) return true;
    const overlap = otherTokens.filter((token) => correctTokens.has(token)).length / Math.max(correctTokens.size, otherTokens.length);
    return overlap < 0.9;
  });
}

function isUsefulQuestion(question: StudyQuizQuestion) {
  const combined = `${question.question} ${Object.values(question.options ?? {}).join(" ")}`;
  if (metadataPattern.test(combined) || reviewerMetadataPattern.test(combined)) return false;
  if (question.question.trim().length < 18) return false;
  return contentTokens(combined).length >= 6;
}

function isGrounded(question: StudyQuizQuestion, sourceText: string) {
  const normalizedSource = normalizeText(sourceText);
  const citation = normalizeText(question.sourceCitation ?? "");
  if (citation.length >= 12 && normalizedSource.includes(citation)) return true;

  const correct = normalizeText(question.options?.[question.correctAnswer] ?? "");
  if (correct.length >= 12 && normalizedSource.includes(correct)) return true;

  const sourceTokens = new Set(contentTokens(sourceText));
  const questionTokens = Array.from(new Set(contentTokens(`${question.question} ${correct}`)));
  if (questionTokens.length === 0) return false;
  const supported = questionTokens.filter((token) => sourceTokens.has(token)).length;
  return supported / questionTokens.length >= 0.45;
}

function passesDifficulty(question: StudyQuizQuestion, difficulty: QuizDifficulty) {
  if (/student applies the lesson point|during exam preparation, a learner|a case-style question asks|in a short application check/i.test(question.question)) return false;
  const skill = question.cognitiveSkill ?? classifyQuizSkill(question.question);
  const score = question.difficultyScore ?? scoreQuizDifficulty(question);
  if (difficulty === "hard") {
    return skill !== "recall" && score >= 4;
  }
  if (difficulty === "medium") {
    return score >= 2 && skill !== 'recall';
  }
  return score <= 5;
}

function isApplicationLike(question: StudyQuizQuestion) {
  const skill = question.cognitiveSkill ?? classifyQuizSkill(question.question);
  return skill === "application" || skill === "scenario" || skill === "analysis" || skill === "integration";
}

function reject(report: Record<RejectionReason, number>, reason: RejectionReason) {
  report[reason] += 1;
}

function withQuizMetadata(question: StudyQuizQuestion, index: number): StudyQuizQuestion {
  const cognitiveSkill = classifyQuizSkill(question.question);
  const correctOption = question.options?.[question.correctAnswer] ?? "";
  const semanticFingerprint = question.semanticFingerprint ?? semanticQuestionFingerprint(question.question, cognitiveSkill, correctOption);
  const difficultyScore = scoreQuizDifficulty({ ...question, cognitiveSkill });
  return {
    ...question,
    id: question.id || `q${index + 1}`,
    cognitiveSkill,
    semanticFingerprint,
    difficultyScore,
  };
}

export function applyQuizEngineV2({
  questions,
  sourceText,
  difficulty,
  requestedCount,
}: {
  questions: StudyQuizQuestion[];
  sourceText: string;
  difficulty: QuizDifficulty | string;
  requestedCount: number;
}) {
  const normalizedDifficulty = normalizeQuizDifficulty(difficulty);
  const seen: string[] = [];
  const accepted: StudyQuizQuestion[] = [];
  const rejected: Record<RejectionReason, number> = {
    duplicate: 0,
    difficulty: 0,
    grounding: 0,
    useful: 0,
    ambiguous: 0,
  };

  for (const [index, rawQuestion] of questions.entries()) {
    if (accepted.length >= requestedCount) break;
    const question = withQuizMetadata(rawQuestion, index);

    if (!isUsefulQuestion(question)) {
      reject(rejected, "useful");
      continue;
    }
    if (!hasExactlyOneCorrectAnswer(question)) {
      reject(rejected, "ambiguous");
      continue;
    }
    if (!isGrounded(question, sourceText)) {
      reject(rejected, "grounding");
      continue;
    }
    if (!passesDifficulty(question, normalizedDifficulty)) {
      reject(rejected, "difficulty");
      continue;
    }
    if (seen.some((fingerprint) => semanticallyEquivalent(fingerprint, question.semanticFingerprint!))) {
      reject(rejected, "duplicate");
      continue;
    }

    seen.push(question.semanticFingerprint!);
    accepted.push({ ...question, id: `q${accepted.length + 1}` });
  }

  const applicationCount = accepted.filter(isApplicationLike).length;
  const applicationRatio = accepted.length ? applicationCount / accepted.length : 0;
  const report: QuizEngineReport = {
    requestedCount,
    acceptedCount: accepted.length,
    rejectedCount: Object.values(rejected).reduce((sum, count) => sum + count, 0),
    duplicateRejected: rejected.duplicate,
    difficultyRejected: rejected.difficulty,
    groundingRejected: rejected.grounding,
    usefulRejected: rejected.useful,
    ambiguousRejected: rejected.ambiguous,
    exhausted: accepted.length < requestedCount,
    applicationRatio,
  };

  return { questions: accepted, report };
}
