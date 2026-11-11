import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserAppOrigin,
  getCanonicalProductionRedirectUrl,
  getServerAppOrigin,
  RECALLMATE_PRODUCTION_ORIGIN,
} from "@/lib/app-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("app origin resolution", () => {
  it("uses a configured production app origin before localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recallmate-ai.vercel.app");
    expect(getBrowserAppOrigin("http://localhost:3000")).toBe("https://recallmate-ai.vercel.app");
    expect(getServerAppOrigin("http://localhost:3000")).toBe("https://recallmate-ai.vercel.app");
  });

  it("normalizes Vercel production host values without a scheme", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "recallmate-ai.vercel.app");
    expect(getServerAppOrigin("http://localhost:3000")).toBe("https://recallmate-ai.vercel.app");
  });

  it("canonicalizes the retired RecallMate preview domain if it remains in env", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recallmate.vercel.app");
    expect(getServerAppOrigin("http://localhost:3000")).toBe("https://recallmate-ai.vercel.app");
    expect(getBrowserAppOrigin("https://recallmate.vercel.app")).toBe("https://recallmate-ai.vercel.app");
  });

  it("falls back to RecallMate production origin in production instead of localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getServerAppOrigin("http://localhost:3000")).toBe(RECALLMATE_PRODUCTION_ORIGIN);
  });

  it("redirects the retired RecallMate alias but preserves Vercel Preview deployments", () => {
    const legacyRedirect = getCanonicalProductionRedirectUrl(
      "https://recallmate.vercel.app/login?next=%2Fcalendar"
    );

    expect(legacyRedirect?.toString()).toBe("https://recallmate-ai.vercel.app/login?next=%2Fcalendar");
    expect(
      getCanonicalProductionRedirectUrl(
        "https://recallmate-pdirmv58y-medea18.vercel.app/login?next=%2Fcalendar"
      )
    ).toBeNull();
    expect(getCanonicalProductionRedirectUrl("https://recallmate-ai.vercel.app/login")).toBeNull();
    expect(getCanonicalProductionRedirectUrl("http://localhost:3000/login")).toBeNull();
  });
});
