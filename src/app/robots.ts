/* ══ robots.ts — crawl rules ══════════════════════════════════════════
   Production is fully open except the signed-in dashboard. Every Vercel
   preview deployment is disallowed outright: those URLs are public but
   they are throwaway build artifacts, and indexing them would split the
   ranking signal across a hundred subdomains.                    ══ */
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const env = process.env.VERCEL_ENV;
  const isPreview = env !== undefined && env !== "production";

  if (isPreview) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${SITE_ORIGIN}/sitemap.xml`,
      host: SITE_ORIGIN,
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/"] }],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
