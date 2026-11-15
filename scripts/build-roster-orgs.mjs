/* ══ scripts/build-roster-orgs.mjs — the whole program roster, with live stats ═
   node scripts/fetch-org-records.mjs && node scripts/build-roster-orgs.mjs --no-fetch

   Turns the 616 organizations in public/data/program-roster.json into the data
   the site actually renders. Three jobs, in order:

   1. Top repos. scripts/fetch-org-records.mjs fills data/org-login-cache.json
      with every organization's ten most-starred repositories in a handful of
      batched GraphQL calls. This script only reads that cache; --no-fetch is the
      normal way to run it, and the search-API loop below stays as the fallback
      for a machine that has not run the records pass.

   2. src/data/realOrgs.ts. The organizations directory, grown from 43 hand-
      picked logins to every roster org whose GitHub account was confirmed, plus
      the popular ones already there. Same shape the page already consumes, so
      nothing downstream changes. Stars and issues are summed over the top ten
      repos because that is what the profile page shows; public_repos is GitHub's
      own count. `level` stays the mechanical star threshold fetch-orgs.mjs uses.

   3. src/data/rosterOrgs.ts. All 616, including the ones with no GitHub account,
      with the programs they ran, the years, accepted-project counts, their own
      website and their GSoC category. This is what program pages read, and it is
      also where programsOf() gets a real answer instead of guessing from repo
      topics.

   Nothing here invents a number. An org with no GitHub match gets no stars, no
   repo count and no profile link - it appears in the roster with the project
   data its program published and nothing more.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { updateReadmeSnapshot } from "./readme-snapshot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROSTER = join(ROOT, "public/data/program-roster.json");
const CACHE = join(ROOT, "data/org-login-cache.json");
const OUT_ORGS = join(ROOT, "src/data/realOrgs.ts");
const OUT_ROSTER = join(ROOT, "src/data/rosterOrgs.ts");

const PROGRAM_LABEL = { gsoc: "GSoC", lfx: "LFX", outreachy: "Outreachy", sob: "Summer of Bitcoin" };

const gh = (path) => JSON.parse(execFileSync("gh", ["api", path], { maxBuffer: 20 * 1024 * 1024, encoding: "utf8" }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => JSON.stringify(s);
const clean = (s) => (s || "").replace(/\s+/g, " ").replace(/["\\]/g, "").trim();
const hostOf = (blog) => {
  if (!blog) return "";
  try { return new URL(blog.startsWith("http") ? blog : "https://" + blog).hostname.replace(/^www\./, ""); }
  catch { return blog.slice(0, 40); }
};

const roster = JSON.parse(readFileSync(ROSTER, "utf8"));
const cache = JSON.parse(readFileSync(CACHE, "utf8"));

/* ── 1. the roster row for every organization name ── */
const orgs = new Map();
for (const [program, data] of Object.entries(roster.programs)) {
  for (const o of data.orgs) {
    const row = orgs.get(o.name) ?? { name: o.name, url: o.url ?? "", category: o.category ?? "", logo: o.logo ?? "", programs: [] };
    row.programs.push({ program, projects: o.n, years: o.years ?? [] });
    orgs.set(o.name, row);
  }
}
/* the GSoC export carries the logo and category the roster summary drops */
const gsocOrgs = JSON.parse(readFileSync(join(ROOT, "public/data/gsoc-orgs.json"), "utf8"));
for (const year of Object.values(gsocOrgs)) {
  for (const o of year) {
    const row = orgs.get(o.name);
    if (row && !row.logo) { row.logo = o.logo ?? ""; row.category = o.category ?? row.category; }
  }
}

const loginOf = (name) => cache[name]?.login ?? null;
const resolved = [...orgs.values()].filter((o) => loginOf(o.name));
console.log(`${orgs.size} roster orgs, ${resolved.length} with a confirmed GitHub account`);

