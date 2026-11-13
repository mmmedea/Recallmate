import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit } from "@/lib/security";
import { z } from "zod";

export const runtime = "nodejs";

const availabilitySchema = z.object({
  email: z.string().trim().email().max(254),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/),
}).strict();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";

  try {
    await checkRateLimit(`signup-availability:${ip}`, { limit: 12, windowSeconds: 60 });

    const rawBody = await request.json().catch(() => null);
    const parsed = availabilitySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and username." }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const username = parsed.data.username;

    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !url) {
      return NextResponse.json({ code: "service_configuration", error: "Account availability checking is not configured." }, { status: 503 });
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const service = createServiceClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await service.rpc("check_signup_availability", {
      p_email: email,
      p_username: username,
      p_exclude_user_id: user?.id ?? null,
    });
    if (error) throw error;

    const availability = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      emailExists: availability?.email_exists === true,
      usernameExists: availability?.username_exists === true,
    });
  } catch (error: unknown) {
    const failure = error as { status?: unknown; code?: unknown; message?: unknown; name?: unknown };
    const status =
      typeof failure.status === "number" && Number.isInteger(failure.status)
        ? failure.status
        : failure.message === "Rate limit exceeded"
          ? 429
          : 503;
    const message = typeof failure.message === "string" ? failure.message : "Unknown error";
    const code = typeof failure.code === "string" ? failure.code : "unknown";
    const invalidApiKey = /invalid api key|invalid jwt|invalid supabase key/i.test(message);
    const responseCode = invalidApiKey
      ? "service_configuration"
      : status === 429
        ? "rate_limited"
        : "service_unavailable";

    // Keep operational diagnostics useful without logging request emails,
    // usernames, cookies, or any secret key material.
    console.error("[auth] signup availability dependency failed", {
      name: typeof failure.name === "string" ? failure.name : "UnknownError",
      status,
      code,
      message: message.slice(0, 240),
    });

    return NextResponse.json(
      {
        code: responseCode,
        error: invalidApiKey
          ? "The server authentication key is invalid."
          : status === 429
            ? "Too many availability checks. Please wait a minute."
            : "Account availability checking is temporarily unavailable.",
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
