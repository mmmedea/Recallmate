import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { RECALLMATE_PRODUCTION_ORIGIN, getServerAppOrigin } from "@/lib/app-origin";
import { AUTH_FLOW_COOKIE, createAuthFlowId, logAuthEvent } from "@/lib/auth-diagnostics";
import { safeAuthenticatedNextPath } from "@/lib/auth-safe-next";
import { assertGoogleOAuthUrlIsSafe } from "@/lib/integrations/google-oauth";
import { assertExpectedProductionSupabaseProject, getSupabasePublicConfig } from "@/lib/supabase-config";

function productionSafeOAuthOrigin(requestOrigin: string) {
  const origin = getServerAppOrigin(requestOrigin);
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin) ? RECALLMATE_PRODUCTION_ORIGIN : origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeAuthenticatedNextPath(requestUrl.searchParams.get("next"));
  const callback = new URL("/auth/callback", productionSafeOAuthOrigin(requestUrl.origin));
  callback.searchParams.set("next", next);
  const authFlowId = createAuthFlowId();

  logAuthEvent("oauth_started", {
    authFlowId,
    host: requestUrl.host,
    redirectTo: callback.origin + callback.pathname,
    purpose: "sign-in",
  });

  try {
    assertExpectedProductionSupabaseProject();
  } catch (configError) {
    logAuthEvent("oauth_start_failed", {
      authFlowId,
      purpose: "sign-in",
      reason: configError instanceof Error ? configError.message : "supabase_project_mismatch",
      supabaseProjectRef: getSupabasePublicConfig().projectRef,
    });
    const login = new URL("/login", RECALLMATE_PRODUCTION_ORIGIN);
    login.searchParams.set("error", "google_oauth_setup_mismatch");
    return NextResponse.redirect(login, 303);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    logAuthEvent("oauth_start_failed", {
      authFlowId,
      purpose: "sign-in",
      reason: error?.message || "missing_provider_url",
    });
    const login = new URL("/login", RECALLMATE_PRODUCTION_ORIGIN);
    login.searchParams.set("error", "google_oauth_start_failed");
    return NextResponse.redirect(login, 303);
  }

  try {
    assertGoogleOAuthUrlIsSafe(data.url, {
      purpose: "sign-in",
      featureLabel: "Google sign-in",
    });
    const response = NextResponse.redirect(data.url, 303);
    response.cookies.set(AUTH_FLOW_COOKIE, authFlowId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (providerError) {
    logAuthEvent("oauth_start_failed", {
      authFlowId,
      purpose: "sign-in",
      reason: providerError instanceof Error ? providerError.message : "provider_verification_failed",
    });
    const login = new URL("/login", RECALLMATE_PRODUCTION_ORIGIN);
    login.searchParams.set("error", "google_oauth_start_failed");
    return NextResponse.redirect(login, 303);
  }
}
