import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertExpectedProductionSupabaseProject,
  getSupabaseProjectRef,
  getSupabasePublicConfig,
  isValidSupabaseUrl,
} from "@/lib/supabase-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase public config", () => {
  it("accepts only Supabase project URLs", () => {
    expect(isValidSupabaseUrl("https://abc123.supabase.co")).toBe(true);
    expect(isValidSupabaseUrl("http://127.0.0.1:54321")).toBe(false);
    expect(isValidSupabaseUrl("eyJhbGciOiJIUzI1NiJ9")).toBe(false);
  });

  it("extracts the non-secret Supabase project ref from the configured URL", () => {
    expect(getSupabaseProjectRef("https://eihrsnqqpaafjzhgwxch.supabase.co")).toBe("eihrsnqqpaafjzhgwxch");
  });

  it("prefers the publishable key when present", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc123.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-with-enough-length");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-with-enough-length");

    expect(getSupabasePublicConfig()).toMatchObject({
      url: "https://abc123.supabase.co",
      key: "publishable-key-with-enough-length",
      projectRef: "abc123",
      isConfigured: true,
    });
  });

  it("fails loudly in production when the configured project ref is not the expected project", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://dzyopanccqqoqtumkoxm.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-with-enough-length");

    expect(() => assertExpectedProductionSupabaseProject()).toThrow(
      /Production Supabase project mismatch: expected project=eihrsnqqpaafjzhgwxch/
    );
  });
});
