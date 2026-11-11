import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, assertExpectedProductionSupabaseProject } from "@/lib/supabase-config";
import { getSupabaseServerKey } from "@/lib/supabase-server-key";
import type { Database } from "@/types/supabase";

export const SUPABASE_ADMIN_CONFIG_ERROR_CODE = "ADMIN_SUPABASE_NOT_CONFIGURED";

export class SupabaseAdminConfigError extends Error {
  readonly code = SUPABASE_ADMIN_CONFIG_ERROR_CODE;
  readonly status = 503;

  constructor(message = "Server Supabase secret is not configured.") {
    super(message);
    this.name = "SupabaseAdminConfigError";
  }
}

const adminClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

function getAdminClientUrl() {
  const config = getSupabasePublicConfig();
  if (!config.url) {
    throw new SupabaseAdminConfigError("Missing Supabase URL for admin client.");
  }
  return config.url;
}

function assertServerRuntime() {
  if (process.env.NODE_ENV !== "test" && typeof window !== "undefined") {
    throw new Error("Supabase admin client is server-only");
  }
}

export function isSupabaseAdminConfigured() {
  const config = getSupabasePublicConfig();
  return Boolean(config.url && getSupabaseServerKey());
}

export function isSupabaseAdminConfigError(error: unknown) {
  return error instanceof SupabaseAdminConfigError;
}

export function createSupabaseAdminClient<T = Database>(): SupabaseClient<T> {
  assertServerRuntime();
  assertExpectedProductionSupabaseProject();
  const serverKey = getSupabaseServerKey();
  if (!serverKey) throw new SupabaseAdminConfigError();
  return createClient<T>(getAdminClientUrl(), serverKey, adminClientOptions);
}
