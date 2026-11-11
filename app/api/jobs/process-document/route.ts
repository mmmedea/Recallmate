import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/security";
import { handleExtractText } from "@/lib/workers/extract";
import { handleGenerateNotes } from "@/lib/workers/generateNotes";
import { handleGenerateQuiz } from "@/lib/workers/generateQuiz";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPERATIONS = {
  extract_text: handleExtractText,
  generate_notes: handleGenerateNotes,
  generate_quiz: handleGenerateQuiz,
} as const;

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const { documentId } = await request.json() as { documentId?: string };
    if (!documentId || !/^[0-9a-f-]{36}$/i.test(documentId)) {
      return NextResponse.json({ error: "A valid document is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient<any>();

    const { data: ownedDocument } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ownedDocument) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { data: queued } = await supabase
      .from("ai_jobs")
      .select("*")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!queued) return NextResponse.json({ success: true, processed: [], hasMore: false });

    const { data: claimed } = await supabase
      .from("ai_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", queued.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();
    if (!claimed) return NextResponse.json({ success: true, processed: [], hasMore: true });

    const handler = OPERATIONS[claimed.operation as keyof typeof OPERATIONS];
    if (!handler) {
      await supabase.from("ai_jobs").update({ status: "failed", error_message: "Unsupported study operation." }).eq("id", claimed.id);
      return NextResponse.json({ error: "Unsupported study operation." }, { status: 400 });
    }

    try {
      await handler(supabase, claimed);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Study generation failed.";
      await supabase.from("ai_jobs").update({ status: "failed", error_message: message }).eq("id", claimed.id);
      if (claimed.operation === "extract_text") {
        await supabase.from("documents").update({ status: "failed", error_message: message }).eq("id", documentId);
      }
      return NextResponse.json({ error: message, processed: [] }, { status: 500 });
    }

    const { count } = await supabase
      .from("ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .eq("status", "queued");
    return NextResponse.json({ success: true, processed: [claimed.operation], hasMore: Boolean(count) });
  } catch (cause) {
    const status = typeof cause === "object" && cause && "status" in cause ? Number(cause.status) : 500;
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to start study generation." }, { status });
  }
}
