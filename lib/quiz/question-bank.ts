import { classifyQuizSkill, semanticQuestionFingerprint } from "@/lib/ai/quiz-engine-v2";

export const QUIZ_ENGINE_VERSION = "quiz_engine_v2_1";
export const QUIZ_QA_VERSION = "quiz_qa_v2_1";

export type LegacyQuestionRow = {
  id: string;
  document_id: string;
  question_text: string;
  options: string[] | Record<string, string>;
  correct_answer: string;
  explanation?: string | null;
  difficulty?: string | null;
  source_chunk_id?: string | null;
  semantic_fingerprint?: string | null;
  cognitive_skill?: string | null;
  question_bank_id?: string | null;
  generation_batch_id?: string | null;
};

type QuizBankQuestion = LegacyQuestionRow & {
  bankId?: string | null;
};

function optionsArray(options: LegacyQuestionRow["options"]) {
  if (Array.isArray(options)) return options;
  return ["A", "B", "C", "D"].map((key) => options?.[key]).filter(Boolean);
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relationKey(question: string) {
  const normalized = normalizeKey(question);
  if (/\b(increase|increases|increased|higher|rise|elevated)\b/.test(normalized)) return "increase";
  if (/\b(decrease|decreases|decreased|lower|lowest|reduced)\b/.test(normalized)) return "decrease";
  if (/\b(peak|peaks|maximum)\b/.test(normalized)) return "peak";
  if (/\b(compare|distinguish|differentiate|versus|between)\b/.test(normalized)) return "comparison";
  return "fact";
}

function conceptKey(question: LegacyQuestionRow) {
  const words = normalizeKey(question.question_text)
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !["which", "what", "when", "where", "best", "source", "uploaded", "patient"].includes(word))
    .slice(0, 8);
  return words.join("_") || "source_concept";
}

function inferQuestionMetadata(question: LegacyQuestionRow) {
  const cognitiveSkill = question.cognitive_skill || classifyQuizSkill(question.question_text);
  const answerTarget = Array.isArray(question.options)
    ? question.correct_answer
    : (question.options as Record<string, string>)?.[question.correct_answer] ?? question.correct_answer;
  const semanticFingerprint =
    question.semantic_fingerprint || semanticQuestionFingerprint(question.question_text, cognitiveSkill as any, answerTarget);
  return { cognitiveSkill, semanticFingerprint };
}

function toBankPayload(question: LegacyQuestionRow) {
  return {
    question: question.question_text,
    options: optionsArray(question.options),
    correctAnswer: question.correct_answer,
    explanation: question.explanation ?? "",
    sourceChunkId: question.source_chunk_id ?? null,
  };
}

function isMissingBankTable(error: any) {
  return error?.code === "42P01" || /quiz_question_bank|quiz_question_attempts|quiz_sessions|column .* does not exist/i.test(error?.message || "");
}

export async function ensureQuestionBankEntries(
  serviceClient: any,
  documentId: string,
  questions: LegacyQuestionRow[],
) {
  const mapped: QuizBankQuestion[] = [];

  for (const question of questions) {
    const { cognitiveSkill, semanticFingerprint } = inferQuestionMetadata(question);

    if (question.question_bank_id && question.semantic_fingerprint && question.cognitive_skill) {
      mapped.push({ ...question, bankId: question.question_bank_id });
      continue;
    }

    const payload = toBankPayload(question);
    const qConceptKey = conceptKey(question);
    const qRelationshipKey = relationKey(question.question_text);
    const { data: existingConcept, error: conceptLookupError } = await serviceClient
      .from("quiz_source_concepts")
      .select("id")
      .eq("document_id", documentId)
      .eq("concept_key", qConceptKey)
      .eq("relationship_key", qRelationshipKey)
      .maybeSingle();

    if (conceptLookupError) {
      if (isMissingBankTable(conceptLookupError)) return { available: false as const, questions };
      throw conceptLookupError;
    }

    let conceptId = existingConcept?.id ?? null;
    if (!conceptId) {
      const { data: insertedConcept, error: conceptInsertError } = await serviceClient
        .from("quiz_source_concepts")
        .insert({
          document_id: documentId,
          source_block_id: question.source_chunk_id ?? null,
          concept_key: qConceptKey,
          concept_label: qConceptKey.replace(/_/g, " "),
          relationship_key: qRelationshipKey,
          importance: 0.5,
        })
        .select("id")
        .single();
      if (conceptInsertError) {
        if (isMissingBankTable(conceptInsertError)) return { available: false as const, questions };
        if (conceptInsertError.code !== "23505") throw conceptInsertError;
      } else {
        conceptId = insertedConcept?.id ?? null;
      }
    }

    const bankInsert = {
      document_id: documentId,
      source_block_id: question.source_chunk_id ?? null,
      concept_id: conceptId,
      semantic_fingerprint: semanticFingerprint,
      difficulty: question.difficulty || "medium",
      cognitive_skill: cognitiveSkill,
      question_type: "multiple_choice",
      question_payload: payload,
      source_refs: question.source_chunk_id ? [{ sourceChunkId: question.source_chunk_id }] : [],
      generator_version: QUIZ_ENGINE_VERSION,
      prompt_version: "quiz_prompt_v2_1",
      qa_version: QUIZ_QA_VERSION,
      status: "approved",
    };

    const { data: existingBank, error: lookupError } = await serviceClient
      .from("quiz_question_bank")
      .select("id")
      .eq("document_id", documentId)
      .eq("semantic_fingerprint", semanticFingerprint)
      .in("status", ["candidate", "approved"])
      .maybeSingle();

    if (lookupError) {
      if (isMissingBankTable(lookupError)) return { available: false as const, questions };
      throw lookupError;
    }

    let bankId = existingBank?.id ?? null;
    if (!bankId) {
      const { data: insertedBank, error: insertError } = await serviceClient
        .from("quiz_question_bank")
        .insert(bankInsert)
        .select("id")
        .single();

      if (insertError) {
        if (isMissingBankTable(insertError)) return { available: false as const, questions };
        if (insertError.code === "23505") {
          const { data: retryBank, error: retryError } = await serviceClient
            .from("quiz_question_bank")
            .select("id")
            .eq("document_id", documentId)
            .eq("semantic_fingerprint", semanticFingerprint)
            .in("status", ["candidate", "approved"])
            .single();
          if (retryError) throw retryError;
          bankId = retryBank?.id ?? null;
        } else {
          throw insertError;
        }
      } else {
        bankId = insertedBank?.id ?? null;
      }
    }

    const { error: updateError } = await serviceClient
      .from("questions")
      .update({
        semantic_fingerprint: semanticFingerprint,
        cognitive_skill: cognitiveSkill,
        question_bank_id: bankId,
        generator_version: QUIZ_ENGINE_VERSION,
        qa_version: QUIZ_QA_VERSION,
        status: "approved",
      })
      .eq("id", question.id);

    if (updateError && !isMissingBankTable(updateError)) throw updateError;
    mapped.push({
      ...question,
      semantic_fingerprint: semanticFingerprint,
      cognitive_skill: cognitiveSkill,
      question_bank_id: bankId,
      bankId,
    });
  }

  return { available: true as const, questions: mapped };
}

