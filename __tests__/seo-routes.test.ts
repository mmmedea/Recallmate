import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { RECALLMATE_PRODUCTION_ORIGIN } from "../lib/app-origin";

describe("public crawler metadata", () => {
  it("points the sitemap to the production origin and disallows private routes", () => {
    expect(robots()).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/api/",
            "/auth/",
            "/calendar",
            "/chat",
            "/dashboard",
            "/documents/",
            "/help",
            "/notes",
            "/onboarding",
            "/progress",
            "/quiz",
            "/settings",
            "/topics",
            "/upload",
            "/verify-email",
          ],
        },
      ],
      sitemap: `${RECALLMATE_PRODUCTION_ORIGIN}/sitemap.xml`,
    });
  });

  it("lists only the selected public pages on the production origin", () => {
    expect(sitemap().map(({ url }) => url)).toEqual([
      `${RECALLMATE_PRODUCTION_ORIGIN}/`,
      `${RECALLMATE_PRODUCTION_ORIGIN}/login`,
      `${RECALLMATE_PRODUCTION_ORIGIN}/privacy`,
      `${RECALLMATE_PRODUCTION_ORIGIN}/terms`,
    ]);
  });
});
