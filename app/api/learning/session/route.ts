import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { SUPABASE_ADMIN_CONFIG_ERROR_CODE, createSupabaseAdminClient, isSupabaseAdminConfigError } from "@/lib/supabase/admin";
import { ensureQuestionBankEntries, freezeQuizSession, getActiveFrozenQuizSession, selectUnseenQuestionsFirst, type LegacyQuestionRow } from "@/lib/quiz/question-bank";

export const runtime = "nodejs";

const StartSessionRequestSchema = z.object({
  documentId: z.string().uuid(),
  requestedSize: z.number().int().min(1).max(20).default(10)
}).strict();

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("authorization")?.split("Bearer ")[1];
    const { data: { user }, error: authError } = token 
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = StartSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request format", details: parsed.error.issues }, { status: 400 });
    }
    const { documentId, requestedSize } = parsed.data;

    const serviceClient = createSupabaseAdminClient<any>();

    // 1. Authorize user to access this document
    const { data: docData, error: docError } = await serviceClient
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docError || !docData) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 403 });
    }

    // 2. Fetch all learning items for this document
    const { data: learningItems, error: itemsError } = await serviceClient
      .from("learning_items")
      .select("*, questions(*)")
      .eq("document_id", documentId)
      .eq("user_id", user.id);

    if (itemsError || !learningItems) {
      throw new Error(`Failed to fetch learning items: ${itemsError?.message}`);
    }

    // 3. Prioritize items
    const now = new Date();
    
    // Sort logic: 
    // - State 3 (Relearning / failed) due items highest priority
    // - Overdue items
    // - Due today
    // - New items (State 0)
    const prioritized = learningItems.sort((a, b) => {
      const aDue = new Date(a.due_at) <= now;
      const bDue = new Date(b.due_at) <= now;
      
      // If one is due and the other is not, due comes first
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      if (aDue && bDue) {
        // Both due. Prioritize state 3 (recently failed / relearning)
        if (a.state === 3 && b.state !== 3) return -1;
        if (a.state !== 3 && b.state === 3) return 1;

        // Prioritize by most overdue
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      }

      // If neither is due, prioritize new items (State 0) over stable items
      if (a.state === 0 && b.state !== 0) return -1;
      if (a.state !== 0 && b.state === 0) return 1;

      return 0; // fallback
    });

    // Only pick up to requestedSize items that are actually due or new
    // We shouldn't force stable items into the review session.
    const eligibleForReview = prioritized.filter(item => {
      return (new Date(item.due_at) <= now) || item.state === 0;
    });

    let selectedItems = eligibleForReview.slice(0, requestedSize);
    let frozenQuizSessionId: string | null = null;
    let questionBankAvailable = false;

    if (eligibleForReview.length > 0) {
      const candidateQuestions = eligibleForReview
        .map((item) => item.questions)
        .filter(Boolean) as LegacyQuestionRow[];

      const bankResult = await ensureQuestionBankEntries(serviceClient, documentId, candidateQuestions);
      if (bankResult.available) {
        questionBankAvailable = true;
        const byQuestionId = new Map(bankResult.questions.map((question) => [question.id, question]));
        const activeSession = await getActiveFrozenQuizSession({
          serviceClient,
          userId: user.id,
          documentId,
          mode: "unseen",
        });
        if (activeSession.available && activeSession.session?.question_ids?.length) {
          const frozenIds = new Set(activeSession.session.question_ids as string[]);
          selectedItems = eligibleForReview
            .filter((item) => frozenIds.has(item.question_id))
            .map((item) => ({
              ...item,
              questions: byQuestionId.get(item.question_id) ?? item.questions,
            }))
            .slice(0, requestedSize);
          frozenQuizSessionId = activeSession.session.id;
        } else {
        const unseenQuestions = await selectUnseenQuestionsFirst({
          serviceClient,
          userId: user.id,
          documentId,
          questions: bankResult.questions,
          requestedSize,
        });
        const selectedQuestionIds = new Set(unseenQuestions.map((question) => question.id));
        selectedItems = eligibleForReview
          .filter((item) => selectedQuestionIds.has(item.question_id))
          .map((item) => ({
            ...item,
            questions: byQuestionId.get(item.question_id) ?? item.questions,
          }))
          .slice(0, requestedSize);
        }
      } else {
        console.warn("quiz_engine_path=legacy_fallback reason=question_bank_schema_unavailable", {
          userId: user.id,
          documentId,
        });
      }
    }

    if (selectedItems.length === 0) {
      return NextResponse.json({
        success: true,
        sessionId: null,
        message: questionBankAvailable
          ? "You’ve completed all unique questions currently available for this material."
          : "No items due for review.",
        exhausted: questionBankAvailable,
        modes: questionBankAvailable
          ? ["Practice missed concepts", "Review hardest questions", "Generate deeper applications", "Start a mixed review"]
          : [],
        items: []
      });
    }

    if (questionBankAvailable && !frozenQuizSessionId) {
      const freezeResult = await freezeQuizSession({
        serviceClient,
        userId: user.id,
        documentId,
        questions: selectedItems.map((item) => item.questions).filter(Boolean),
        difficulty: "mixed",
        mode: "unseen",
      });
      if (freezeResult.available) {
        frozenQuizSessionId = freezeResult.quizSessionId;
        // A concurrent tab may have won the insert with a different selection.
        // Always serve the database's frozen IDs and order, never this tab's proposal.
        const byId = new Map(learningItems.map(item => [item.question_id, item]));
        selectedItems = freezeResult.questionIds.map(id => byId.get(id)).filter(Boolean);
        if (selectedItems.length !== freezeResult.questionIds.length) throw new Error("Frozen quiz source unavailable");
      }
    }

    // 4. Create review session
    let sessionInsert: Record<string, any> = {
      user_id: user.id,
      document_id: documentId,
      items_planned: selectedItems.length,
    };
    if (frozenQuizSessionId) {
      sessionInsert = {
        ...sessionInsert,
        quiz_session_id: frozenQuizSessionId,
        question_ids: selectedItems.map((item) => item.question_id),
      };
    }

    let sessionInsertResult = await serviceClient
      .from("learning_review_sessions")
      .insert(sessionInsert)
      .select("id")
      .single();

    if (sessionInsertResult.error && /quiz_session_id|question_ids|column .* does not exist/i.test(sessionInsertResult.error.message || "")) {
      sessionInsertResult = await serviceClient
        .from("learning_review_sessions")
        .insert({
          user_id: user.id,
          document_id: documentId,
          items_planned: selectedItems.length,
        })
        .select("id")
        .single();
    }

    const { data: sessionData, error: sessionError } = sessionInsertResult;

    if (sessionError || !sessionData) {
      throw new Error(`Failed to create review session: ${sessionError?.message}`);
    }

    // Return the selected questions cleanly
    const responseItems = selectedItems.map(item => ({
      learningItemId: item.id,
      questionId: item.question_id,
      questionText: item.questions.question_text,
      options: item.questions.options,
      correctAnswerIndex: item.questions.correct_answer,
      explanation: item.questions.explanation,
      sourceChunkId: item.questions.source_chunk_id,
      state: item.state
    }));

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      quizSessionId: frozenQuizSessionId,
      selectionMode: questionBankAvailable ? "unseen" : "legacy",
      items: responseItems
    });

  } catch (err: any) {
    console.error("Learning Session Error:", err);
    if (isSupabaseAdminConfigError(err)) {
      return NextResponse.json(
        { error: "This operation is temporarily unavailable. Please try again later.", code: SUPABASE_ADMIN_CONFIG_ERROR_CODE },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
