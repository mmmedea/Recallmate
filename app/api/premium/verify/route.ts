import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { checkRateLimit } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-real-ip")?.trim()
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";
    await checkRateLimit(`premium-verify:${ip}`, { limit: 5, windowSeconds: 60 });

    const configuredPassword = process.env.PREMIUM_PASSWORD;
    if (!configuredPassword || configuredPassword.length < 12) {
      return NextResponse.json({ success: false, message: "Premium password verification is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const password = body?.password;
    if (typeof password !== "string" || password.length < 1 || password.length > 256) {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
    }

    const expected = Buffer.from(configuredPassword);
    const supplied = Buffer.from(password);
    const isMatch = expected.length === supplied.length && timingSafeEqual(expected, supplied);

    if (!isMatch) {
      return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 });
    }

    // This cookie is only a UI hint. Protected server routes must enforce
    // user_entitlements through requireEntitlement(), never trust this cookie.
    const response = NextResponse.json({ success: true, message: "Premium access code accepted." });
    response.cookies.set({
      name: "recallmate_premium",
      value: "true",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error: any) {
    const status = Number.isInteger(error?.status) ? error.status : error?.message === "Rate limit exceeded" ? 429 : 500;
    if (status >= 500) console.error("Premium verification failed:", error);
    return NextResponse.json({ success: false, message: status === 429 ? "Too many attempts. Please try again later." : status === 503 ? "Premium verification is temporarily unavailable." : "Internal server error" }, { status });
  }
}
