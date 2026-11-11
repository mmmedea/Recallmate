import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  assertGoogleOAuthUrlIsSafe: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOAuth: routeMocks.signInWithOAuth,
    },
  }),
}));

vi.mock("@/lib/integrations/google-oauth", () => ({
  assertGoogleOAuthUrlIsSafe: routeMocks.assertGoogleOAuthUrlIsSafe,
}));

import { GET } from "@/app/api/auth/google/start/route";

describe("Google sign-in OAuth start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recallmate-ai.vercel.app");
    routeMocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });
    routeMocks.assertGoogleOAuthUrlIsSafe.mockReturnValue(undefined);
  });

  it("redirects the browser to Supabase Google OAuth with profile-only scopes and the production callback", async () => {
    const response = await GET(new Request("http://localhost:3000/api/auth/google/start?next=/calendar"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.supabase.co/auth/v1/authorize?provider=google");
    expect(response.headers.get("set-cookie")).toContain("recallmate_auth_flow");
    expect(routeMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://recallmate-ai.vercel.app/auth/callback?next=%2Fcalendar",
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    expect(routeMocks.assertGoogleOAuthUrlIsSafe).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/authorize?provider=google",
      { purpose: "sign-in", featureLabel: "Google sign-in" },
    );
  });

  it("falls back to dashboard when an unsafe next redirect is supplied", async () => {
    await GET(new Request("https://recallmate-ai.vercel.app/api/auth/google/start?next=https://evil.test"));

    expect(routeMocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: "https://recallmate-ai.vercel.app/auth/callback?next=%2Fdashboard",
        }),
      }),
    );
  });

  it("does not generate localhost callbacks even when started from a local URL", async () => {
    vi.unstubAllEnvs();

    await GET(new Request("http://localhost:3000/api/auth/google/start?next=/quiz"));

    expect(routeMocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: "https://recallmate-ai.vercel.app/auth/callback?next=%2Fquiz",
        }),
      }),
    );
  });
});
