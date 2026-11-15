/* ══ org-stats.mjs — one organization per row, across every program.

   /programs/<id>/organizations shows one program's participants. Nobody has
   asked the other question yet: how many distinct organizations do our records
   name in total, which of them turn up in more than one program, and where are
   the projects actually concentrated? Answering it in the browser would mean
   fetching every shard and archive - over 1.3 MB of JSON - to render one page.

   So this script runs the same merge the explorer runs (mergeProgramOrgs,
   program by program), folds the rows together on the organization's name key,
   unions that with the GitHub profiles the directory tracks, and writes the
   result to /data/org-stats.json. Every number on the statistics page is a
   count over this file, and this file is generated from the records the program
   pages already read. Run it after any roster or shard changes:

     npx tsx scripts/org-stats.mjs                                         ═ */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mergeProgramOrgs, orgKey } from "../src/lib/contriboOrgs.ts";
import { ORGS, PROGRAMS } from "../src/data/orgs.ts";
import { programsOf } from "../src/data/programAssoc.ts";
import { normalizeTechs, sectorOf } from "../src/lib/orgTaxonomy.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const data = (p) => `${root}/public/data/${p}`;
const read = (p) => (existsSync(data(p)) ? JSON.parse(readFileSync(data(p), "utf8")) : null);

const roster = read("program-roster.json");
const LABEL = Object.fromEntries(PROGRAMS.map((p) => [p.id, p.name]));
const PROGRAM_IDS = PROGRAMS.map((p) => p.id);


const byKey = new Map();

const fold = (src, tag) => {
  const prev = byKey.get(src.key);
  if (!prev) { byKey.set(src.key, { ...src, programs: [...src.programs], from: [tag] }); return; }
  if (src.name.length > prev.name.length) prev.name = src.name;
  prev.login = prev.login ?? src.login;
  prev.site = prev.site || src.site;
  prev.desc = prev.desc || src.desc;
  if (prev.sector === "Other" && src.sector !== "Other") prev.sector = src.sector;
  prev.techs = normalizeTechs([...prev.techs, ...src.techs]);
  prev.years = [...new Set([...prev.years, ...src.years])].sort((a, b) => b - a);
  prev.projects = Math.max(prev.projects, src.projects);
  prev.stars = Math.max(prev.stars, src.stars);
  prev.repos = Math.max(prev.repos, src.repos);
  prev.issues = Math.max(prev.issues, src.issues);
  for (const p of src.programs) {
    const mine = prev.programs.find((x) => x.id === p.id);
    if (mine) {
      mine.projects = Math.max(mine.projects, p.projects);
      mine.years = [...new Set([...mine.years, ...p.years])].sort((a, b) => b - a);
    } else prev.programs.push(p);
  }
  if (!prev.from.includes(tag)) prev.from.push(tag);
};

const perProgram = {};

/* ── 1. every program's merged organization list.

   Two of our records are not organization lists at all, and folding them in
   would turn one repository into one "organization":

   - 24 Pull Requests lists every repository that received a December pull -
     10,080 of them, most owned by a single person;
   - Hacktoberfest, FOSSEE, NSOC, GSSoC and Vercel OSS rows are the projects or
     repositories that carried the program topic, not a host that accepted
     mentored work.

   Those programs keep their own explorer page, where the rows are labelled for
   what they are. This cross-program fold uses only the records that name a
   host organization.                                       ───────────────── */
const PROJECT_LEVEL = new Set(["24pr", "oct", "gssoc", "nsoc", "fossee", "vercel-oss", "sob"]);

for (const id of PROGRAM_IDS) {
  const shard = read(`contribo-orgs/${id}.json`);
  const meta = roster?.programs?.[id];
  const archive = meta && read(meta.file) ? (read(meta.file).orgs ?? []) : [];
  if (!shard && !archive.length) continue;
  if (shard?.rowKind === "project" || PROJECT_LEVEL.has(id)) continue;
  const rows = mergeProgramOrgs(shard?.orgs ?? [], archive, "org");
  perProgram[id] = { orgs: rows.length, projects: rows.reduce((s, r) => s + r.projects, 0) };
  for (const r of rows) {
    fold({
      key: orgKey(r.name) || r.name.toLowerCase(),
      name: r.name, login: r.login, site: r.site, desc: r.desc,
      sector: r.sector, techs: r.techs, years: r.years, projects: r.projects,
      stars: r.stars, repos: r.repos, issues: r.issues,
      programs: [{ id, label: LABEL[id] ?? id, projects: r.projects, years: r.years }],
    }, r.from.join("+") || "archive");
  }
}

