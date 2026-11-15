/* ══ sitemap.test.ts — verify honest sitemap frequencies and lastmod ════
   Every indexable route is validated for realistic change frequencies,
   valid lastModified timestamps on derived pages, and unchanged catalog
   behavior.                                                             ══ */
import { describe, expect, it } from "vitest";
import sitemap, { catalogSnapshotDate } from "./sitemap";
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { ORGS, PROGRAMS } from "@/data/orgs";
import { SITE_ORIGIN } from "@/lib/seo";

describe("sitemap()", () => {
  const entries = sitemap();
  const entryMap = new Map(entries.map((e) => [e.url, e]));

  it("assigns yearly changeFrequency to static legal pages", () => {
    const legalPaths = ["/privacy", "/terms", "/cookies", "/affiliations"];
    for (const path of legalPaths) {
      const entry = entryMap.get(`${SITE_ORIGIN}${path}`);
      expect(entry, `missing entry for ${path}`).toBeDefined();
      expect(entry?.changeFrequency).toBe("yearly");
      expect(entry?.priority).toBe(0.2);
    }
  });

  it("assigns monthly changeFrequency to /about and platform overview pages", () => {
    const overviewPaths = [
      ["/about", 0.5],
      ["/platform/features", 0.6],
      ["/platform/how", 0.6],
      ["/platform/trust", 0.5],
    ] as const;

    for (const [path, priority] of overviewPaths) {
      const entry = entryMap.get(`${SITE_ORIGIN}${path}`);
      expect(entry, `missing entry for ${path}`).toBeDefined();
      expect(entry?.changeFrequency).toBe("monthly");
      expect(entry?.priority).toBe(priority);
    }
  });

  it("retains daily changeFrequency for genuinely fast-moving hubs", () => {
    const dailyPaths = ["", "/skills", "/issues", "/leaderboard"];
    for (const path of dailyPaths) {
      const entry = entryMap.get(`${SITE_ORIGIN}${path}`);
      expect(entry, `missing entry for ${path}`).toBeDefined();
      expect(entry?.changeFrequency).toBe("daily");
    }
  });

  it("assigns weekly changeFrequency to moderately updated directory hubs", () => {
    const weeklyHubs = [
      ["/projects", 0.9],
      ["/programs", 0.9],
      ["/sponsors", 0.8],
      ["/organizations", 0.8],
      ["/organizations/stats", 0.7],
    ] as const;

    for (const [path, priority] of weeklyHubs) {
      const entry = entryMap.get(`${SITE_ORIGIN}${path}`);
      expect(entry, `missing entry for ${path}`).toBeDefined();
      expect(entry?.changeFrequency).toBe("weekly");
      expect(entry?.priority).toBe(priority);
    }
  });

  it("stamps a valid deterministic catalog snapshot lastModified on all organization profiles", () => {
    const snapshotDate = catalogSnapshotDate();
    expect(snapshotDate).toBeInstanceOf(Date);
    expect(Number.isNaN(snapshotDate?.getTime())).toBe(false);

    expect(ORGS.length).toBeGreaterThan(0);
    for (const org of ORGS) {
      const url = `${SITE_ORIGIN}/organizations/${org.login}`;
      const entry = entryMap.get(url);
      expect(entry, `missing entry for org ${org.login}`).toBeDefined();
      expect(entry?.lastModified).toEqual(snapshotDate);
      expect(entry?.changeFrequency).toBe("weekly");
      expect(entry?.priority).toBe(0.6);
    }
  });

  it("stamps a valid deterministic catalog snapshot lastModified on all program detail routes", () => {
    const snapshotDate = catalogSnapshotDate();
    expect(PROGRAMS.length).toBeGreaterThan(0);

    for (const prog of PROGRAMS) {
      const url = `${SITE_ORIGIN}/programs/${prog.id}`;
      const entry = entryMap.get(url);
      expect(entry, `missing entry for program ${prog.id}`).toBeDefined();
      expect(entry?.lastModified).toEqual(snapshotDate);
      expect(entry?.changeFrequency).toBe("weekly");
      expect(entry?.priority).toBe(0.8);
    }
  });

  it("stamps a valid deterministic catalog snapshot lastModified on all program org explorer routes", () => {
    const snapshotDate = catalogSnapshotDate();
    for (const prog of PROGRAMS) {
      const url = `${SITE_ORIGIN}/programs/${prog.id}/organizations`;
      const entry = entryMap.get(url);
      expect(entry, `missing entry for program orgs ${prog.id}`).toBeDefined();
      expect(entry?.lastModified).toEqual(snapshotDate);
      expect(entry?.changeFrequency).toBe("weekly");
      expect(entry?.priority).toBe(0.7);
    }
  });

  it("preserves individual r.updated lastModified timestamps on catalog repository routes", () => {
    const catalog = [...REPOS, ...PROGRAM_REPOS];
    expect(catalog.length).toBeGreaterThan(0);

    // Verify first, middle, and last repository entries
    const testIndices = [0, Math.floor(catalog.length / 2), catalog.length - 1];
    for (const idx of testIndices) {
      const repo = catalog[idx];
      const url = `${SITE_ORIGIN}/repo/${encodeURIComponent(repo.repo)}`;
      const entry = entryMap.get(url);
      expect(entry, `missing entry for repo ${repo.repo}`).toBeDefined();
      expect(entry?.lastModified).toEqual(new Date(`${repo.updated}T00:00:00Z`));
      expect(entry?.changeFrequency).toBe("weekly");
      expect(entry?.priority).toBe(0.6);
    }
  });

  it("generates exact count of unique URLs with valid priorities and no duplicates", () => {
    const expectedTotal = 17 + REPOS.length + PROGRAM_REPOS.length + (2 * PROGRAMS.length) + ORGS.length;
    expect(entries.length).toBe(expectedTotal);
    expect(entryMap.size).toBe(expectedTotal);

    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_ORIGIN)).toBe(true);
      expect(entry.priority).toBeDefined();
      expect(entry.priority).toBeGreaterThanOrEqual(0.1);
      expect(entry.priority).toBeLessThanOrEqual(1.0);
    }
  });
});

describe("catalogSnapshotDate()", () => {
  it("extracts the newest updated date in REPOS as a UTC midnight Date", () => {
    const newestStr = REPOS.map((r) => r.updated).sort().at(-1);
    expect(newestStr).toBeDefined();

    const snapshot = catalogSnapshotDate();
    expect(snapshot).toBeInstanceOf(Date);
    expect(snapshot?.toISOString()).toBe(`${newestStr}T00:00:00.000Z`);
  });
});
