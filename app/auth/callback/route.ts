import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getServerAppOrigin } from "@/lib/app-origin";
import { safeAuthenticatedNextPath } from "@/lib/auth-safe-next";
import { AUTH_FLOW_COOKIE, logAuthEvent } from "@/lib/auth-diagnostics";
import { syncEventsToGoogle, type GoogleSyncEvent } from "@/lib/integrations/google-calendar";

function safeInternalPath(value: string | null) {
  return safeAuthenticatedNextPath(value);
}

function clearAuthFlowCookie(response: NextResponse) {
  response.cookies.set(AUTH_FLOW_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}

function readCookieFromRequest(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  const pair = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  return decodeURIComponent(pair.slice(name.length + 1));
}

function redirectToLoginError(appOrigin: string, errorCode: string) {
  const login = new URL("/login", appOrigin);
  login.searchParams.set("error", errorCode);
  return clearAuthFlowCookie(NextResponse.redirect(login));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = getServerAppOrigin(url.origin);
  const code = url.searchParams.get("code");
  const integration = url.searchParams.get("integration") || "sign-in";
  const destination = safeInternalPath(url.searchParams.get("next"));
  const authFlowId = readCookieFromRequest(request, AUTH_FLOW_COOKIE) || "missing";

  logAuthEvent("callback_received", {
    authFlowId,
    host: url.host,
    hasCode: Boolean(code),
    integration,
  });

  if (!code) {
    return redirectToLoginError(appOrigin, "missing_oauth_code");
  }

  const supabase = await createClient();
  const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !exchange.session) {
    logAuthEvent("code_exchange_failed", {
      authFlowId,
      integration,
      message: error?.message || "No session returned from OAuth exchange.",
    });
    return redirectToLoginError(appOrigin, "google_auth_failed");
  }

  logAuthEvent("code_exchange_succeeded", { authFlowId, integration });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  logAuthEvent("session_user_resolved", { authFlowId, integration, authenticated: Boolean(user) });
  const username = user?.user_metadata?.username;
  const accountCompleted = user?.user_metadata?.recallmate_account_completed === true;

  // Google can authenticate an identity, but it cannot bypass creation of the
  // student's RecallMate profile. New social users must finish onboarding.
  if (!username || typeof username !== "string" || username.trim().length < 3 || !accountCompleted) {
    const onboarding = new URL("/onboarding", appOrigin);
    onboarding.searchParams.set("next", destination);
    return clearAuthFlowCookie(NextResponse.redirect(onboarding));
  }

  if (url.searchParams.get("integration") === "google-calendar") {
    const resultUrl = new URL("/calendar", appOrigin);
    try {
      if (!exchange.session.provider_token || !user) throw new Error("Google did not provide Calendar access");
      logAuthEvent("calendar_sync_started", { authFlowId });
      const { data: events, error: eventsError } = await supabase
        .from("calendar_events")
        .select("id,title,description,starts_at,ends_at,all_day,event_type,priority,google_calendar_id,google_event_id")
        .eq("user_id", user.id)
        .order("starts_at");
      if (eventsError) throw eventsError;

      const sync = await syncEventsToGoogle({
        accessToken: exchange.session.provider_token,
        events: (events ?? []) as GoogleSyncEvent[],
      });
      for (const mapping of sync.mappings) {
        const { error: updateError } = await supabase
          .from("calendar_events")
          .update({ google_calendar_id: mapping.googleCalendarId, google_event_id: mapping.googleEventId, google_synced_at: new Date().toISOString() })
          .eq("id", mapping.recallmateEventId)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
      }
      logAuthEvent("calendar_sync_succeeded", { authFlowId, synced: sync.synced });
      resultUrl.searchParams.set("google", "connected");
      resultUrl.searchParams.set("synced", String(sync.synced));
    } catch (syncError) {
      logAuthEvent("calendar_sync_failed", {
        authFlowId,
        reason: syncError instanceof Error ? syncError.message : "Unknown error",
      });
      console.error("Google Calendar sync failed:", syncError instanceof Error ? syncError.message : "Unknown error");
      resultUrl.searchParams.set("google", "error");
      resultUrl.searchParams.set(
        "reason",
        syncError instanceof Error && /permission|access|calendar/i.test(syncError.message)
          ? "permission"
          : "sync",
      );
    }
    return clearAuthFlowCookie(NextResponse.redirect(resultUrl));
  }

  return clearAuthFlowCookie(NextResponse.redirect(new URL(destination, appOrigin)));
}
