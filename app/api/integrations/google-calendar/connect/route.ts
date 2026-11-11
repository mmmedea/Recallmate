import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { RECALLMATE_PRODUCTION_ORIGIN, getServerAppOrigin } from "@/lib/app-origin";
import { AUTH_FLOW_COOKIE, createAuthFlowId, logAuthEvent } from "@/lib/auth-diagnostics";
import { GOOGLE_CALENDAR_SYNC_SCOPE } from "@/lib/integrations/google-calendar";
import { assertGoogleOAuthUrlIsSafe } from "@/lib/integrations/google-oauth";
import { assertExpectedProductionSupabaseProject, getSupabasePublicConfig } from "@/lib/supabase-config";

function productionSafeOAuthOrigin(requestOrigin: string) {
  const origin = getServerAppOrigin(requestOrigin);
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin) ? RECALLMATE_PRODUCTION_ORIGIN : origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", productionSafeOAuthOrigin(requestUrl.origin));
    login.searchParams.set("next", "/calendar");
    login.searchParams.set("error", "signin_required");
    return NextResponse.redirect(login, 303);
  }

  const callback = new URL("/auth/callback", productionSafeOAuthOrigin(requestUrl.origin));
  callback.searchParams.set("integration", "google-calendar");
  callback.searchParams.set("next", "/calendar");
  const authFlowId = createAuthFlowId();

  logAuthEvent("oauth_started", {
    authFlowId,
    host: requestUrl.host,
    redirectTo: callback.origin + callback.pathname,
    purpose: "calendar-sync",
  });

  try {
    assertExpectedProductionSupabaseProject();
  } catch (configError) {
    logAuthEvent("oauth_start_failed", {
      authFlowId,
      purpose: "calendar-sync",
      reason: configError instanceof Error ? configError.message : "supabase_project_mismatch",
      supabaseProjectRef: getSupabasePublicConfig().projectRef,
    });
    const resultUrl = new URL("/calendar", productionSafeOAuthOrigin(requestUrl.origin));
    resultUrl.searchParams.set("google", "error");
    resultUrl.searchParams.set("reason", "setup");
    return NextResponse.redirect(resultUrl, 303);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      scopes: `openid email profile ${GOOGLE_CALENDAR_SYNC_SCOPE}`,
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    logAuthEvent("oauth_start_failed", {
      authFlowId,
      purpose: "calendar-sync",
      reason: error?.message || "missing_provider_url",
    });
    const resultUrl = new URL("/calendar", productionSafeOAuthOrigin(requestUrl.origin));
    resultUrl.searchParams.set("google", "error");
    resultUrl.searchParams.set("reason", "setup");
    return NextResponse.redirect(resultUrl, 303);
  }

  try {
    assertGoogleOAuthUrlIsSafe(data.url, {
      purpose: "calendar-sync",
      featureLabel: "Google Calendar",
      requiredScopes: [GOOGLE_CALENDAR_SYNC_SCOPE],
      allowedCalendarScopes: [GOOGLE_CALENDAR_SYNC_SCOPE],
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
      purpose: "calendar-sync",
      reason: providerError instanceof Error ? providerError.message : "provider_verification_failed",
    });
    const resultUrl = new URL("/calendar", productionSafeOAuthOrigin(requestUrl.origin));
    resultUrl.searchParams.set("google", "error");
    resultUrl.searchParams.set("reason", "setup");
    return NextResponse.redirect(resultUrl, 303);
  }
}
