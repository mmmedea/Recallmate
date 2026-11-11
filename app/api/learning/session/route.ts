import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

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

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    const selectedItems = eligibleForReview.slice(0, requestedSize);

    if (selectedItems.length === 0) {
      return NextResponse.json({
        success: true,
        sessionId: null,
        message: "No items due for review.",
        items: []
      });
    }

    // 4. Create review session
    const { data: sessionData, error: sessionError } = await serviceClient
      .from("learning_review_sessions")
      .insert({
        user_id: user.id,
        document_id: documentId,
        items_planned: selectedItems.length
      })
      .select("id")
      .single();

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
      items: responseItems
    });

  } catch (err: any) {
    console.error("Learning Session Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
