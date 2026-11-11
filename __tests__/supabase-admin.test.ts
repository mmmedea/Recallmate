import { afterEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { SUPABASE_ADMIN_CONFIG_ERROR_CODE, SupabaseAdminConfigError, createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Supabase admin client", () => {
  it("reports admin config only when URL and server key are present", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://eihrsnqqpaafjzhgwxch.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(isSupabaseAdminConfigured()).toBe(false);

    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_current");
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("throws a typed 503 setup error when the server secret is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://eihrsnqqpaafjzhgwxch.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubGlobal("window", undefined);

    try {
      createSupabaseAdminClient();
      throw new Error("Expected createSupabaseAdminClient to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseAdminConfigError);
      expect((error as SupabaseAdminConfigError).code).toBe(SUPABASE_ADMIN_CONFIG_ERROR_CODE);
      expect((error as SupabaseAdminConfigError).status).toBe(503);
    }
  });

  it("creates a server-only admin client with the modern secret key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://eihrsnqqpaafjzhgwxch.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-with-enough-length");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_current");

    createSupabaseAdminClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://eihrsnqqpaafjzhgwxch.supabase.co",
      "sb_secret_current",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );
  });

  it("blocks production admin clients pointed at the non-canonical Supabase project", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://dzyopanccqqoqtumkoxm.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-with-enough-length");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_current");
    vi.stubGlobal("window", undefined);

    expect(() => createSupabaseAdminClient()).toThrow(/Production Supabase project mismatch/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("blocks admin client creation in browser-like runtimes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://eihrsnqqpaafjzhgwxch.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-with-enough-length");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_current");
    vi.stubGlobal("window", {});

    expect(() => createSupabaseAdminClient()).toThrow("Supabase admin client is server-only");
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
