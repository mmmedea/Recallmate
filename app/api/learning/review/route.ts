import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { getNextLearningState, FSRSRating, LearningItemState } from "@/lib/learning/scheduler";
import { SUPABASE_ADMIN_CONFIG_ERROR_CODE, createSupabaseAdminClient, isSupabaseAdminConfigError } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SubmitReviewRequestSchema = z.object({
  learningItemId: z.string().uuid(),
  reviewSessionId: z.string().uuid().optional(),
  requestId: z.string().uuid(), // Idempotency key
  wasCorrect: z.boolean(),
  // Optional explicitly provided rating. If null, we infer from wasCorrect
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional()
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
    const parsed = SubmitReviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request format", details: parsed.error.issues }, { status: 400 });
    }
    const { learningItemId, reviewSessionId, requestId, wasCorrect, rating: explicitRating } = parsed.data;

    // Infer rating if not provided
    // Again = 1, Good = 3
    const finalRating: FSRSRating = explicitRating ?? (wasCorrect ? 3 : 1);

    const serviceClient = createSupabaseAdminClient<any>();

    // 1. Fetch the current state of the learning item to calculate the next state
    const { data: itemData, error: itemError } = await serviceClient
      .from("learning_items")
      .select("*")
      .eq("id", learningItemId)
      .eq("user_id", user.id)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json({ error: "Learning item not found or unauthorized" }, { status: 404 });
    }

    const currentState: LearningItemState = {
      state: itemData.state,
      due_at: new Date(itemData.due_at),
      stability: itemData.stability,
      difficulty: itemData.difficulty,
      reps: itemData.reps,
      lapses: itemData.lapses,
      last_reviewed_at: itemData.last_reviewed_at ? new Date(itemData.last_reviewed_at) : null
    };

    // 2. Run the scheduler logic
    const { newState, scheduledDays } = getNextLearningState(currentState, finalRating);

    // Premium is authoritative in the entitlement table. The browser cannot
    // opt out of a debit, and a free user's wrong answer is charged inside the
    // same database transaction as the FSRS transition.
    const { data: entitlement, error: entitlementError } = await serviceClient
      .from("user_entitlements")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle();
    if (entitlementError) {
      throw new Error(`Could not verify quiz entitlement: ${entitlementError.message}`);
    }
    const premium = entitlement?.tier === "premium" || entitlement?.tier === "pro";

    // 3. Atomically persist the transition and (for a free wrong answer) the
    // heart ledger entry. The RPC also owns request-id idempotency, including
    // retries from older deployments that already wrote the review row.
    const { data: reviewResult, error: rpcError } = await serviceClient.rpc("process_learning_review_with_heart", {
      p_user_id: user.id,
      p_learning_item_id: learningItemId,
      p_request_id: requestId,
      p_review_session_id: reviewSessionId || null,
      p_state: newState.state,
      p_due_at: newState.due_at.toISOString(),
      p_stability: newState.stability,
      p_difficulty: newState.difficulty,
      p_reps: newState.reps,
      p_lapses: newState.lapses,
      p_rating: finalRating,
      p_was_correct: wasCorrect,
      p_scheduled_days: scheduledDays,
      p_previous_due_at: itemData.due_at,
      p_consume_heart: !premium,
    });

    if (rpcError) {
      if (/No hearts remaining/i.test(rpcError.message)) {
        return NextResponse.json({ error: "No hearts remaining.", code: "NO_HEARTS" }, { status: 409 });
      }
      throw new Error(`Failed to process review: ${rpcError.message}`);
    }

    // The RPC also completes the frozen quiz attempt. Never perform a second
    // persistence step after committing a heart debit.
    if (!Number.isInteger(reviewResult?.hearts) || !Number.isInteger(reviewResult?.heartCap)) {
      throw new Error("Review RPC returned no authoritative wallet");
    }

    return NextResponse.json({
      success: true,
      idempotent: reviewResult?.status === "already_processed",
      nextDueAt: newState.due_at,
      scheduledDays,
      premium: reviewResult.premium ?? premium,
      economy: {
        hearts: reviewResult.hearts,
        heartCap: reviewResult.heartCap,
        heartsDelta: Number(reviewResult?.heartsDelta ?? 0),
      },
    });

  } catch (err: any) {
    console.error("Submit Review Error:", err);
    if (isSupabaseAdminConfigError(err)) {
      return NextResponse.json(
        { error: "This operation is temporarily unavailable. Please try again later.", code: SUPABASE_ADMIN_CONFIG_ERROR_CODE },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not save your answer. Please retry the same answer." }, { status: 500 });
  }
}
