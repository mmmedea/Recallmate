export function getSupabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function hasModernSupabaseServerKey() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function requireSupabaseServerKey() {
  const key = getSupabaseServerKey();
  if (!key) {
    throw new Error("Missing Supabase server key");
  }
  return key;
}
