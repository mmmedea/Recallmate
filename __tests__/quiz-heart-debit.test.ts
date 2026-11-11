import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260912100000_quiz_wrong_answer_heart_debit.sql",
  "utf8",
);

describe("server-authoritative quiz heart debit", () => {
  it("uses an idempotent ledger entry and locks the account", () => {
    expect(migration).toContain("QUIZ_WRONG_ANSWER");
    expect(migration).toContain("for update");
    expect(migration).toContain("on conflict (user_id, idempotency_key) do nothing");
    expect(migration).toContain("No hearts remaining");
  });

  it("keeps FSRS and economy mutation in one RPC transaction", () => {
    expect(migration).toContain("process_learning_review_with_heart");
    expect(migration).toContain("public.consume_quiz_heart");
    expect(migration).toContain("public.process_learning_review(");
    expect(migration).toContain("revoke execute on function public.consume_quiz_heart");
    expect(migration).toContain("grant execute on function public.process_learning_review_with_heart");
  });

  it("wires both quiz UIs to the server route/RPC", () => {
    const legacyQuiz = readFileSync("app/(app)/quiz/page.tsx", "utf8");
    const learningReview = readFileSync("app/api/learning/review/route.ts", "utf8");
    const legacyRoute = readFileSync("app/api/economy/quiz-wrong-answer/route.ts", "utf8");

    expect(legacyQuiz).toContain("/api/economy/quiz-wrong-answer");
    expect(legacyRoute).toContain('"consume_quiz_heart"');
    expect(learningReview).toContain('"process_learning_review_with_heart"');
    expect(learningReview).toContain("p_consume_heart: !premium");
  });
});
