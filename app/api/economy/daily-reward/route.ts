import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";
import { getEconomySnapshot } from "@/lib/economy/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : `daily-reward:${user.id}:${crypto.randomUUID()}`;

  const { data, error } = await supabase.rpc("claim_daily_reward", {
    p_idempotency_key: idempotencyKey,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const economy = await getEconomySnapshot(user.id);
  return NextResponse.json({ success: true, result: data, economy });
}
