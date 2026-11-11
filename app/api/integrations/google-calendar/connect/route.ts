import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyGoogleOAuthProvider } from "@/lib/integrations/google-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before connecting Google Calendar." }, { status: 401 });

  const callback = new URL("/auth/callback", requestUrl.origin);
  callback.searchParams.set("integration", "google-calendar");
  callback.searchParams.set("next", "/calendar");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      scopes: "openid email profile https://www.googleapis.com/auth/calendar.events",
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message || "Google Calendar could not start the connection." }, { status: 503 });
  }

  try {
    await verifyGoogleOAuthProvider(data.url);
    return NextResponse.json({ url: data.url });
  } catch (providerError) {
    return NextResponse.json({ error: providerError instanceof Error ? providerError.message : "Google Calendar is unavailable." }, { status: 503 });
  }
}
