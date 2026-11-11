import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerKey, hasModernSupabaseServerKey, requireSupabaseServerKey } from "@/lib/supabase-server-key";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase server key config", () => {
  it("prefers the new Supabase secret key over the legacy service role key", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_current");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service_role");

    expect(getSupabaseServerKey()).toBe("sb_secret_current");
    expect(hasModernSupabaseServerKey()).toBe(true);
  });

  it("falls back to the legacy service role key during migration", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service_role");

    expect(getSupabaseServerKey()).toBe("legacy_service_role");
    expect(hasModernSupabaseServerKey()).toBe(false);
  });

  it("throws a clear setup error when no server key is configured", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => requireSupabaseServerKey()).toThrow("Missing Supabase server key");
  });
});
