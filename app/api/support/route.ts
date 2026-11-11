import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const supportRequestSchema = z.object({
  type: z.enum(["feedback", "report"]),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(10).max(4000),
}).strict();

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

async function sendSupportEmail(input: { type: "feedback" | "report"; subject: string; message: string; userEmail: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.RECALLMATE_SUPPORT_EMAIL;
  const sender = process.env.RECALLMATE_SUPPORT_FROM_EMAIL;
  if (!apiKey || !recipient || !sender) return { delivered: false, configured: false };

  const label = input.type === "feedback" ? "User Feedback" : "User Report";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      reply_to: input.userEmail,
      subject: `[RecallMate ${label}] ${input.subject}`,
      html: `<h1>RecallMate ${label}</h1><p><strong>From:</strong> ${escapeHtml(input.userEmail)}</p><p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p><hr><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    }),
  });
  return { delivered: response.ok, configured: true };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) return NextResponse.json({ error: "Sign in before contacting support." }, { status: 401 });

  let payload: z.infer<typeof supportRequestSchema>;
  try {
    payload = supportRequestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: "Enter a valid subject and a message of at least 10 characters.", details: error instanceof z.ZodError ? error.issues : undefined }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: "RecallMate support is not configured." }, { status: 503 });
  const admin = createSupabaseAdminClient<any>();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("support_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", oneHourAgo);
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "You've sent several messages recently. Please try again in an hour." }, { status: 429 });

  const { data: submission, error: insertError } = await admin.from("support_submissions").insert({
    user_id: user.id,
    user_email: user.email,
    type: payload.type,
    subject: payload.subject,
    message: payload.message,
  }).select("id").single();
  if (insertError || !submission) {
    console.error("Support submission insert failed", insertError);
    return NextResponse.json({ error: "We couldn't send your message. Please try again." }, { status: 500 });
  }

  try {
    const delivery = await sendSupportEmail({ ...payload, userEmail: user.email });
    if (delivery.configured) {
      await admin.from("support_submissions").update({ delivery_status: delivery.delivered ? "emailed" : "email_failed" }).eq("id", submission.id);
    }
    if (delivery.configured && !delivery.delivered) {
      return NextResponse.json({ error: "Your message was saved, but email delivery failed. RecallMate support can still review it." }, { status: 502 });
    }
    return NextResponse.json({ success: true, delivered: delivery.delivered, received: true });
  } catch (error) {
    console.error("Support email delivery failed", error);
    await admin.from("support_submissions").update({ delivery_status: "email_failed" }).eq("id", submission.id);
    return NextResponse.json({ error: "Your message was saved, but email delivery failed. RecallMate support can still review it." }, { status: 502 });
  }
}
