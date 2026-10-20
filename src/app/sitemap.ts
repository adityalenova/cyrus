/* ══ sitemap.ts — every indexable URL, derived from the data ═══════════
   Nothing here is typed by hand: adding a repo, a program or a tool
   automatically extends the sitemap on the next build. /dashboard and
   its feature tabs stay out because they are personal views behind a
   session, and the API namespace is not a page.                    ══ */
import type { MetadataRoute } from "next";
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { REAL_ORGS } from "@/data/realOrgs";
import { PROGRAMS } from "@/data/orgs";
import { RESOURCES } from "@/data/resources";
import { ALL_TOOLS } from "@/lib/tools/data";
import { ALL_HACKS } from "@/lib/siteStats";

/** same union the site resolves /repo/:id against, without pulling in the
 *  client-side helpers in lib/util (they import React hooks). */
const CATALOG = [...REPOS, ...PROGRAM_REPOS];

export const SITE_ORIGIN = "https://cyrus-agent.vercel.app";

const HUBS: [string, number][] = [
  ["", 1],
  ["/projects", 0.9],
  ["/opensource", 0.9],
  ["/hackathons", 0.9],
  ["/organizations", 0.8],
  ["/tools", 0.8],
  ["/tools/browse", 0.7],
  ["/tools/builder", 0.7],
  ["/apis", 0.7],
  ["/resources", 0.7],
  ["/nova", 0.7],
  ["/about", 0.5],
  ["/platform/features", 0.6],
  ["/platform/how", 0.6],
  ["/platform/nova", 0.6],
  ["/platform/trust", 0.5],
  ["/privacy", 0.2],
  ["/terms", 0.2],
  ["/cookies", 0.2],
  ["/affiliations", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_ORIGIN}${path}`;

  return [
    ...HUBS.map(([path, priority]) => ({
      url: url(path),
      changeFrequency: "daily" as const,
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
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...ALL_HACKS.map((h) => ({
      url: url(`/hackathons/${h.id}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...REAL_ORGS.map((o) => ({
      url: url(`/organizations/${o.login}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...RESOURCES.map((r) => ({
      url: url(`/resources/${r.id}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...ALL_TOOLS.map((t) => ({
      url: url(`/tools/${t.category}/${t.subcategory}/${t.id}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
