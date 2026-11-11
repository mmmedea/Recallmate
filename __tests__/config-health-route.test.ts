import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/config-health/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("internal config health route", () => {
  it("returns only non-secret Supabase and auth configuration status", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://eihrsnqqpaafjzhgwxch.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-with-enough-length");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_do_not_return");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recallmate-ai.vercel.app");

    const response = await GET(new Request("https://recallmate-ai.vercel.app/api/internal/config-health") as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      canonicalOrigin: "https://recallmate-ai.vercel.app",
      supabaseProjectRef: "eihrsnqqpaafjzhgwxch",
      expectedSupabaseProjectRef: "eihrsnqqpaafjzhgwxch",
      supabaseProjectMatchesExpected: true,
      googleAuthConfigured: true,
      serverKeyConfigured: true,
      serverKeyUsesModernSecret: true,
    });
    expect(JSON.stringify(body)).not.toContain("sb_secret_do_not_return");
    expect(JSON.stringify(body)).not.toContain("publishable-key-with-enough-length");
  });
});
