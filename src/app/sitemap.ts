import type { MetadataRoute } from "next";
import { SEARCH_PAGES, SITE_URL } from "@/lib/site";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const priority: Record<string, number> = { "/login": 1, "/privacy-policy": 0.6, "/delete-account": 0.5, "/login/forgot": 0.4 };
  return SEARCH_PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "monthly", priority: priority[p] ?? 0.5 }));
}
