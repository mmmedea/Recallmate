import { createClient as createServerSupabaseClient } from "@/utils/supabase/server";
import type { User } from "@supabase/supabase-js";

type EconomyAdmin = { url: string; apiKey: string };
export type EconomyContext = { admin: EconomyAdmin; user: User };

export async function getEconomyContext(_request: Request): Promise<EconomyContext | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer the current opaque secret key. Send it as apikey only. Supabase's
  // gateway translates it to the service_role JWT; using it as a Bearer token
  // causes Invalid JWT responses.
  const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apiKey) throw new Error("Economy service credentials are not configured.");

  return { admin: { url: url.replace(/\/$/, ""), apiKey }, user: data.user };
}

async function serviceRequest<T>(admin: EconomyAdmin, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(\`\${admin.url}/rest/v1/\${path}\`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: admin.apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(\`Economy database request failed (\${response.status}): \${text.slice(0, 500)}\`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function economyRpc<T = unknown>(
  admin: EconomyAdmin,
  functionName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const allowed = new Set([
    "ensure_economy_account",
    "service_claim_daily_reward",
    "service_restore_streak",
    "service_purchase_hearts",
  ]);
  if (!allowed.has(functionName)) throw new Error("Unsupported economy operation.");
  return serviceRequest<T>(admin, \`rpc/\${functionName}\`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function readEconomyAccount(admin: EconomyAdmin, userId: string) {
  const ensured = await economyRpc<Array<{
    study_day: string | null;
    restore_cost_coins: number | null;
  }>>(admin, "ensure_economy_account", { p_user_id: userId });

  const rows = await serviceRequest<Array<{
    coins: number;
    hearts: number;
    heart_cap: number;
    current_streak: number;
    longest_streak: number;
    last_claimed_day: string | null;
    restore_available_for: string | null;
  }>>(
    admin,
    \`economy_accounts?select=coins,hearts,heart_cap,current_streak,longest_streak,last_claimed_day,restore_available_for&user_id=eq.\${encodeURIComponent(userId)}\`,
  );
  const account = rows[0];
  if (!account) throw new Error("Economy account was not found for the signed-in user.");

  return {
    ...account,
    study_day: ensured?.[0]?.study_day ?? null,
    restore_cost_coins: ensured?.[0]?.restore_cost_coins ?? 200,
  };
}
