import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { freezeQuizSession, getActiveFrozenQuizSession, selectUnseenQuestionsFirst, type LegacyQuestionRow } from "@/lib/quiz/question-bank";

function question(id: string, bankId: string): LegacyQuestionRow {
  return {
    id,
    document_id: "doc-1",
    question_text: `Question ${id}`,
    options: ["A", "B", "C", "D"],
    correct_answer: "A",
    explanation: "Explanation",
    difficulty: "medium",
    source_chunk_id: "chunk-1",
    semantic_fingerprint: `fingerprint-${bankId}`,
    cognitive_skill: "recall",
    question_bank_id: bankId,
  };
}

describe("quiz bank v2.1", () => {
  it("uses the atomic RPC and returns the winning tab's frozen question IDs", async () => {
    const serviceClient = { rpc: vi.fn().mockResolvedValue({ data: { id: 'winner', question_ids: ['q2'] }, error: null }) };
    const result = await freezeQuizSession({ serviceClient, userId: 'user-1', documentId: 'doc-1', questions: [question('q1', 'b1')] });
    expect(serviceClient.rpc).toHaveBeenCalledWith('freeze_quiz_session', expect.objectContaining({ p_question_ids: ['q1'] }));
    expect(result.questionIds).toEqual(['q2']);
    expect(result.quizSessionId).toBe('winner');
  });

  it("does not silently create a non-atomic session when the RPC fails", async () => {
    const serviceClient = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('schema unavailable') }) };
    await expect(freezeQuizSession({ serviceClient, userId: 'user-1', documentId: 'doc-1', questions: [question('q1', 'b1')] })).rejects.toThrow('schema unavailable');
  });
  it("adds durable bank, session, attempt, and lifecycle tables in the migration", () => {
    const migration = readFileSync("supabase/migrations/20260910143000_quiz_engine_v21_question_bank.sql", "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.quiz_source_concepts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.quiz_question_bank");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.quiz_question_attempts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.quiz_sessions");
    expect(migration).toContain("concept_id uuid REFERENCES public.quiz_source_concepts");
    expect(migration).toContain("semantic_fingerprint text NOT NULL");
    expect(migration).toContain("status text NOT NULL DEFAULT 'candidate'");
    expect(migration).toContain("question_ids uuid[]");
    expect(migration).toContain("REVOKE ALL ON public.quiz_question_bank FROM anon, authenticated");
    expect(migration).toContain("GRANT SELECT ON public.quiz_question_bank TO authenticated");
    expect(migration).toContain("SECURITY INVOKER");
  });

  it("adds hardened FSRS learning prerequisites without anonymous access", () => {
    const migration = readFileSync("supabase/migrations/20260910151000_hardened_learning_foundation_for_quiz_v21.sql", "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.learning_items");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.learning_review_sessions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.learning_reviews");
    expect(migration).toContain("quiz_session_id uuid REFERENCES public.quiz_sessions");
    expect(migration).toContain("REVOKE ALL ON public.learning_items FROM anon, authenticated");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE ON public.learning_items TO authenticated");
    expect(migration).toContain("SECURITY INVOKER");
  });

  it("selects unseen questions before previously served question-bank entries", async () => {
    const questions = [
      question("q1", "bank-1"),
      question("q2", "bank-2"),
      question("q3", "bank-3"),
    ];

    const inMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ question_id: "q1" }], error: null })
      .mockResolvedValueOnce({ data: [{ question_bank_id: "bank-2" }], error: null });
    const eqMock = vi.fn(() => ({ in: inMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const serviceClient = {
      from: vi.fn(() => ({ select: selectMock })),
    };

    const selected = await selectUnseenQuestionsFirst({
      serviceClient,
      userId: "user-1",
      documentId: "doc-1",
      questions,
      requestedSize: 10,
    });

    expect(selected.map((item) => item.id)).toEqual(["q3"]);
    expect(serviceClient.from).toHaveBeenCalledWith("quiz_question_attempts");
  });

  it("loads an active frozen unseen session for two-tab reuse", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "session-1", question_ids: ["q1", "q2"] },
      error: null,
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ eq, order }));
    const select = vi.fn(() => ({ eq }));
    const serviceClient = { from: vi.fn(() => ({ select })) };

    const result = await getActiveFrozenQuizSession({
      serviceClient,
      userId: "user-1",
      documentId: "doc-1",
    });

    expect(result.available).toBe(true);
    expect(result.session?.question_ids).toEqual(["q1", "q2"]);
    expect(serviceClient.from).toHaveBeenCalledWith("quiz_sessions");
  });
});
