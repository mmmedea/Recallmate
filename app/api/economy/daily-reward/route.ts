import { NextResponse } from "next/server";
import { z } from "zod";
import { getEconomyContext, readEconomyAccount } from "@/lib/economy/server";

export const runtime = "nodejs";

const schema = z.object({ idempotencyKey: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    const context = await getEconomyContext(request);
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid reward request." }, { status: 400 });

    const { data, error } = await context.admin.rpc("service_claim_daily_reward", {
      p_user_id: context.user.id,
      p_idempotency_key: body.data.idempotencyKey,
    });
    if (error) throw error;
    const account = await readEconomyAccount(context.admin, context.user.id);
    return NextResponse.json({ result: data, account });
  } catch (error) {
    console.error("[economy/daily-reward]", error);
    return NextResponse.json({ error: "Unable to claim today's reward." }, { status: 400 });
  }
}
