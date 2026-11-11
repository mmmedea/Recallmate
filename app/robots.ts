import type { MetadataRoute } from "next";
import { RECALLMATE_PRODUCTION_ORIGIN } from "@/lib/app-origin";

export default function robots(): MetadataRoute.Robots {
  return {
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
  };
}