/* ── 2. top ten repos for every confirmed login ── */
const needFetch = resolved.map((o) => loginOf(o.name)).filter((l) => !cache[`@${l}`]?.repos);
if (!process.argv.includes("--no-fetch") && needFetch.length) {
  console.log(`fetching top repos for ${needFetch.length} logins (~${Math.ceil(needFetch.length * 2.3 / 60)} min)`);
  for (let i = 0; i < needFetch.length; i++) {
    const login = needFetch[i];
    const key = `@${login}`;
    try {
      const s = gh(`search/repositories?q=org:${encodeURIComponent(login)}&sort=stars&order=desc&per_page=10`);
      cache[key] = { ...(cache[key] ?? {}), repos: (s.items ?? []).map((r) => ({
        repo: r.full_name, desc: clean(r.description).slice(0, 150), lang: r.language || "Other",
        stars: r.stargazers_count, forks: r.forks_count, issues: r.open_issues_count, url: r.html_url,
      })) };
    } catch (e) {
      const msg = String(e.message || e);
      if (/secondary rate limit|403|rate limit/i.test(msg)) { console.log(`  rate limited at ${i}, pausing 60s`); await sleep(60000); i--; continue; }
      cache[key] = { ...(cache[key] ?? {}), repos: [], repoError: msg.slice(0, 80) };
      console.log(`  repo search failed ${login}: ${msg.slice(0, 60)}`);
    }
    if (i % 25 === 0) writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    await sleep(2300);
  }
  writeFileSync(CACHE, JSON.stringify(cache, null, 1));
}

