/* ══ sitemapGenerator.ts — comprehensive sitemap route collector ═════ */
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "./seo";

export interface SitemapConfig {
  baseUrl?: string;
  dynamicSlugs?: {
    programs?: string[];
    organizations?: string[];
  };
}

export function buildFullSitemap(config: SitemapConfig = {}): MetadataRoute.Sitemap {
  const origin = config.baseUrl || SITE_ORIGIN;
  const now = new Date();

  const coreRoutes = [
    { url: `${origin}/`, priority: 1.0, changeFrequency: "daily" as const },
    { url: `${origin}/programs`, priority: 0.9, changeFrequency: "daily" as const },
    { url: `${origin}/organizations`, priority: 0.9, changeFrequency: "daily" as const },
    { url: `${origin}/issues`, priority: 0.95, changeFrequency: "hourly" as const },
    { url: `${origin}/projects`, priority: 0.8, changeFrequency: "daily" as const },
    { url: `${origin}/skills`, priority: 0.85, changeFrequency: "daily" as const },
    { url: `${origin}/sponsors`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${origin}/leaderboard`, priority: 0.75, changeFrequency: "daily" as const },
    { url: `${origin}/about`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${origin}/platform/features`, priority: 0.7, changeFrequency: "monthly" as const },
    { url: `${origin}/platform/trust`, priority: 0.7, changeFrequency: "monthly" as const },
    { url: `${origin}/platform/how`, priority: 0.7, changeFrequency: "monthly" as const },
  ];

  const programRoutes = (config.dynamicSlugs?.programs || []).map((slug) => ({
    url: `${origin}/programs/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const orgRoutes = (config.dynamicSlugs?.organizations || []).map((login) => ({
    url: `${origin}/organizations/${login}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    ...coreRoutes.map((r) => ({ ...r, lastModified: now })),
    ...programRoutes,
    ...orgRoutes,
  ];
}
