import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderReviewerDocx } from "@/lib/renderer/docx";
import { ZodReviewerDocumentSchema } from "@/lib/ai/schemas";
import { timingSafeEqual, createHmac } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) {
      return NextResponse.json({ error: "Renderer authentication is not configured." }, { status: 503 });
    }

    const payloadString = await req.text();
    if (payloadString.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }

    const signature = req.headers.get("x-worker-signature") || "";
    const expected = createHmac("sha256", secret).update(payloadString).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature, "hex"); }
    catch { return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(payloadString); }
    catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }

    const reviewerOutputId = payload?.reviewerOutputId;
    const storagePath = payload?.storagePath;
    const userId = payload?.user_id;
    if (
      payload?.format !== "docx" ||
      typeof reviewerOutputId !== "string" ||
      typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId) ||
      typeof storagePath !== "string" ||
      !storagePath.startsWith(`${userId}/`) ||
      storagePath.includes("..") ||
      storagePath.length > 512
    ) {
      return NextResponse.json({ error: "Invalid render request." }, { status: 400 });
    }

    const reviewerDocument = ZodReviewerDocumentSchema.safeParse(payload.reviewerDocument);
    if (!reviewerDocument.success) {
      return NextResponse.json({ error: "Invalid reviewer document." }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Renderer database is not configured." }, { status: 503 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: output, error: outputError } = await supabase
      .from("reviewer_outputs")
      .select("id, user_id, storage_path")
      .eq("id", reviewerOutputId)
      .eq("user_id", userId)
      .eq("storage_path", storagePath)
      .single();
    if (outputError || !output) {
      return NextResponse.json({ error: "Render output not found." }, { status: 404 });
    }

    const binaryBuffer = await renderReviewerDocx(reviewerDocument.data);
    const { error: uploadError } = await supabase.storage
      .from("reviewers")
      .upload(storagePath, binaryBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (uploadError) throw new Error("Upload failed.");

    const { error: updateError } = await supabase.from("reviewer_outputs").update({
      renderer_version: "1.0",
      layout_version: "1.0",
      file_size: binaryBuffer.byteLength,
    }).eq("id", output.id).eq("user_id", userId);
    if (updateError) throw new Error("Failed to update render record.");

    return NextResponse.json({ success: true, storagePath });
  } catch (error) {
    console.error("[render worker] failed:", error);
    return NextResponse.json({ error: "Renderer failed." }, { status: 500 });
  }
}
