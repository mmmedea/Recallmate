export const SUPABASE_CONFIG_ERROR =
  "Supabase is not configured correctly. Set NEXT_PUBLIC_SUPABASE_URL to https://<project-ref>.supabase.co and set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export const EXPECTED_PROD_SUPABASE_REF =
  process.env.EXPECTED_PROD_SUPABASE_REF || "eihrsnqqpaafjzhgwxch";

export function isValidSupabaseUrl(value?: string | null) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && /\.supabase\.co$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function getSupabaseProjectRef(value?: string | null) {
  if (!isValidSupabaseUrl(value)) return "";
  try {
    return new URL(value as string).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const projectRef = getSupabaseProjectRef(url);

  return {
    url,
    key,
    projectRef,
    expectedProductionProjectRef: EXPECTED_PROD_SUPABASE_REF,
    isConfigured: isValidSupabaseUrl(url) && key.length > 20,
    productionProjectMatches: projectRef === EXPECTED_PROD_SUPABASE_REF,
  };
}

export function assertExpectedProductionSupabaseProject() {
  if (process.env.NODE_ENV !== "production") return;

  const config = getSupabasePublicConfig();
  if (!config.productionProjectMatches) {
    throw new Error(
      `Production Supabase project mismatch: expected project=${EXPECTED_PROD_SUPABASE_REF}`
    );
  }
}
