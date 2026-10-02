import type { MetadataRoute } from "next";
import { RECALLMATE_PRODUCTION_ORIGIN } from "@/lib/app-origin";

const publicRoutes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/login", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, RECALLMATE_PRODUCTION_ORIGIN).toString(),
    changeFrequency,
    priority,
  }));
}
