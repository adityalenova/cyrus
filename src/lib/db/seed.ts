/* ══ seed.ts — load the full catalog into Neon Postgres ══════════════
   Run: npm run db:seed   (needs DATABASE_URL in .env)
   Idempotent: each table is cleared and re-inserted inside one pass, so
   the DB always mirrors the datasets in src/data + public/data.
   The hackathons and resources tables are cleared and left empty: those
   sections were dropped in the rebuild, and a migration to drop the
   tables themselves belongs with the issue-index schema work.        ══ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "./index";
import {
  applications, catalogMeta, hackathons, orgRepos, orgs, programProjects,
  repos, resources, savedItems, submissions, users,
} from "./schema";
import { REPOS } from "../../data/repos";
import { REAL_REPOS, REAL_STATS } from "../../data/realOrgs";
import { ORGS } from "../../data/orgs";
import { CRAWL } from "../../data/crawlStats";

const here = fileURLToPath(new URL(".", import.meta.url));
const readJson = (rel: string) => JSON.parse(readFileSync(here + "/../../../public/data/" + rel, "utf8"));

const CATALOG_SNAPSHOT = "2026-10-02"; // matches the refresh pipeline stamp

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const txt = readFileSync(here + "/../../../.env", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env file — rely on the real environment */
  }
}

async function main() {
  loadEnv();
  const db = getDb();
  if (!db) {
    console.error("DATABASE_URL is not set. Create a Neon database, put the connection string in .env, then run npm run db:seed.");
    process.exit(1);
  }

  const t0 = Date.now();
  console.log("Clearing catalog tables…");
  await db.delete(savedItems);
  await db.delete(applications);
  await db.delete(submissions);
  await db.delete(users);
  await db.delete(orgRepos);
  await db.delete(orgs);
  await db.delete(repos);
  await db.delete(hackathons);
  await db.delete(programProjects);
  await db.delete(resources);
  await db.delete(catalogMeta);

  console.log(`Repos: ${REPOS.length}…`);
  const repoRows = REPOS.map((r) => ({
    fullName: r.repo,
    cat: r.cat,
    stars: r.stars,
    forks: r.forks,
    issues: r.issues,
    lang: r.lang,
    license: r.license,
    updated: r.updated,
    homepage: r.home,
    url: r.url,
    description: r.desc,
    topics: r.tags,
    snapshot: CATALOG_SNAPSHOT,
  }));
  for (let i = 0; i < repoRows.length; i += 500) {
    await db.insert(repos).values(repoRows.slice(i, i + 500)).onConflictDoNothing();
  }

  /* the directory the site publishes, not the raw fetch: an organization with
     no program record has no page here, so it gets no row either */
  console.log(`Orgs: ${ORGS.length} (+ top repos)…`);
  await db.insert(orgs).values(ORGS.map((o) => ({
    login: o.login,
    name: o.name,
    domain: o.domain,
    level: o.level,
    tagline: o.tagline,
    topics: o.tags,
    repoCount: o.repos,
    stars: o.stars,
    issues: o.issues,
    followers: REAL_STATS[o.login]?.followers ?? null,
    joined: REAL_STATS[o.login]?.joined ?? null,
    location: REAL_STATS[o.login]?.location ?? null,
    snapshot: CATALOG_SNAPSHOT,
  })));
  const orgRepoRows = Object.entries(REAL_REPOS).flatMap(([orgLogin, list]) =>
    list.map((r) => ({
      orgLogin,
      repo: r.repo,
      description: r.desc,
      lang: r.lang,
      stars: r.stars,
      forks: r.forks,
      issues: r.issues,
      url: r.url,
    })),
  );
  for (let i = 0; i < orgRepoRows.length; i += 500) {
    await db.insert(orgRepos).values(orgRepoRows.slice(i, i + 500));
  }

  console.log("Program projects…");
  const gsoc = readJson("gsoc-projects.json");
  const other = readJson("otherProjects.json");
  const projRows = [
    ...gsoc.projects.map((p: Record<string, unknown>) => ({
      program: "GSoC", uid: String(p.u), year: Number(p.y), term: String(p.s ?? ""),
      title: String(p.t), org: String(p.o), status: String(p.s ?? ""),
      tech: (p.tt as string[]) ?? [], topics: (p.tp as string[]) ?? [],
      blurb: String(p.b ?? ""), mentors: p.m ? String(p.m) : null, url: null,
    })),
    ...other.projects.map((p: Record<string, unknown>) => ({
      program: String(p.program ?? "LFX"), uid: String(p.u), year: Number(p.y), term: String(p.s ?? ""),
      title: String(p.t), org: String(p.o), status: String(p.s ?? ""),
      tech: (p.tt as string[]) ?? [], topics: (p.tp as string[]) ?? [],
      blurb: String(p.b ?? ""), mentors: p.m ? String(p.m) : null, url: p.url ? String(p.url) : null,
    })),
  ];
  for (let i = 0; i < projRows.length; i += 500) {
    await db.insert(programProjects).values(projRows.slice(i, i + 500)).onConflictDoNothing();
  }

  const counts = {
    repos: REPOS.length,
    orgs: ORGS.length,
    programProjects: projRows.length,
    /* the crawl total is a count of GitHub issues, not of DB rows, so it
       is kept in meta rather than reported by /api/catalog/counts */
    crawledIssues: CRAWL.issues,
  };
  await db.insert(catalogMeta).values([
    { key: "snapshot", value: { catalog: CATALOG_SNAPSHOT, issues: CRAWL.crawledAt } },
    { key: "counts", value: counts },
  ]);

  console.log(`Seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(counts));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
