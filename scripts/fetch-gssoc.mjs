/* ══ scripts/fetch-gssoc.mjs — the GirlScript Summer of Code live listing ══
   node scripts/fetch-gssoc.mjs

   GSSoC does not publish a historical archive the way GSoC does, but the
   current season's project board is open JSON:

     https://gssoc.girlscript.org/api/projects   -> every registered project
     https://gssoc.girlscript.org/api/mentors    -> the mentor directory
     https://gssoc.girlscript.org/api/leaderboard-> the participant count

   For GSSoC the "organization" is the repository owner: each project is one
   repo somebody opened to contributors, so the owner login is the org, and the
   count of distinct owners is the count of organizations that season. The
   admin_github / admin_name fields are the mentors the platform records.

   Two limits stated plainly:
   - /api/mentors returns a hard 200 rows and ignores every pagination param
     we tried (page, offset, skip, limit), so 200 is what we can name, not
     what GSSoC has;
   - the leaderboard total counts participants, not mentors or organizations.

   Output: public/data/gssoc-archive.json.                              ═ */
import { writeFileSync, renameSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/gssoc-archive.json");
const API = "https://gssoc.girlscript.org/api";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const get = async (path, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* transient */ }
    await sleep(900 * (i + 1));
  }
  return null;
};

const REPO = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i;
const ownerRepo = (p) => {
  const seed = clean(p.owner_repo).toLowerCase();
  if (/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(seed)) return seed;
  const m = clean(p.repo_url).match(REPO);
  return m ? `${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null;
};

const projects = (await get("/projects"))?.projects ?? [];
await sleep(300);
const mentorsRaw = (await get("/mentors"))?.mentors ?? [];
await sleep(300);
const board = await get("/leaderboard?limit=1");

if (!projects.length) throw new Error("GSSoC returned no projects - refusing to write");

/* one row per repository owner = one organization */
const byOrg = new Map();
for (const p of projects) {
  const r = ownerRepo(p);
  if (!r) continue;
  const login = r.split("/")[0];
  const e = byOrg.get(login) ?? {
    name: login, login, projects: 0, repos: new Set(), languages: new Set(),
    mentor: clean(p.admin_name), mentors: new Set(), year: 2026,
  };
  e.projects += 1;
  e.repos.add(r);
  for (const l of clean(p.tech_stack).split(",")) if (l.trim()) e.languages.add(l.trim());
  const m = clean(p.admin_name);
  if (m && m.length >= 3) e.mentors.add(m);
  byOrg.set(login, e);
}

const orgs = [...byOrg.values()]
  .map((o) => ({
    name: o.login, login: o.login, n: o.projects,
    years: [o.year], url: `https://github.com/${o.login}`,
    category: [...o.languages].slice(0, 3).join(", "),
    mentors: o.mentors.size, topMentors: [...o.mentors].sort().slice(0, 6),
  }))
  .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

const mentorList = [...new Map(mentorsRaw.map((m) => {
  const login = clean(m.github_user).toLowerCase();
  return [login || clean(m.full_name), {
    name: clean(m.full_name) || login, login: clean(m.github_user) || null,
    bio: clean(m.bio).slice(0, 200),
  }];
}).filter(([, v]) => v.login).values())].map(([, v]) => v)
  .sort((a, b) => a.name.localeCompare(b.name));

const file = {
  generated: new Date().toISOString().slice(0, 10),
  source: "gssoc.girlscript.org/api (projects, mentors, leaderboard)",
  note: "GirlScript Summer of Code publishes its live season board. The organization here is the repository owner, because every GSSoC project is one repo opened to contributors. The mentor directory returns " + mentorList.length + " names and the endpoint ignores pagination, so this is what the platform itself publishes rather than a total it reports.",
  season: 2026,
  projects: projects.length,
  repos: [...new Set(projects.map(ownerRepo).filter(Boolean))].length,
  orgs,
  mentors: { listed: mentorList.length, capped: mentorList.length >= 200, names: mentorList },
  participants: Number(board?.total ?? 0) || null,
};

mkdirSync(dirname(OUT), { recursive: true });
const tmp = OUT + ".tmp";
writeFileSync(tmp, JSON.stringify(file));
renameSync(tmp, OUT);

console.log(`GSSoC: ${projects.length} projects · ${orgs.length} repository owners · ${mentorList.length} named mentors${mentorList.length >= 200 ? " (API cap)" : ""} · ${file.participants ?? "?"} leaderboard participants`);
console.log(`top owners: ${orgs.slice(0, 5).map((o) => `${o.name} (${o.n})`).join(", ")}`);
console.log(`wrote ${OUT.replace(ROOT + "/", "")} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