/* ── 2. the profiles the directory tracks, so a card with live GitHub
       numbers carries them here too. Only an archive's project count is a
       mentored project; a repo that merely carries a program topic is
       association, and it is shown as that.                          ── */
for (const o of ORGS) {
  /* only an archive that recorded accepted projects counts here; a repository
     carrying a program topic is an association, not a mentored season */
  const assoc = programsOf(o.login).filter((a) => a.unit === "project");
  fold({
    key: orgKey(o.login) || o.name.toLowerCase(),
    name: o.name, login: o.login, site: `https://${o.domain}`, desc: o.tagline,
    sector: sectorOf(o.tagline, o.name, ...(o.tags ?? [])),
    techs: normalizeTechs(o.tags ?? []), years: [],
    projects: assoc.reduce((s, a) => s + (a.unit === "project" ? a.n : 0), 0),
    stars: o.stars, repos: o.repos, issues: o.issues,
    programs: assoc.map((a) => ({ id: a.id, label: a.label, projects: a.n, years: [] })),
  }, "directory");
}

/* ── 2b. one GitHub account is one organization, however many ways the records
   spell its name. "Python Software Foundation" and "Python" are the same
   account, and a stats page that lists both twice is wrong even though every
   row came from a real record. Name-only folding cannot catch that, so rows
   that carry a confirmed login are folded a second time on the login.    ── */
const byLogin = new Map();
const loginMerged = [];
for (const r of byKey.values()) {
  if (!r.login) { loginMerged.push(r); continue; }
  const k = r.login.toLowerCase();
  const prev = byLogin.get(k);
  if (!prev) { byLogin.set(k, r); loginMerged.push(r); continue; }
  if (r.name.length > prev.name.length) prev.name = r.name;
  prev.site = prev.site || r.site;
  prev.desc = prev.desc || r.desc;
  if (prev.sector === "Other" && r.sector !== "Other") prev.sector = r.sector;
  prev.techs = normalizeTechs([...prev.techs, ...r.techs]);
  prev.years = [...new Set([...prev.years, ...r.years])].sort((a, b) => b - a);
  prev.stars = Math.max(prev.stars, r.stars);
  prev.repos = Math.max(prev.repos, r.repos);
  prev.issues = Math.max(prev.issues, r.issues);
  for (const p of r.programs) {
    const mine = prev.programs.find((x) => x.id === p.id);
    if (mine) {
      mine.projects = Math.max(mine.projects, p.projects);
      mine.years = [...new Set([...mine.years, ...p.years])].sort((a, b) => b - a);
    } else prev.programs.push(p);
  }
  for (const f of r.from) if (!prev.from.includes(f)) prev.from.push(f);
}

/* ── 2c. the same host spelled two ways in two records. "OWASP" and "OWASP
   Foundation", "KDE Community" and "KDE (unspecified project)", "Wikimedia"
   and "Wikimedia Foundation" are one organization each, and a leaderboard
   that shows both halves of the pair at ranks 3 and 4 is simply wrong.

   So every name is reduced to a legal-form-free core ("OWASP Foundation" ->
   "owasp"), and rows whose cores match are folded together. Two guards keep
   this from over-merging: rows that carry two different confirmed GitHub
   accounts are never folded, and every pair the rule would join is printed
   when the script runs so the list can be read over.                    ── */
const NOISE = new Set([
  "the", "a", "an", "and", "of", "for", "inc", "llc", "ltd", "ev",
  "foundation", "software", "project", "projects", "community", "initiative",
  "association", "society", "organization", "organisation", "institute",
  "institution", "mirror", "github", "development", "group", "council",
  "international", "national", "european", "asia",
]);

