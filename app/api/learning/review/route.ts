import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getNextLearningState, FSRSRating, LearningItemState } from "@/lib/learning/scheduler";

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

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    // 3. Atomically persist the transition and the review ledger row
    const { error: rpcError } = await serviceClient.rpc("process_learning_review", {
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
      p_previous_due_at: itemData.due_at
    });

    if (rpcError) {
      // Supabase UNIQUE constraint violation code for idempotency check (23505)
      if (rpcError.code === '23505') {
        return NextResponse.json({
          success: true,
          message: "Idempotent request: Review already processed.",
          idempotent: true
        });
      }
      throw new Error(`Failed to process review: ${rpcError.message}`);
    }

    return NextResponse.json({
      success: true,
      nextDueAt: newState.due_at,
      scheduledDays
    });

  } catch (err: any) {
    console.error("Submit Review Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