/* ── 3. the directory: confirmed roster orgs, merged with what is already live ── */
const existing = readFileSync(OUT_ORGS, "utf8");
const keepLogins = [...existing.matchAll(/^\s*\{ login: "([^"]+)"/gm)].map((m) => m[1]);

const wanted = new Map();
for (const login of keepLogins) wanted.set(login, { source: "directory" });
for (const o of resolved) {
  const login = loginOf(o.name);
  const prev = wanted.get(login);
  if (prev) prev.roster = o; else wanted.set(login, { source: "roster", roster: o });
}

const rows = [];
const reposMap = {};
const statsMap = {};
let missing = 0;
let empty = 0;
for (const [login, entry] of wanted) {
  const rec = cache[`@${login}`];
  const repos = rec?.repos ?? [];
  if (!rec?.fetched || rec.fetched === "failed") { missing++; continue; }
  /* an account that holds no public repository is a real organization but not a
     browsable profile - openssf, PostgreSQL and nixos-foundation are all bodies
     whose code lives in member repositories. They stay in the roster with their
     archive numbers and get no card, because there would be nothing to open. */
  if (!rec.public_repos || !repos.length) { empty++; continue; }
  const stars = repos.reduce((a, r) => a + r.stars, 0);
  const issues = repos.reduce((a, r) => a + r.issues, 0);
  const langs = [...new Set(repos.map((r) => r.lang).filter((l) => l !== "Other"))].slice(0, 3);
  rows.push({
    login,
    name: clean(rec.name || login),
    domain: hostOf(rec.blog) || `github.com/${login}`,
    level: stars > 300000 ? "advanced" : stars > 60000 ? "intermediate" : "beginner",
    tagline: clean(rec.bio) || `Open-source organization on GitHub - ${rec.public_repos} public repos.`,
    tags: langs.length ? langs : ["Open source"],
    repos: rec.public_repos ?? 0,
    stars, issues,
  });
  reposMap[login] = repos;
  statsMap[login] = { followers: rec.followers ?? 0, joined: (rec.created ?? "").slice(0, 7), location: clean(rec.location) };
}
rows.sort((a, b) => b.stars - a.stars || a.login.localeCompare(b.login));
if (!rows.length) { console.error("nothing assembled - realOrgs.ts left untouched"); process.exit(1); }

/* which programs each login actually ran, straight out of the archive */
const orgPrograms = {};
for (const [login, entry] of wanted) {
  if (!entry.roster) continue;
  orgPrograms[login] = entry.roster.programs.map((p) => ({ program: p.program, projects: p.projects, years: p.years }));
}

const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(OUT_ORGS, `/* ══ realOrgs.ts - LIVE GitHub intel for the organizations directory.
   Regenerated ${stamp} by: node scripts/resolve-org-logins.mjs && node scripts/build-roster-orgs.mjs
   Every number is GitHub's own: stars, forks and open issues summed over the
   org's ten most-starred repositories, public repo count from its account.
   The roster behind this is every organization that ran a mentored program in
   archive whose GitHub account was confirmed by the rulebook in scripts/lib/.
   ${missing} logins in the cache could not be read and ${empty} hold no public repository, so
   they are absent from the directory rather than guessed at or left as dead cards;
   both groups still appear in the roster with their archive numbers. ═ */
import type { Org } from "../lib/types";

export interface RealRepo { repo: string; desc: string; lang: string; stars: number; forks: number; issues: number; url: string }
export interface RealStat { followers: number; joined: string; location: string }
export interface RosterProgram { program: string; projects: number; years: number[] }

export const REAL_ORGS: Org[] = [
${rows.map((o) => `  { login: ${esc(o.login)}, name: ${esc(o.name)}, domain: ${esc(o.domain)}, level: ${esc(o.level)},\n    tagline: ${esc(o.tagline)}, tags: [${o.tags.map(esc).join(", ")}], repos: ${o.repos}, stars: ${o.stars}, issues: ${o.issues} },`).join("\n")}
];

export const REAL_REPOS: Record<string, RealRepo[]> = {
${rows.map((o) => `  ${esc(o.login)}: [\n${(reposMap[o.login] ?? []).map((r) => `    { repo: ${esc(r.repo)}, desc: ${esc(r.desc)}, lang: ${esc(r.lang)}, stars: ${r.stars}, forks: ${r.forks}, issues: ${r.issues}, url: ${esc(r.url)} },`).join("\n")}\n  ],`).join("\n")}
};

export const REAL_STATS: Record<string, RealStat> = {
${rows.map((o) => `  ${esc(o.login)}: { followers: ${statsMap[o.login].followers}, joined: ${esc(statsMap[o.login].joined)}, location: ${esc(statsMap[o.login].location)} },`).join("\n")}
};

/* Which mentored programs an organization actually ran, taken from the program
   archives rather than guessed from repository topics. */
export const ORG_PROGRAMS: Record<string, RosterProgram[]> = {
${Object.entries(orgPrograms).map(([login, list]) => `  ${esc(login)}: [${list.map((p) => `{ program: ${esc(p.program)}, projects: ${p.projects}, years: [${p.years.join(", ")}] }`).join(", ")}],`).join("\n")}
};
`);

/* ── 4. the full 616, GitHub account or not ── */
const rosterRows = [...orgs.values()].map((o) => ({
  name: o.name,
  login: loginOf(o.name),
  url: o.url,
  category: o.category,
  projects: o.programs.reduce((a, p) => a + p.projects, 0),
  programs: o.programs.map((p) => ({ program: p.program, projects: p.projects, years: p.years })),
})).sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

writeFileSync(OUT_ROSTER, `/* ══ rosterOrgs.ts - every organization that ran a mentored program in the archives we hold.
   Regenerated ${stamp} by node scripts/build-roster-orgs.mjs from the official
   program archives. ${rosterRows.filter((r) => r.login).length} of ${rosterRows.length} have a confirmed GitHub account; the rest
   are listed with the project data their program published and no GitHub numbers,
   because they do not run one or we could not confirm which account is theirs. ═ */
export interface RosterEntry {
  name: string; login: string | null; url: string; category: string; projects: number;
  programs: { program: string; projects: number; years: number[] }[];
}

export const ROSTER_LABEL: Record<string, string> = ${JSON.stringify(PROGRAM_LABEL)};

export const ROSTER: RosterEntry[] = [
${rosterRows.map((r) => `  { name: ${esc(r.name)}, login: ${r.login ? esc(r.login) : "null"}, url: ${esc(r.url)}, category: ${esc(r.category)}, projects: ${r.projects},\n    programs: [${r.programs.map((p) => `{ program: ${esc(p.program)}, projects: ${p.projects}, years: [${p.years.join(", ")}] }`).join(", ")}] },`).join("\n")}
];

export const ROSTER_STATS = {
  orgs: ${rosterRows.length},
  withGithub: ${rosterRows.filter((r) => r.login).length},
  projects: ${rosterRows.reduce((a, r) => a + r.projects, 0)},
};
`);

updateReadmeSnapshot(ROOT);
console.log(`wrote ${rows.length} directory orgs -> realOrgs.ts, ${rosterRows.length} roster entries -> rosterOrgs.ts`);
