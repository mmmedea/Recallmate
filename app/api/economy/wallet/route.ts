import { NextResponse } from "next/server";
import { getEconomySnapshot } from "@/lib/economy/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [entitlementsResult, economy] = await Promise.all([
    supabase
      .from("user_entitlements")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle(),
    getEconomySnapshot(user.id),
  ]);

  if (entitlementsResult.error || economy.state !== "ok") {
    return NextResponse.json({ error: "Your wallet is temporarily unavailable. Please retry." }, { status: 503 });
  }
  const tier = entitlementsResult.data?.tier ?? "free";
  // Premium is an authoritative server-side entitlement. Do not let a stale
  // browser cookie bypass heart charging or the zero-heart gate.
  const premium = tier === "premium" || tier === "pro";

  return NextResponse.json({ economy, premium });
}
