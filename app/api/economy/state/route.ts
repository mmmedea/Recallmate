import { NextResponse } from "next/server";
import { getEconomyContext, readEconomyAccount } from "@/lib/economy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getEconomyContext(request);
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const account = await readEconomyAccount(context.admin, context.user.id);
    return NextResponse.json({ account });
  } catch (error) {
    console.error("[economy/state]", error);
    return NextResponse.json({ error: "Unable to load your study rewards." }, { status: 500 });
  }
}
