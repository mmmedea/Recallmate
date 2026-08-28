import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function safeInternalPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination = safeInternalPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const username = user?.user_metadata?.username;

  // Google can authenticate an identity, but it cannot bypass creation of the
  // student's RecallMate profile. New social users must finish onboarding.
  if (!username || typeof username !== "string" || username.trim().length < 3) {
    const onboarding = new URL("/onboarding", url.origin);
    onboarding.searchParams.set("next", destination);
    return NextResponse.redirect(onboarding);
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
