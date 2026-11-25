import type { MetadataRoute } from "next";
import { SEARCH_PAGES, SITE_URL } from "@/lib/site";

/**
 * Search engines may read the public pages only (sign in, forgot password, privacy policy, delete account), and the
 * scripts and styles those pages need to render. Everything else - the portal behind sign-in, shared route links,
 * batch pages - stays out; each page also says noindex unless it is one of the public ones.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", ...SEARCH_PAGES, "/_next/static/", "/icon.png", "/favicon.ico"],
      disallow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