export async function selectUnseenQuestionsFirst({
  serviceClient,
  userId,
  documentId,
  questions,
  requestedSize,
}: {
  serviceClient: any;
  userId: string;
  documentId: string;
  questions: QuizBankQuestion[];
  requestedSize: number;
}) {
  const banked = questions.filter((question) => question.question_bank_id || question.bankId);
  if (banked.length === 0) return questions.slice(0, requestedSize);

  const questionIds = banked.map((question) => question.id);
  const bankIds = banked.map((question) => question.question_bank_id || question.bankId).filter(Boolean);

  const [servedQuestionResult, servedBankResult] = await Promise.all([
    serviceClient
      .from("quiz_question_attempts")
      .select("question_id")
      .eq("user_id", userId)
      .in("question_id", questionIds),
    bankIds.length
      ? serviceClient
          .from("quiz_question_attempts")
          .select("question_bank_id")
          .eq("user_id", userId)
          .in("question_bank_id", bankIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (isMissingBankTable(servedQuestionResult.error) || isMissingBankTable(servedBankResult.error)) {
    return questions.slice(0, requestedSize);
  }
  if (servedQuestionResult.error) throw servedQuestionResult.error;
  if (servedBankResult.error) throw servedBankResult.error;

  const seenQuestionIds = new Set((servedQuestionResult.data ?? []).map((row: any) => row.question_id).filter(Boolean));
  const seenBankIds = new Set((servedBankResult.data ?? []).map((row: any) => row.question_bank_id).filter(Boolean));

  const unseen = questions.filter((question) => {
    const bankId = question.question_bank_id || question.bankId;
    return !seenQuestionIds.has(question.id) && (!bankId || !seenBankIds.has(bankId));
  });

  return unseen.slice(0, requestedSize);
}

export async function getActiveFrozenQuizSession({
  serviceClient,
  userId,
  documentId,
  mode = "unseen",
}: {
  serviceClient: any;
  userId: string;
  documentId: string;
  mode?: string;
}) {
  const { data, error } = await serviceClient
    .from("quiz_sessions")
    .select("id, question_ids")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .eq("mode", mode)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingBankTable(error)) return { available: false as const, session: null };
    throw error;
  }

  return { available: true as const, session: data ?? null };
}

export async function freezeQuizSession({
  serviceClient,
  userId,
  documentId,
  questions,
  difficulty = "mixed",
  mode = "unseen",
}: {
  serviceClient: any;
  userId: string;
  documentId: string;
  questions: QuizBankQuestion[];
  difficulty?: string;
  mode?: string;
}) {
  const questionIds = questions.map((question) => question.id);
  const { data: session, error } = await serviceClient.rpc("freeze_quiz_session", {
    p_user_id: userId, p_document_id: documentId, p_question_ids: questionIds,
    p_difficulty: difficulty, p_mode: mode,
  });

  if (error) {
    // Never fall back to a non-atomic insert if the migration is unavailable.
    throw error;
  }
  if (!session?.id || !Array.isArray(session.question_ids)) throw new Error("Invalid frozen session response");
  return { available: true as const, quizSessionId: session.id, questionIds: session.question_ids as string[] };
}

export async function recordQuestionAttemptAnswer({
  serviceClient,
  userId,
  questionId,
  quizSessionId,
  correct,
}: {
  serviceClient: any;
  userId: string;
  questionId: string;
  quizSessionId?: string | null;
  correct: boolean;
}) {
  if (!quizSessionId) return;

  const { error } = await serviceClient
    .from("quiz_question_attempts")
    .update({
      correct,
      answered_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .eq("quiz_session_id", quizSessionId)
    .is("answered_at", null);

  if (error && !isMissingBankTable(error)) throw error;

  const { data: remaining, error: remainingError } = await serviceClient
    .from("quiz_question_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("quiz_session_id", quizSessionId)
    .is("answered_at", null)
    .limit(1);

  if (remainingError) {
    if (!isMissingBankTable(remainingError)) throw remainingError;
    return;
  }

  if ((remaining ?? []).length === 0) {
    const { error: closeError } = await serviceClient
      .from("quiz_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", quizSessionId)
      .eq("user_id", userId)
      .eq("status", "in_progress");
    if (closeError && !isMissingBankTable(closeError)) throw closeError;
  }
}