const core = (name) => {
  const bare = name.replace(/\([^)]*\)/g, " ").replace(/[’'`]/g, "").toLowerCase();
  return bare.split(/[^a-z0-9.+-]+/).filter((t) => t && !NOISE.has(t)).join(" ");
};

/** a name with no parenthesised qualifier, and the shortest such name: the
 *  account label the records actually use, not an archive's footnote. */
const bestName = (names) => {
  const clean = names.filter((n) => !n.includes("("));
  const pool = clean.length ? clean : names;
  return pool.sort((a, b) => a.length - b.length)[0];
};

const mergeInto = (prev, r) => {
  prev.names.push(r.name);
  prev.site = prev.site || r.site;
  prev.desc = prev.desc || r.desc;
  if (prev.sector === "Other" && r.sector !== "Other") prev.sector = r.sector;
  prev.techs = normalizeTechs([...prev.techs, ...r.techs]);
  prev.years = [...new Set([...prev.years, ...r.years])].sort((a, b) => b - a);
  prev.projects = Math.max(prev.projects, r.projects);
  prev.login = prev.login ?? r.login;
  prev.stars = Math.max(prev.stars, r.stars);
  prev.repos = Math.max(prev.repos, r.repos);
  prev.issues = Math.max(prev.issues, r.issues);
  for (const p of r.programs) {
    const mine = prev.programs.find((x) => x.id === p.id);
    if (mine) {
      mine.projects = Math.max(mine.projects, p.projects);
      mine.years = [...new Set([...mine.years, ...p.years])].sort((a, b) => b - a);
    } else prev.programs.push(p);
  }
  for (const f of r.from) if (!prev.from.includes(f)) prev.from.push(f);
};

const byCore = new Map();
const coreMerged = [];
const merges = [];
for (const r of loginMerged) r.names = [r.name];
for (const r of loginMerged) {
  const k = core(r.name);
  const prev = k ? byCore.get(k) : undefined;
  if (!prev || (prev.login && r.login && prev.login.toLowerCase() !== r.login.toLowerCase())) {
    if (k && !prev) byCore.set(k, r);
    coreMerged.push(r);
    continue;
  }
  merges.push([prev.name, r.name]);
  mergeInto(prev, r);
}
if (merges.length) {
  console.log(`\nname-core merges (${merges.length}):`);
  for (const [a, b] of merges.sort()) console.log(`  ${a}  <=  ${b}`);
}

const out = coreMerged
  .filter((r) => r.name)
  .map(({ names, ...r }) => ({
    ...r,
    name: bestName(names),
    programs: r.programs.sort((a, b) => b.projects - a.projects || a.id.localeCompare(b.id)),
    projects: r.programs.reduce((s, p) => s + (p.projects || 0), 0) || r.projects,
    logo: r.login ? `https://github.com/${r.login}.png?size=96` : "",
    nprograms: r.programs.length,
    programs: r.programs.map((p) => ({ id: p.id, projects: p.projects, years: p.years })),
    from: [...new Set(r.from.flatMap((f) => f.split("+")))],
    desc: r.desc.length > 240 ? `${r.desc.slice(0, 237).trimEnd()}...` : r.desc,
  }))
  .sort((a, b) => b.projects - a.projects || b.stars - a.stars || a.name.localeCompare(b.name));

/* ── 3. the aggregates the page reads instead of recomputing ──────────────── */
function tally(rows, of) {
  const m = new Map();
  for (const r of rows) for (const v of of(r)) m.set(String(v), (m.get(String(v)) ?? 0) + 1);
  return [...m.entries()];
}

const stats = {
  orgs: out.length,
  withLogin: out.filter((r) => r.login).length,
  inMany: out.filter((r) => r.nprograms > 1).length,
  projects: out.reduce((s, r) => s + r.projects, 0),
  programs: Object.keys(perProgram).length,
  directory: ORGS.length,
  sectors: tally(out, (r) => [r.sector]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  years: tally(out, (r) => r.years).sort((a, b) => Number(a[0]) - Number(b[0])),
  techs: tally(out, (r) => r.techs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40),
  spread: tally(out, (r) => [r.nprograms]).sort((a, b) => Number(a[0]) - Number(b[0])),
  perProgram,
  programCounts: Object.fromEntries(tally(out, (r) => r.programs.map((p) => p.id))),
};

const file = {
  generated: roster?.generated ?? new Date().toISOString().slice(0, 10),
  source: "scripts/org-stats.mjs - mergeProgramOrgs over every program shard and archive, folded on the organization name, unioned with the tracked GitHub profiles",
  note: "One row per distinct organization: a row seen in three programs is one organization, not three.",
  stats,
  orgs: out,
};

writeFileSync(data("org-stats.json"), JSON.stringify(file));
const bytes = readFileSync(data("org-stats.json")).byteLength;
console.log(`wrote ${out.length} organizations (${(bytes / 1024).toFixed(0)} KB) - ${stats.projects} projects, ${stats.inMany} in more than one program, ${stats.withLogin} with a GitHub account`);
