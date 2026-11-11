import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";

const allowedKinds = new Set(["add_five", "refill_to_cap"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!allowedKinds.has(kind)) return NextResponse.json({ error: "Invalid heart purchase." }, { status: 400 });

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : `heart-shop:${user.id}:${kind}:${crypto.randomUUID()}`;

  const { data, error } = await supabase.rpc("purchase_hearts", {
    p_kind: kind,
    p_idempotency_key: idempotencyKey,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, result: data });
}

