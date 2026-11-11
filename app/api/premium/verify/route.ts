import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Sign in first." }, { status: 401 });
    }
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
    }

    const actualPassword = process.env.PREMIUM_PASSWORD;
    if (!actualPassword || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ success: false, message: "Premium activation is temporarily unavailable." }, { status: 503 });
    }

    // Prevent timing attacks by ensuring both strings are the same length before comparison
    // If they aren't, we still do a dummy comparison to take roughly the same amount of time
    const expectedBuffer = Buffer.from(actualPassword);
    const inputBuffer = Buffer.from(password);

    let isMatch = false;
    if (expectedBuffer.length === inputBuffer.length) {
      isMatch = timingSafeEqual(expectedBuffer, inputBuffer);
    } else {
      // Dummy check to mitigate timing attacks on length
      timingSafeEqual(expectedBuffer, expectedBuffer);
    }

    if (isMatch) {
      const response = NextResponse.json({ success: true, message: "Premium unlocked successfully." });
      const admin = createSupabaseAdminClient<any>();
      const { error: entitlementError } = await admin
        .from("user_entitlements")
        .upsert({ user_id: user.id, tier: "premium" }, { onConflict: "user_id" });
      if (entitlementError) {
        return NextResponse.json({ success: false, message: "Could not save Premium activation. Please retry." }, { status: 503 });
      }
      
      // Set an HTTP-Only secure cookie
      response.cookies.set({
        name: "recallmate_premium",
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    } else {
      return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 });
    }
  } catch (error) {
    console.error("Premium verify error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
