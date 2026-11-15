/* ══ sitemap.ts — every indexable URL, derived from the data ═══════════
   Nothing here is typed by hand: adding a repo, a program or an org
   automatically extends the sitemap on the next build. /dashboard and
   its tabs stay out because they are personal views behind a session,
   and the API namespace is not a page.                              ══ */
import type { MetadataRoute } from "next";
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { ORGS, PROGRAMS } from "@/data/orgs";
import { SITE_ORIGIN } from "@/lib/seo";

/** same union the site resolves /repo/:id against, without pulling in the
 *  client-side helpers in lib/util (they import React hooks). */
const CATALOG = [...REPOS, ...PROGRAM_REPOS];

type HubConfig = [
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
];

const HUBS: HubConfig[] = [
  ["", 1, "daily"],
  ["/skills", 0.9, "daily"],
  ["/issues", 0.9, "daily"],
  ["/leaderboard", 0.9, "daily"],
  ["/projects", 0.9, "weekly"],
  ["/programs", 0.9, "weekly"],
  ["/sponsors", 0.8, "weekly"],
  ["/organizations", 0.8, "weekly"],
  ["/organizations/stats", 0.7, "weekly"],
  ["/about", 0.5, "monthly"],
  ["/platform/features", 0.6, "monthly"],
  ["/platform/how", 0.6, "monthly"],
  ["/platform/trust", 0.5, "monthly"],
  ["/privacy", 0.2, "yearly"],
  ["/terms", 0.2, "yearly"],
  ["/cookies", 0.2, "yearly"],
  ["/affiliations", 0.2, "yearly"],
];

/** Newest `updated` stamp in the project catalog as a UTC Date.
 *  Same rule as scripts/readme-snapshot.mjs and lib/ogContent.ts: the catalog date, never the run date. */
export function catalogSnapshotDate(): Date | undefined {
  let newest = "";
  for (const r of REPOS) {
    if (r.updated > newest) newest = r.updated;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(newest) ? new Date(`${newest}T00:00:00Z`) : undefined;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_ORIGIN}${path}`;
  const snapshotDate = catalogSnapshotDate();

  return [
    ...HUBS.map(([path, priority, changeFrequency]) => ({
      url: url(path),
      changeFrequency,
      priority,
    })),
    ...CATALOG.map((r) => ({
      url: url(`/repo/${encodeURIComponent(r.repo)}`),
      lastModified: new Date(`${r.updated}T00:00:00Z`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...PROGRAMS.map((p) => ({
      url: url(`/programs/${p.id}`),
      ...(snapshotDate ? { lastModified: snapshotDate } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...PROGRAMS.map((p) => ({
      url: url(`/programs/${p.id}/organizations`),
      ...(snapshotDate ? { lastModified: snapshotDate } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...ORGS.map((o) => ({
      url: url(`/organizations/${o.login}`),
      ...(snapshotDate ? { lastModified: snapshotDate } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
