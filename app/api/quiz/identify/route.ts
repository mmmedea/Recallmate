import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, requireUser, SecurityError } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkIdentificationAnswer } from "@/lib/quiz/identification-checker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    await checkRateLimit(user.id);

    const body: unknown = await request.json();
    if (
      !body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "answerId" && key !== "answer")
    ) {
      return NextResponse.json({ error: "Invalid answer submission." }, { status: 400, headers: noStoreHeaders });
    }

    const answerId = (body as Record<string, unknown>).answerId;
    const answer = (body as Record<string, unknown>).answer;
    if (
      typeof answerId !== "string" || !/^[0-9a-f-]{36}$/i.test(answerId) ||
      typeof answer !== "string" || answer.trim().length === 0 || answer.length > 500
    ) {
      return NextResponse.json({ error: "Enter an answer to continue." }, { status: 400, headers: noStoreHeaders });
    }

    const admin = createSupabaseAdminClient<any>();
    const { data, error } = await admin
      .from("quiz_identification_answer_keys")
      .select("answer_text, accepted_answers, explanation, source_evidence")
      .eq("id", answerId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Answer checking is temporarily unavailable." }, { status: 503, headers: noStoreHeaders });
    }
    if (!data) {
      return NextResponse.json({ error: "This quiz answer is unavailable. Generate a new quiz to continue." }, { status: 404, headers: noStoreHeaders });
    }

    const acceptedAnswers = Array.isArray(data.accepted_answers)
      ? [data.answer_text, ...data.accepted_answers].filter((value: unknown): value is string => typeof value === "string")
      : [data.answer_text];
    const correct = checkIdentificationAnswer(answer, acceptedAnswers);

    return NextResponse.json({
      correct,
      answer: data.answer_text,
      explanation: data.explanation,
      sourceEvidence: data.source_evidence,
    }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStoreHeaders });
    }
    return NextResponse.json({ error: "Answer checking is temporarily unavailable." }, { status: 503, headers: noStoreHeaders });
  }
}
