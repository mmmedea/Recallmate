import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { syncEventsToGoogle, type GoogleSyncEvent } from "@/lib/integrations/google-calendar";

function safeInternalPath(value: string | null) {
  // OAuth must finish inside RecallMate, not send authenticated users back to
  // the public marketing homepage or another auth endpoint.
  const isInternalAppPath =
    Boolean(value) &&
    value!.startsWith("/") &&
    value !== "/" &&
    !value!.startsWith("//") &&
    !value!.startsWith("/login") &&
    !value!.startsWith("/signup") &&
    !value!.startsWith("/auth/");
  return isInternalAppPath ? value! : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination = safeInternalPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));
  }

  const supabase = await createClient();
  const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !exchange.session) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const username = user?.user_metadata?.username;
  const accountCompleted = user?.user_metadata?.recallmate_account_completed === true;

  // Google can authenticate an identity, but it cannot bypass creation of the
  // student's RecallMate profile. New social users must finish onboarding.
  if (!username || typeof username !== "string" || username.trim().length < 3 || !accountCompleted) {
    const onboarding = new URL("/onboarding", url.origin);
    onboarding.searchParams.set("next", destination);
    return NextResponse.redirect(onboarding);
  }

  if (url.searchParams.get("integration") === "google-calendar") {
    const resultUrl = new URL("/calendar", url.origin);
    try {
      if (!exchange.session.provider_token || !user) throw new Error("Google did not provide Calendar access");
      const service = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: events, error: eventsError } = await service
        .from("calendar_events")
        .select("id,title,description,starts_at,ends_at,all_day,event_type,priority,google_event_id")
        .eq("user_id", user.id)
        .order("starts_at");
      if (eventsError) throw eventsError;

      const sync = await syncEventsToGoogle({
        accessToken: exchange.session.provider_token,
        events: (events ?? []) as GoogleSyncEvent[],
      });
      for (const mapping of sync.mappings) {
        const { error: updateError } = await service
          .from("calendar_events")
          .update({ google_event_id: mapping.googleEventId, google_synced_at: new Date().toISOString() })
          .eq("id", mapping.recallmateEventId)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
      }
      resultUrl.searchParams.set("google", "connected");
      resultUrl.searchParams.set("synced", String(sync.synced));
    } catch (syncError) {
      console.error("Google Calendar sync failed:", syncError instanceof Error ? syncError.message : "Unknown error");
      resultUrl.searchParams.set("google", "error");
    }
    return NextResponse.redirect(resultUrl);
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
