import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const errorSchema = z.object({
  name: z.string().max(100).optional(),
  message: z.string().max(1000).optional(),
  digest: z.string().max(200).optional(),
  stack: z.string().max(5000).optional(),
}).strict();

function redact(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "[supabase-key]")
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token]");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8000) return NextResponse.json({ ok: false }, { status: 413 });

  const body = await request.json().catch(() => null);
  const parsed = errorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const details = {
    name: parsed.data.name ?? "Error",
    message: redact(parsed.data.message ?? "No message"),
    digest: parsed.data.digest ?? "none",
    stack: redact(parsed.data.stack ?? "").slice(0, 5000),
    path: request.nextUrl.pathname,
  };
  console.error("[auth-boundary-diagnostic]", details);
  return new NextResponse(null, { status: 204 });
}
