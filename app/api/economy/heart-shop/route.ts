import { NextResponse } from "next/server";
import { z } from "zod";
import { economyRpc, getEconomyContext, readEconomyAccount } from "@/lib/economy/server";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["add_five", "refill_to_cap"]),
  idempotencyKey: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await getEconomyContext(request);
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid heart purchase." }, { status: 400 });

    const { data, error } = await economyRpc(context.admin, "service_purchase_hearts", {
      p_user_id: context.user.id,
      p_kind: body.data.kind,
      p_idempotency_key: body.data.idempotencyKey,
    });
    if (error) throw error;
    const account = await readEconomyAccount(context.admin, context.user.id);
    return NextResponse.json({ result: data, account });
  } catch (error) {
    console.error("[economy/heart-shop]", error);
    return NextResponse.json({ error: "Unable to complete the heart purchase." }, { status: 400 });
  }
}
