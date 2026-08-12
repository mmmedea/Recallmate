import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
    }

    // Default to the old password if not set in environment, but ideally set PREMIUM_PASSWORD_HASH or PREMIUM_PASSWORD
    const actualPassword = process.env.PREMIUM_PASSWORD || "030124";

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
      
      // Set an HTTP-Only secure cookie
      response.cookies.set({
        name: "recallmate_premium",
        value: "true",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
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
