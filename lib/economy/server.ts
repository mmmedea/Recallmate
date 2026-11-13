import { createClient as createServerSupabaseClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type EconomyContext = {
  admin: SupabaseClient;
  user: User;
};

/**
 * Authenticate economy requests with the same HttpOnly Supabase session cookies
 * used by the rest of the App Router. This avoids relying on a client-side
 * getSession() token being manually copied into an Authorization header.
 */
export async function getEconomyContext(_request: Request): Promise<EconomyContext | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Economy service is not configured.");

  const admin = createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { admin, user: data.user };
}

export async function readEconomyAccount(admin: SupabaseClient, userId: string) {
  const { data: ensured, error: ensureError } = await admin.rpc("ensure_economy_account", {
    p_user_id: userId,
  });
  if (ensureError) throw ensureError;

  const { data: account, error } = await admin
    .from("economy_accounts")
    .select("coins,hearts,heart_cap,current_streak,longest_streak,last_claimed_day,restore_available_for")
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  const ensureRow = Array.isArray(ensured) ? ensured[0] : ensured;
  return {
    ...account,
    study_day: ensureRow?.study_day ?? null,
    restore_cost_coins: ensureRow?.restore_cost_coins ?? 200,
  };
}
