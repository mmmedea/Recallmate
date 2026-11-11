import { NextRequest, NextResponse } from "next/server";
import { getServerAppOrigin } from "@/lib/app-origin";
import { getSupabasePublicConfig } from "@/lib/supabase-config";
import { getSupabaseServerKey, hasModernSupabaseServerKey } from "@/lib/supabase-server-key";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabasePublicConfig();
  const appOrigin = getServerAppOrigin(new URL(request.url).origin);

  return NextResponse.json({
    environment: process.env.NODE_ENV || "development",
    canonicalOrigin: appOrigin,
    supabaseProjectRef: supabase.projectRef || null,
    expectedSupabaseProjectRef: supabase.expectedProductionProjectRef,
    supabaseProjectMatchesExpected: supabase.productionProjectMatches,
    supabaseUrlConfigured: supabase.isConfigured,
    googleAuthConfigured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
    serverKeyConfigured: Boolean(getSupabaseServerKey()),
    serverKeyUsesModernSecret: hasModernSupabaseServerKey(),
  });
}
