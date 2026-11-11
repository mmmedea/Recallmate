import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import {
  SUPABASE_ADMIN_CONFIG_ERROR_CODE,
  createSupabaseAdminClient,
  isSupabaseAdminConfigError,
} from "@/lib/supabase/admin";
import { getEconomySnapshot } from "@/lib/economy/server";

export const runtime = "nodejs";

const RequestSchema = z.object({
  requestId: z.string().uuid(),
}).strict();

/**
 * Charges a free user one heart for a wrong answer in the legacy quiz UI.
 * The actual balance mutation happens only in the service-only, idempotent
 * database function; the browser never writes economy state directly.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const token = request.headers.get("authorization")?.split("Bearer ")[1];
    const { data: { user }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    const serviceClient = createSupabaseAdminClient<any>();
    const { data: entitlement, error: entitlementError } = await serviceClient
      .from("user_entitlements")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entitlementError) {
      throw new Error(`Could not verify quiz entitlement: ${entitlementError.message}`);
    }

    const premium = entitlement?.tier === "premium" || entitlement?.tier === "pro";
    if (premium) {
      const economy = await getEconomySnapshot(user.id);
      return NextResponse.json({
        success: true,
        result: {
          status: "premium_exempt",
          hearts: economy.hearts,
          heartCap: economy.heartCap,
          heartsDelta: 0,
        },
      });
    }

    const { data, error } = await serviceClient.rpc("consume_quiz_heart", {
      p_user_id: user.id,
      p_idempotency_key: `quiz-wrong-answer:${parsed.data.requestId}`,
    });

    if (error) {
      if (/No hearts remaining/i.test(error.message)) {
        return NextResponse.json({ error: "No hearts remaining.", code: "NO_HEARTS" }, { status: 409 });
      }
      throw new Error(`Could not update quiz hearts: ${error.message}`);
    }

    return NextResponse.json({ success: true, result: data });
  } catch (error) {
    console.error("Quiz heart debit error:", error);
    if (isSupabaseAdminConfigError(error)) {
      return NextResponse.json(
        { error: "This operation is temporarily unavailable. Please try again later.", code: SUPABASE_ADMIN_CONFIG_ERROR_CODE },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not update quiz hearts. Please try again." }, { status: 500 });
  }
}
