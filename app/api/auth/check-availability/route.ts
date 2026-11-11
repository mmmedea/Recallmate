import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 12;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many availability checks. Please wait a minute." }, { status: 429 });
  }

  try {
    const body = await request.json() as { email?: string; username?: string };
    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json({ error: "Enter a valid email and username." }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "Account availability checking is temporarily unavailable." }, { status: 503 });
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const service = createSupabaseAdminClient<any>();
    const { data, error } = await service.rpc("check_signup_availability", {
      p_email: email,
      p_username: username,
      p_exclude_user_id: user?.id ?? null,
    });
    if (error) throw error;

    const availability = Array.isArray(data) ? data[0] : data;
    // Email existence is intentionally not returned to unauthenticated clients.
    // Signup uses this endpoint only to validate username availability; Supabase
    // Auth handles email OTP requests without exposing account membership.
    return NextResponse.json({
      usernameExists: availability?.username_exists === true,
    });
  } catch (error) {
    console.error("Signup availability check failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Account availability checking is temporarily unavailable." }, { status: 503 });
  }
}
