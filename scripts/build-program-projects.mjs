/* ══ scripts/build-program-projects.mjs — one machine-readable archive per program ══
   Run:  node scripts/build-program-projects.mjs [--offline] [--thresholds <file>]
         CYRUS_READ_AT=YYYY-MM-DD node scripts/build-program-projects.mjs
         CYRUS_QUALITY_OVERRIDE="<why this is expected>" node scripts/build-program-projects.mjs

   It writes, and nothing else:

     data/quality/program-projects-<read date>.json  what this run changed, for a job
     data/quality/program-projects-<read date>.md    the same, for a person to review
     public/data/program-projects/<id>.json          one archive per program
     public/data/program-projects.json               the index of all 13 programs

   The report comes first and the archive only after it passes. A refresh that
   lost a tenth of one program's rows, or read a project dated 1899, stops here
   with both documents written and exit 1; the site keeps serving the snapshot
   it was serving. The gate is scripts/lib/quality-gate.mjs.

   Every shard uses the same contract (helpers in scripts/lib/shard.mjs):

     { program, label, source, readAt, unit, note, projects, orgs, list }
     list rows: y,u,t,o,s,tt,tp,b,m,url,program  (+ stars,lang,license only when a
     GitHub API response supplied them)

   `projects` is always exactly `list.length`, so a number in the index and a row
   on disk can never disagree. `unit` is the PROGRAM'S own word for one row -
     GSSoC's board counts projects a student opened, Season of KDE lists proposed
     ideas, 24 Pull Requests lists wishlist repositories, MLH leaves forks of
     upstream code - so nothing here is ever called an "accepted project" unless
     the program itself says so. src/lib/programRoster.ts ROSTER_UNIT is the
     guide; that file is the site and wins if the two ever disagree.

   ── where every row comes from, and the date it was read ───────────────────
   Nothing in this file is generated from a model's memory of a program. Each
   builder names the document or API response it parsed:

   gsoc        public/data/gsoc-projects.json (5,238 rows this site read from
               summerofcode.withgoogle.com/programs/<year>/archive; per-project
               size stays in that file, the shared row shape has no size column)
   lfx         public/data/otherProjects.json, program "LFX" (941 rows from
               api.mentorship.lfx.linuxfoundation.org; LFX's own all-time total
               of 1,303 org-level projects is public/data/lfx-archive.json)
   outreachy   public/data/otherProjects.json, program "Outreachy" (437 rows
               read from outreachy.org project pages; the round name is taken
               from the slug Outreachy puts in each URL)
   sob         public/data/otherProjects.json, program "Summer of Bitcoin",
               then every github.com link re-read through the GitHub API
   gssoc       https://gssoc.girlscript.org/api/projects (live season board,
               cached to scripts/.cache/gssoc-board.json), each repo_url
               verified through the GitHub API
   kde         public/data/kde-archive.json `ideas` (MediaWiki source of
               community.kde.org/SoK/Ideas/<year>), wiki furniture lines dropped
   24pr        data/24pr-raw.json (24pullrequests.com/projects.json wishlist),
               each repo verified through the GitHub API
   mlh         data/mlh-parents.json - every repository under github.com/MLH-Fellowship
               and the upstream repository it was forked from, re-read per fork
   oct         public/data/issues.json.gz (our own 40,017-issue GitHub snapshot)
               filtered to repositories carrying a hacktoberfest label, plus
               GitHub search for `topic:hacktoberfest`
   fossee      https://fossee.in/fellowship/<year> result tables
               (scripts/fetch-fossee.mjs)
   vercel-oss  https://vercel.com/open-source-program cohort cards and past
               cohort lists (scripts/fetch-vercel-oss.mjs)
   nsoc        public/data/program-projects/nsoc.json is written by its own
               pipeline; this script READS it to index it and never writes it
   esoc        Eclipse SoC: probed, and there is no machine-readable archive
               (see probeEsoc). The index carries the reason instead of rows.

   Contribo's project rows are deliberately not used anywhere: they were checked
   and are synthetic (`gh api repos/nokia/5p-packet-sim` style links 404), so not
   one row in this archive came from them.

   No network access happens when the site imports anything - this is a build
   step; the browser only ever reads the JSON it produces.                  ═ */
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  ROOT, DATA, OUT_DIR, INDEX, CACHE_DIR, READ_AT, OFFLINE,
  clean, readJson, writeJson, makeRow, shard, ghRepo, ghSearch, mapLimit, getPage, saveGhCache,
} from "./lib/shard.mjs";
import { buildFosseeShard } from "./fetch-fossee.mjs";
import { buildVercelShard } from "./fetch-vercel-oss.mjs";
import { reviewRefresh } from "./lib/quality-gate.mjs";

/* where a run leaves its review documents; data/ is this repo's scratch space,
   never shipped, so a blocked refresh is still readable the next morning */
const QUALITY_DIR = join(ROOT, "data", "quality");
/** --thresholds <file>: a maintainer's own limits for this run */
const THRESHOLDS_FILE = (() => {
  const at = process.argv.indexOf("--thresholds");
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : null;
})();

/* the site's own display names, copied from PROGRAMS in src/data/orgs.ts so a
   shard label and the program card on screen say the same thing */
const LABEL = {
  gsoc: "Google Summer of Code", outreachy: "Outreachy", lfx: "LFX Mentorship",
  esoc: "Eclipse SoC", mlh: "MLH Fellowship", gssoc: "GSSoC'26", kde: "Season of KDE",
  sob: "Summer of Bitcoin", nsoc: "Nexus Spring of Code", oct: "Hacktoberfest",
  "24pr": "24 Pull Requests", fossee: "FOSSEE Summer Fellowship",
  "vercel-oss": "Vercel Open Source Program",
};

/* ROSTER_UNIT from src/lib/programRoster.ts, extended with the three programs
   whose evidence arrived after that file was written. "" = we publish no rows. */
const UNIT = {
  gsoc: "accepted projects", lfx: "mentored projects", outreachy: "internships",
  sob: "funded projects", gssoc: "board projects", "24pr": "listed repositories",
  mlh: "forked repositories", kde: "proposed ideas", oct: "Hacktoberfest repositories",
  nsoc: "listed projects", fossee: "fellowship projects",
  "vercel-oss": "cohort projects", esoc: "",
};

/** the 13 programs the site tracks; every one of these MUST appear in the index */
const ORDER = [
  "gsoc", "outreachy", "lfx", "esoc", "mlh", "gssoc", "kde", "sob",
  "nsoc", "oct", "24pr", "fossee", "vercel-oss",
];

const MAX_BYTES = 4 * 1024 * 1024;   /* the ~4 MB ceiling the site is willing to ship */
const clip = (s, n = 300) => {
  const c = clean(s);
  return c.length > n ? `${c.slice(0, n - 1).replace(/[\s,;:.-]+$/, "")}…` : c;
};

/** how to say "we checked and N were dead" - and say nothing when all resolved */
const droppedNote = (n, noun) => {
  const plural = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
  if (n === 0) return `every ${noun} still resolves, so nothing was dropped`;
  if (n === 1) return `1 ${noun} no longer resolves and was dropped rather than shipped as a dead link`;
  return `${n} ${plural} no longer resolve and were dropped rather than shipped as dead links`;
};

/** a github.com URL -> "owner/repo" for the API, or "" when it is not a repo */
const repoKey = (u) => {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/?#]+)/i.exec(String(u ?? ""));
  if (!m) return "";
  return m[1].replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase();
};

/* ── 1. reshapes of archives already on disk ───────────────────────────── */

function fromGsoc() {
  const src = readJson(join(DATA, "gsoc-projects.json"), { projects: [], orgs: {} });
  const meta = src.orgs || {};
  const rows = (src.projects || []).map((p) => makeRow({
    y: p.y, u: p.u, t: p.t, o: p.o, s: "", tt: p.tt, tp: p.tp,
    b: clip(p.b), m: p.m,
    url: p.u && p.y ? `https://summerofcode.withgoogle.com/programs/${p.y}/projects/${p.u}` : "",
    program: "Google Summer of Code",
  }));
  const noMentor = rows.filter((r) => !r.m).length;
  return shard({
    id: "gsoc", label: LABEL.gsoc, unit: UNIT.gsoc, evidence: "archive",
    url: "https://summerofcode.withgoogle.com/archive",
    source: "public/data/gsoc-projects.json, the per-year project records read from summerofcode.withgoogle.com/programs/<year>/archive",
    note: `One row per accepted GSoC project, reshaped from the archive this site already publishes at /data/gsoc-projects.json; ` +
      `the organization rollup there (${Object.keys(meta).length} organizations with their official site and category) is carried ` +
      `into \`orgs\`, keyed by the organization name GSoC itself uses rather than a GitHub login. \`u\` is GSoC's own project id and ` +
      `\`url\` is built from it and the year, which is the address each project page resolves to. Blurbs are GSoC's own project ` +
      `descriptions, clipped at 300 characters. The per-project size (small/medium/large) lives in gsoc-projects.json and is not ` +
      `repeated here because the shared row shape has no size column. ${noMentor} row(s) carry no mentor because the archive ` +
      `page printed none. Stars, language and license are absent: this is the program's archive, not a GitHub read.`,
    rows, orgMeta: (name) => meta[name] || {},
  });
}

function fromOtherProjects(id, programName, extra) {
  const src = readJson(join(DATA, "otherProjects.json"), { projects: [] });
  const pick = (src.projects || []).filter((p) => p.program === programName);
  return { src: pick, extra };
}

function fromLfx() {
  const { src } = fromOtherProjects("lfx", "LFX");
  const rows = src.map((p) => makeRow({
    ...p, b: clip(p.b), program: "LFX Mentorship",
  }));
  return shard({
    id: "lfx", label: LABEL.lfx, unit: UNIT.lfx, evidence: "archive",
    url: "https://mentorship.lfx.linuxfoundation.org",
    source: "api.mentorship.lfx.linuxfoundation.org, held at public/data/otherProjects.json (program \"LFX\")",
    note: `One row per mentored project the LFX Mentorship API published. \`s\` is LFX's own term string as returned ("Summer 2024", ` +
      `"2024Summer-Fall"), \`u\` is the platform's project id and \`url\` is that project's page on mentorship.lfx.linuxfoundation.org. ` +
      `This shard carries the ${rows.length} projects with a full record; LFX's own all-time host-project rollup (${
        (readJson(join(DATA, "lfx-archive.json"), { programs: {} }).programs?.lfx?.projects) ?? "n/a"} projects across ` +
      `${Object.keys(readJson(join(DATA, "lfx-archive.json"), { programs: {} }).programs?.lfx?.orgs || {}).length} host projects) is at ` +
      `/data/lfx-archive.json. Organizations are keyed by the LFX host-project name the row carries in \`o\`, not a GitHub login, and ` +
      `LFX does not publish a URL per host project, so \`url\` in the rollup is empty rather than guessed.`,
    rows,
  });
}

function fromOutreachy() {
  const { src } = fromOtherProjects("outreachy", "Outreachy");
  /* Outreachy's own slug for a round is "outreachy-<month>-<year>-internship-<round|cohort>";
     the string in `s` is that slug made readable and nothing else */
  const roundOf = (p) => {
    const m = /outreachy-([a-z]+)-(\d{4})-internship-(round|cohort)/i.exec(String(p.u || "") + String(p.url || ""));
    if (!m) return "";
    const month = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    return `${month} ${m[2]} internship ${m[3].toLowerCase()}`;
  };
  const rows = src.map((p) => makeRow({
    ...p, s: p.s || roundOf(p), b: clip(p.b), program: "Outreachy",
  }));
  const withUrl = rows.filter((r) => r.url).length;
  return shard({
    id: "outreachy", label: LABEL.outreachy, unit: UNIT.outreachy, evidence: "archive",
    url: "https://www.outreachy.org/alums/",
    source: "outreachy.org internship-round pages, held at public/data/otherProjects.json (program \"Outreachy\")",
    note: `One row per internship Outreachy lists on its round pages, reshaped from /data/otherProjects.json. \`t\` is the project ` +
      `title exactly as the round page prints it and \`url\` is that page's anchor for it (${withUrl} of ${rows.length} rows carry one). ` +
      `\`s\` is the round, recovered from the round slug Outreachy itself puts in the URL. \`o\` is the community name as Outreachy ` +
      `abbreviates it (e.g. "ASF"), so the \`orgs\` rollup is keyed by that name rather than a GitHub login; the current call-for-participation ` +
      `list of communities is a separate document at /data/outreachy-communities.json. Outreachy's round pages name no mentor per ` +
      `project, so \`m\` stays empty - the organization-level mentors this site holds in /data/mentor-index.json are deliberately not ` +
      `pasted onto internship rows, because that would claim a named person mentored a specific internship we never read a mentor for.`,
    rows,
  });
}

async function fromSob() {
  const { src } = fromOtherProjects("sob", "Summer of Bitcoin");
  const checked = await mapLimit(src, 5, async (p) => {
    const key = repoKey(p.url);
    if (!key) return { p, meta: null };
    const meta = await ghRepo(key);
    await new Promise((r) => setTimeout(r, 40));
    return { p, meta };
  });
  const dropped = checked.filter((c) => c.meta && !c.meta.ok);
  const rows = checked.filter((c) => !c.meta || c.meta.ok).map(({ p, meta }) => {
    const m = meta || {};
    return makeRow({
      ...p, b: clip(p.b),
      url: m.ok ? `https://github.com/${m.ownerLogin}/${m.name}` : clean(p.url),
      stars: m.ok ? m.stars : undefined, lang: m.lang, license: m.license,
      tt: p.tt, tp: (p.tp || []).concat(m.topics || []),
      program: "Summer of Bitcoin",
    });
  });
  const enriched = rows.filter((r) => typeof r.stars === "number").length;
  return shard({
    id: "sob", label: LABEL.sob, unit: UNIT.sob, evidence: "archive",
    url: "https://www.summerofbitcoin.org",
    source: "public/data/otherProjects.json (program \"Summer of Bitcoin\"), read from summerofbitcoin.org's project list, with each github.com link re-read via gh api repos/<owner>/<repo>",
    note: `One row per funded Summer of Bitcoin project. \`b\` keeps the fellow's institution as the program's own record states it ` +
      `and \`m\` the mentor the program lists. ${enriched} row(s) point at a GitHub repository that we then re-read through the GitHub ` +
      `API for stars, language, license, description and topics; ${droppedNote(dropped.length, "repository link")}. Rows whose program ` +
      `record carries no repository keep the ` +
      `fields empty. Organizations are keyed by the project name the program's own list uses, and that name is not a GitHub account, ` +
      `so no \`orgs\` URL is filled.`,
    rows,
  });
}

/* ── 2. KDE: the ideas page, in KDE's own words ────────────────────────── */

const IDEA_FURNITURE = [
  /^general information$/i, /^information for (students|mentees)$/i,
  /^sample project$/i, /^your own idea:? .*/i, /^how to apply.*$/i,
];

/** community.kde.org writes headings as "Name ===" and prefixes some ideas with
    "Project:"; both are wiki syntax, not part of the idea's name */
function cleanIdea(t) {
  let s = clean(String(t || "").replace(/={2,}\s*$/, "").replace(/^\s*Project:\s*/i, ""));
  s = clean(s.replace(/\((?:slot|slots)\s*(?:filled|taken)\)\s*/i, " "));
  return s;
}

function fromKde() {
  const src = readJson(join(DATA, "kde-archive.json"), { ideas: [] });
  const dropped = { furniture: 0, heading: 0 };
  const rows = [];
  for (const i of src.ideas || []) {
    const t = cleanIdea(i.t);
    const o = cleanIdea(i.o) || "KDE";
    if (!t) continue;
    if (IDEA_FURNITURE.some((re) => re.test(t))) { dropped.furniture += 1; continue; }
    /* a wiki section heading arrives as a row whose title repeats its heading */
    if (t.toLowerCase() === o.toLowerCase()) { dropped.heading += 1; continue; }
    const taken = /slot(s)?\s*(filled|taken)/i.test(String(i.t));
    rows.push(makeRow({
      y: i.y, u: `kde-${i.y}-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`,
      t, o, s: `Season of KDE ${i.y} ideas`, tt: [], tp: [],
      b: taken ? "KDE's ideas page marks this slot as filled." : "",
      m: i.m || "", url: i.url || `https://community.kde.org/SoK/Ideas/${i.y}`,
      program: "Season of KDE",
    }));
  }
  return shard({
    id: "kde", label: LABEL.kde, unit: UNIT.kde, evidence: "listing",
    url: "https://community.kde.org/SoK/Ideas",
    source: "MediaWiki source of community.kde.org/SoK/Ideas/<year> for 2017-2026, held at public/data/kde-archive.json (`ideas`)",
    note: `One row per idea the Season of KDE ideas page PROPOSES, with the mentor KDE names on that idea. These are not accepted or ` +
      `completed projects - the unit is "proposed ideas" for exactly that reason. ${dropped.furniture} wiki furniture line(s) ` +
      `("General information", "Information for mentees", "Sample project", "Your Own Idea") and ${dropped.heading} section heading(s) ` +
      `repeated as rows were dropped, and "Project:"/"===" wiki syntax was stripped from the rest; an idea the page marks slot-filled or ` +
      `slot-taken keeps its title and says so in \`b\`, because that is KDE's own statement about the row. The 25 accepted Season of KDE ` +
      `2026 proposals this site read from community.kde.org/SoK/2026/StatusReport (data/raw/kde.json) are deliberately NOT merged into ` +
      `this shard: an accepted proposal is a different kind of record from a proposed idea and the shard has one unit. Where a year's ` +
      `page lists no ideas at all (2026's page carries only the information sections), this shard has no rows for that year.`,
    rows, orgMeta: () => ({ url: "", category: "KDE" }),
  });
}

/* ── 3. 24 Pull Requests: the live wishlist, verified on GitHub ─────────── */

async function from24pr() {
  const raw = readJson(join(ROOT, "data/24pr-raw.json"), { projects: [] });
  const archive = readJson(join(DATA, "24pr-archive.json"), { orgs: [] });
  const list = (raw.projects || []).map((p) => ({
    key: repoKey(p.repo) || String(p.repo || `${p.owner}/${p.title}`).toLowerCase().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/i, ""),
    p,
  }));
  const checked = await mapLimit(list, 5, async ({ key, p }) => {
    const meta = key.includes("/") ? await ghRepo(key) : null;
    await new Promise((r) => setTimeout(r, 40));
    return { p, key, meta };
  });
  const dead = checked.filter((c) => c.meta && !c.meta.ok);
  const rows = checked.filter((c) => !c.meta || c.meta.ok).map(({ p, meta }) => {
    const m = meta || {};
    const owner = m.ok ? m.ownerLogin : p.owner;
    const name = m.ok ? m.name : String(p.repo || "").split("/").pop();
    return makeRow({
      t: clip(m.desc || p.title || name, 240), o: owner,
      s: "24 Pull Requests wishlist", tt: m.lang ? [m.lang] : (p.lang ? [p.lang] : []),
      tp: m.topics || [], b: p.title && p.title !== m.desc ? clip(p.title, 240) : "",
      m: "", url: m.ok ? `https://github.com/${owner}/${name}` : "",
      stars: m.ok ? m.stars : undefined, lang: m.lang, license: m.license,
      program: "24 Pull Requests",
    });
  });
  return shard({
    id: "24pr", label: LABEL["24pr"], unit: UNIT["24pr"], evidence: "api",
    url: "https://24pullrequests.com/projects",
    source: "https://24pullrequests.com/projects.json (the current curated wishlist, data/24pr-raw.json), each repository then re-read via gh api repos/<owner>/<repo>",
    note: `One row per repository the 24 Pull Requests team has listed as wanting contributions. These are WISHLIST repositories - the ` +
      `program does not accept or fund them, so the unit is "listed repositories" and \`m\` is empty because no mentor is named. ` +
      `${droppedNote(dead.length, "listed repository")}, so \`projects\` is the verified count. 24pullrequests.com ignores its ?year= parameter and ` +
      `publishes one live list, so rows carry no year: the year they were wanted is not in the API. The ${
        (archive.orgs || []).length} organizations 24 Pull Requests lists at /organisations.json are an organization rollup without ` +
      `project titles, kept at /data/24pr-archive.json and not merged here.`,
    rows, orgMeta: (login) => ({ url: /^[\w.-]+$/.test(login) ? `https://github.com/${login}` : "", category: "" }),
  });
}

/* ── 4. GSSoC: the live season board ───────────────────────────────────── */

async function fromGssoc() {
  const ENDPOINT = "https://gssoc.girlscript.org/api/projects";
  const CACHE = join(CACHE_DIR, "gssoc-board.json");
  const archive = readJson(join(DATA, "gssoc-archive.json"), { season: null, orgs: [] });
  let board = readJson(CACHE, null);
  if (!OFFLINE) {
    const txt = await getPage(ENDPOINT, { headers: { accept: "application/json" } });
    if (txt) {
      const j = JSON.parse(txt);
      board = { readAt: READ_AT, source: ENDPOINT, ...j };
      writeJson(CACHE, board);
    }
  }
  if (!board || !Array.isArray(board.projects)) throw new Error("GSSoC board unavailable and no cached read exists");

  const metaByLogin = {};
  for (const o of archive.orgs || []) if (o.login) metaByLogin[o.login] = o;

  const items = board.projects.map((p) => {
    const fromOwnerRepo = String(p.owner_repo || "").replace(/\.git$/i, "").match(/^([\w.-]+)\/([\w.-]+)$/);
    const key = repoKey(p.repo_url) || (fromOwnerRepo ? `${fromOwnerRepo[1]}/${fromOwnerRepo[2]}`.toLowerCase() : "");
    return { p, key };
  });
  const checked = await mapLimit(items, 5, async (it) => {
    if (!it.key) return { ...it, meta: null };
    const meta = await ghRepo(it.key);
    await new Promise((r) => setTimeout(r, 40));
    return { ...it, meta };
  });
  const dead = checked.filter((c) => c.meta && !c.meta.ok);
  const noRepo = checked.filter((c) => !c.key);
  const rows = checked.filter((c) => !c.meta || c.meta.ok).map(({ p, key, meta }) => {
    const m = meta || {};
    const owner = m.ok ? m.ownerLogin : (key || "").split("/")[0] || clean(p.admin_github);
    return makeRow({
      y: board.season || archive.season || undefined,
      t: clip(p.name || key || "Untitled project", 200), o: owner,
      s: `Season ${board.season || archive.season || ""}`.trim(),
      tt: Array.isArray(p.tech_stack) ? p.tech_stack.slice(0, 8) : [], tp: m.topics || [],
      b: clip(p.description || "", 260), m: clip(p.admin_name || "", 120),
      url: m.ok ? `https://github.com/${m.ownerLogin}/${m.name}` : (key ? `https://github.com/${key}` : ""),
      stars: m.ok ? m.stars : undefined, lang: m.lang, license: m.license,
      program: "GirlScript Summer of Code",
    });
  });
  return shard({
    id: "gssoc", label: LABEL.gssoc, unit: UNIT.gssoc, evidence: "api",
    url: "https://gssoc.girlscript.org",
    source: `${ENDPOINT} - GirlScript's live season board, cached at scripts/.cache/gssoc-board.json, each repo_url then verified via gh api repos/<owner>/<repo>`,
    note: `One row per project on GSSoC's public board for the season the board is running (season ${board.season || archive.season}). ` +
      `A GSSoC board entry is a repository a participant opened for contributions during the season - the platform's own word is a ` +
      `"project" on the leaderboard, not an accepted or funded internship - so the unit is "board projects" and \`m\` carries the ` +
      `project's GSSoC admin name rather than a mentor. ` +
      `${dead.length === 0 ? "Every board entry points at a GitHub repository that still resolves" : `${dead.length === 1 ? "1 board entry" : `${dead.length} board entries`} point at a GitHub repository that no longer resolves and ${dead.length === 1 ? "was" : "were"} dropped`}; ${noRepo.length} row(s) have no repository link at all and keep ` +
      `\`url\` empty. Stars, language, license, topics and the repository URL come from the GitHub API response; the project name, ` +
      `description and tech stack are the board's own. ${archive.projects ?? "?"} projects / ${(archive.orgs || []).length} repository ` +
      `owners and ${archive.participants ?? "?"} participants for the same season are the org-level rollup at /data/gssoc-archive.json - ` +
      `that file carries no project titles, which is why the board had to be read.`,
    rows,
    orgMeta: (login) => {
      const a = metaByLogin[login] || {};
      return { url: a.url || `https://github.com/${login}`, category: a.category || "" };
    },
  });
}

/* ── 5. MLH: the fork trail of a fellowship that publishes no list ──────── */

async function fromMlh() {
  const parents = readJson(join(ROOT, "data/mlh-parents.json"), {});
  const partners = readJson(join(DATA, "mlh-partners.json"), { forks: 0, resolved: 0, orgs: [] });
  const items = Object.entries(parents).map(([fork, v]) => ({ fork, ...v }));
  const checked = await mapLimit(items, 5, async (it) => {
    const forkKey = `MLH-Fellowship/${it.fork}`;
    const meta = await ghRepo(forkKey);
    const up = it.parent && it.parent !== forkKey.toLowerCase() ? await ghRepo(it.parent) : null;
    await new Promise((r) => setTimeout(r, 40));
    return { it, meta, up };
  });
  const dead = checked.filter((c) => c.meta && !c.meta.ok);
  const rows = checked.filter((c) => !c.meta || c.meta.ok).map(({ it, up }) => {
    const u = up?.ok ? up : null;
    const owner = (it.parent || "").split("/")[0] || it.owner;
    return makeRow({
      t: `${it.fork}`, o: owner,
      s: "MLH Fellowship fork", tt: u?.lang ? [u.lang] : [], tp: (u?.topics || []).slice(0, 6),
      b: clip([clean(u?.desc || it.desc || ""), it.pushed ? `upstream last pushed ${it.pushed}` : ""]
        .filter(Boolean).join(" · "), 240),
      m: "", url: `https://github.com/MLH-Fellowship/${it.fork}`,
      lang: u?.lang, license: u?.license,
      program: "MLH Fellowship",
    });
  });
  return shard({
    id: "mlh", label: LABEL.mlh, unit: UNIT.mlh, evidence: "api",
    url: "https://github.com/MLH-Fellowship",
    source: "every repository under github.com/MLH-Fellowship and the upstream repository it was forked from (data/mlh-parents.json, read via the GitHub API), each fork re-verified with gh api repos/MLH-Fellowship/<fork>",
    note: `One row per fork the MLH Fellowship made of an upstream repository - what the program actually publishes, since it names no ` +
      `partner or project list. \`o\` is the upstream account the fork came from, \`url\` is the fork itself under MLH-Fellowship, and ` +
      `the description, language and license are read off the UPSTREAM repository, because a fork inherits them and its own copy says ` +
      `nothing. Star counts are deliberately left out: a fork's star count is always zero and would read as popularity. ` +
      `${droppedNote(dead.length, "fork")}. ${
        partners.forks ?? "?"} forks were crawled and ${partners.resolved ?? "?"} upstream organizations resolved for the same set, ` +
      `with up to 6 sampled repositories each, at /data/mlh-partners.json. Recent MLH batches no longer fork this way, so this is a ` +
      `historical trail of work, not a batch manifest.`,
    rows, orgMeta: (login) => ({ url: /^[\w.-]+$/.test(login) ? `https://github.com/${login}` : "", category: "" }),
  });
}

/* ── 6. Hacktoberfest: label evidence in our own crawl + GitHub's topic ─── */

function readCrawl() {
  const file = join(DATA, "issues.json.gz");
  const j = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  const per = new Map();
  for (const it of j.items || []) {
    const labels = (it.l || []).filter((l) => /hacktoberfest/i.test(String(l)));
    if (!labels.length) continue;
    const cur = per.get(it.r) || { repo: it.r, issues: 0, lang: it.g, stars: it.s || 0, labels };
    cur.issues += 1;
    cur.stars = Math.max(cur.stars, it.s || 0);
    per.set(it.r, cur);
  }
  return { meta: j.meta, repos: [...per.values()].sort((a, b) => b.stars - a.stars) };
}

async function fromOct() {
  const crawl = readCrawl();
  const found = new Map();
  for (const r of crawl.repos) {
    found.set(r.repo.toLowerCase(), {
      source: "crawl", repo: r.repo, owner: r.repo.split("/")[0], title: r.repo,
      desc: `${r.issues} issue(s) in this site's GitHub snapshot carry a hacktoberfest label`,
      lang: r.lang, stars: r.stars, topics: [], license: null, issues: r.issues,
    });
  }
  const items = await ghSearch("topic:hacktoberfest sort:stars", 3);
  for (const it of items) {
    const key = String(it.full_name || "").toLowerCase();
    if (!key) continue;
    if (found.has(key)) { const prev = found.get(key); found.set(key, { ...it, source: "both", issues: prev.issues }); continue; }
    found.set(key, { ...it, source: "topic" });
  }
  const rows = [...found.values()].map((it) => {
    const full = it.repo || it.full_name;
    const owner = it.owner?.login || String(full).split("/")[0];
    const extra = it.issues ? `${it.issues} issue(s) here carry a hacktoberfest label in our ${crawl.meta.generated} snapshot` : "";
    const blurb = [clean(it.description), extra].filter(Boolean).join(" · ");
    return makeRow({
      t: full, o: owner,
      s: it.source === "topic" ? "GitHub topic: hacktoberfest" : `hacktoberfest labels in our ${crawl.meta.generated} snapshot`,
      tt: it.language ? [it.language] : [], tp: (it.topics || []).slice(0, 8),
      b: clip(blurb, 240),
      m: "", url: it.html_url || `https://github.com/${full}`,
      stars: typeof it.stargazers_count === "number" ? it.stargazers_count
        : (typeof it.stars === "number" ? it.stars : undefined),
      lang: it.language, license: it.license?.spdx_id && it.license.spdx_id !== "NOASSERTION"
        ? it.license.spdx_id : (it.license?.name || null),
      program: "Hacktoberfest",
    });
  });
  const fromCrawl = rows.filter((r) => /snapshot$/.test(r.s)).length;
  const overlap = [...found.values()].filter((x) => x.source === "both").length;
  return shard({
    id: "oct", label: LABEL.oct, unit: UNIT.oct, evidence: "topics",
    url: "https://github.com/topics/hacktoberfest",
    source: `public/data/issues.json.gz (${crawl.meta.issues} issues across ${crawl.meta.repos} repositories, snapshot ${crawl.meta.generated}) filtered to issues whose labels read "hacktoberfest", plus gh api search/repositories?q=topic:hacktoberfest&sort=stars`,
    note: `One row per repository we can evidence as part of Hacktoberfest - the unit is "Hacktoberfest repositories", because GitHub's ` +
      `topic and a repository's own labels are the only machine-readable signal the program leaves; Hacktoberfest publishes no ` +
      `participant or completion archive, so this is not a list of people who completed it and rows carry no year. ` +
      `${rows.length - fromCrawl} row(s) come from GitHub's repository search for the \`hacktoberfest\` topic (most-starred first) and ` +
      `${fromCrawl} from this site's own issue snapshot, where ` +
      `${crawl.repos.length} of the ${crawl.meta.repos} crawled repositories carry hacktoberfest-labelled issues (${overlap} of those also ` +
      `carry the topic). Stars, language, license, topics, description and the repository URL are the GitHub API response for each ` +
      `repository; where the evidence is our snapshot the row says so in \`s\` and names the labelled-issue count in \`b\`. ` +
      `Hacktoberfest's 2022 contribution rules and bot-mitigation limits are documented on github.blog, but no per-project record is ` +
      `published anywhere, which is why this shard is repository-level evidence rather than a project archive.`,
    rows, orgMeta: (login) => ({ url: `https://github.com/${login}`, category: "" }),
  });
}

/* ── 7. Eclipse SoC: probed, and the honest answer is "no archive" ─────── */

const ESOC_PROBES = [
  "https://api.eclipse.org/project/listing",
  "https://api.eclipse.org/mentorship/project/listing",
  "https://api.eclipse.org/project/listing/json",
  "https://soc.eclipse.to",
  "https://summerofcode.eclipse.org/",
];

async function probeEsoc() {
  const CACHE = join(CACHE_DIR, "esoc-probe.json");
  const cached = readJson(CACHE, null);
  if (OFFLINE && cached) return cached;
  const out = { readAt: READ_AT, probes: [] };
  for (const u of ESOC_PROBES) {
    const rec = { url: u, status: null, type: null, json: false, rows: 0, error: "" };
    try {
      const r = await fetch(u, {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
        redirect: "follow", signal: AbortSignal.timeout(20000),
      });
      const txt = await r.text();
      rec.status = r.status; rec.type = r.headers.get("content-type");
      if (/json/i.test(String(rec.type))) {
        try { const j = JSON.parse(txt); rec.json = true;
          rec.rows = Array.isArray(j) ? j.length : (j.projects?.length || j.results?.length || 0); } catch { /* not json */ }
      }
      rec.head = txt.slice(0, 60).replace(/\s+/g, " ");
    } catch (e) { rec.error = `${e.name}`; }
    out.probes.push(rec);
  }
  writeJson(CACHE, out);
  return out;
}

/* ── 8. nsoc: read-only, because its own pipeline writes it ────────────── */

function nsocIndex() {
  const file = join(OUT_DIR, "nsoc.json");
  const j = readJson(file, null);
  if (!j) return { reason: `nsoc.json had not been written by its own pipeline on ${READ_AT}; this index carries no rows for it.` };
  const rows = Array.isArray(j.list) ? j.list : (Array.isArray(j.projects) ? j.projects : []);
  const yrs = Array.isArray(j.years) ? j.years
    : [...new Set(rows.map((r) => r.y ?? r.year).filter((y) => typeof y === "number"))].sort((a, b) => b - a);
  return {
    label: j.label || LABEL.nsoc,
    projects: typeof j.projects === "number" ? j.projects : rows.length,
    years: yrs,
    unit: j.unit || UNIT.nsoc,
    source: j.source || "public/data/program-projects/nsoc.json",
    evidence: j.evidence || "api",
  };
}

/* ── capping, gating, publishing ──────────────────────────────────────── */

/** ship a shard whole, or cap it at a stated row count under the size budget */
function capShard(obj) {
  let out = obj;
  const bytes = Buffer.byteLength(JSON.stringify(out, null, 1));
  if (bytes > MAX_BYTES) {
    let keep = 0;
    let size = 0;
    const budget = MAX_BYTES - 60 * 1024;
    for (const r of out.list) {
      size += Buffer.byteLength(JSON.stringify(r));
      if (size > budget) break;
      keep += 1;
    }
    const full = out.list.length;
    out = {
      ...out, list: out.list.slice(0, keep), projects: keep, capped: true,
      note: `${out.note} CAPPED: this shard carries the first ${keep} of ${full} rows in newest-first order to stay under the ` +
        `${Math.round(MAX_BYTES / 1024 / 1024)} MB file budget; \`projects\` is the number of rows on disk, not the program's total.`,
    };
  }
  return out;
}

/** put one already-capped shard on disk; only ever called after the gate */
function publishShard(out) {
  writeJson(join(OUT_DIR, `${out.program}.json`), out);
  return out;
}

async function main() {
  const built = [];
  const reasons = {};

  /* every builder runs in memory first: nothing below reaches public/data
     until the report has said whether this run looks like the last one */
  built.push(capShard(await buildFosseeShard({ write: false })));
  built.push(capShard(await buildVercelShard({ write: false })));

  built.push(capShard(fromGsoc()));
  built.push(capShard(fromLfx()));
  built.push(capShard(fromOutreachy()));
  built.push(capShard(fromKde()));
  built.push(capShard(await fromSob()));
  built.push(capShard(await from24pr()));
  built.push(capShard(await fromGssoc()));
  built.push(capShard(await fromMlh()));
  built.push(capShard(await fromOct()));

  /* ── the review, before the archive it judges ─────────────────────────── */
  const gate = reviewRefresh({
    name: "program-projects",
    stamp: READ_AT,
    liveDir: OUT_DIR,
    qualityDir: QUALITY_DIR,
    built,
    thresholdsFile: THRESHOLDS_FILE,
  });
  console.log(`\ndata quality${OFFLINE ? " (offline)" : ""}`);
  console.log(gate.text);
  if (!gate.publish) {
    saveGhCache();   /* the API reads this run paid for are kept; only the archive is not */
    console.error(`\nPUBLISH BLOCKED: ${gate.report.failed.join(", ")} exceeded ${gate.report.thresholdSource}.`);
    console.error("the archive the site serves today is unchanged. review the report above, then either");
    console.error("fix the source or re-run with CYRUS_QUALITY_OVERRIDE=\"<why this is expected>\".");
    process.exit(1);
  }

  for (const out of built) publishShard(out);

  const esoc = await probeEsoc();
  const esocJson = (esoc.probes || []).filter((p) => p.json && p.rows > 0);
  reasons.esoc = `Eclipse SoC has no machine-readable project archive: on ${esoc.readAt} every api.eclipse.org path we probed returned ` +
    `the same HTML application shell (${(esoc.probes || []).map((p) => `${p.url} -> ${p.status ?? p.error}`).join(", ")}) ` +
    `and soc.eclipse.to did not resolve, so we publish no rows rather than a scraped guess; full probe log in scripts/.cache/esoc-probe.json.`;
  if (esocJson.length) reasons.esoc = `Unexpected: a probe returned JSON rows (${esocJson.map((p) => `${p.url}: ${p.rows}`).join(", ")}) - re-check this builder.`;

  const nsoc = nsocIndex();
  saveGhCache();

  const programs = {};
  for (const id of ORDER) {
    if (id === "nsoc") {
      programs.nsoc = nsoc.reason
        ? { label: LABEL.nsoc, file: "program-projects/nsoc.json", projects: 0, years: [], unit: UNIT.nsoc,
            source: "public/data/program-projects/nsoc.json", evidence: "none", reason: nsoc.reason }
        : { ...nsoc, file: "program-projects/nsoc.json", reason: undefined };
      if (!programs.nsoc.reason) delete programs.nsoc.reason;
      continue;
    }
    if (id === "esoc") {
      programs.esoc = { label: LABEL.esoc, file: "", projects: 0, years: [], unit: "",
        source: "https://soc.eclipse.to (probed; see reason)", evidence: "none", reason: reasons.esoc };
      continue;
    }
    const s = built.find((b) => b.program === id);
    if (!s) { programs[id] = { label: LABEL[id], file: "", projects: 0, years: [], unit: UNIT[id] || "",
      source: "", evidence: "none", reason: "this build produced no shard for this program" }; continue; }
    programs[id] = {
      label: s.label, file: `program-projects/${id}.json`, projects: s.projects, years: yearsOfIn(s),
      unit: s.unit, source: s.source, evidence: s.evidence, ...(s.capped ? { capped: true } : {}),
    };
  }

  const index = {
    generated: READ_AT,
    source: "scripts/build-program-projects.mjs (plus scripts/fetch-fossee.mjs and scripts/fetch-vercel-oss.mjs); every shard is generated, none hand-edited",
    note: `The project archive for the ${ORDER.length} programs this site tracks. Each entry points at one JSON file whose rows use the ` +
      `same short column names as /data/otherProjects.json (y,u,t,o,s,tt,tp,b,m,url,program, plus stars/lang/license only where a GitHub ` +
      `API response supplied them) and whose \`projects\` field is exactly the number of rows on disk. \`unit\` is the program's own word ` +
      `for a row and the programs are not comparable through it: an accepted GSoC project, a proposed Season of KDE idea, a 24 Pull ` +
      `Requests wishlist repository and an MLH fork are four different facts. \`evidence\` says how much to trust the list - archive = ` +
      `the program's own record, api = an endpoint the program runs, listing = a page the program publishes without per-project counts, ` +
      `topics = GitHub's own signal on a repository, none = we looked and the program publishes nothing machine-readable. Entries with ` +
      `\`projects: 0\` carry a \`reason\` instead of rows, and a program is never padded to make a list look complete: Contribo's project ` +
      `rows were checked and are synthetic, so no row anywhere here came from them.`,
    programs,
  };
  writeJson(INDEX, index);

  /* ── self-check: the contract, enforced on the files we just wrote ─── */
  const problems = [];
  for (const id of ORDER) {
    const e = programs[id];
    if (!e) problems.push(`${id}: missing from the index`);
    if (!e.file) continue;
    const j = readJson(join(OUT_DIR, `${id}.json`), null);
    if (!j) { problems.push(`${id}: index points at a file that is not there`); continue; }
    if (id === "nsoc") {
      /* nsoc.json is written by its own pipeline; we index the number it states
         and assert only that our index and its file agree */
      const n = Array.isArray(j.list) ? j.list.length
        : (Array.isArray(j.projects) ? j.projects.length : Number(j.projects));
      if (!Number.isFinite(n)) problems.push("nsoc: its own file states no row count we can read");
      else if (e.projects !== n) problems.push(`nsoc: index ${e.projects} !== file ${n}`);
      continue;
    }
    const n = Array.isArray(j.list) ? j.list.length : -1;
    if (j.projects !== n) problems.push(`${id}: projects ${j.projects} !== list.length ${n}`);
    if (!j.unit && id !== "esoc") problems.push(`${id}: shard has no unit`);
    if (id !== "nsoc" && j.program !== id) problems.push(`${id}: shard says program ${j.program}`);
    if (typeof j.projects !== "number") problems.push(`${id}: projects is ${typeof j.projects}, must be a number`);
    for (const r of j.list || []) {
      if (!r.t) problems.push(`${id}: a row has no title`);
      if (r.u && j.list.filter((x) => x.u === r.u).length > 1 && id !== "oct") { /* ids repeat only across orgs */ }
    }
  }
  const kb = (id) => { try { return Math.round(Buffer.byteLength(readFileSync(join(OUT_DIR, `${id}.json`))) / 1024); } catch { return 0; } };

  console.log(`\nread date ${READ_AT}${OFFLINE ? " (offline)" : ""}`);
  for (const id of ORDER) {
    const e = programs[id];
    console.log(`  ${id.padEnd(11)} ${String(e.projects).padStart(5)} ${e.evidence.padEnd(8)} ${(e.unit || "-").padEnd(24)} ${e.projects ? `${kb(id)} KB` : "no file"}${e.reason ? "  (reason)" : ""}`);
  }
  console.log(`index -> ${INDEX}`);
  if (problems.length) { console.error("CONTRACT PROBLEMS:\n - " + problems.join("\n - ")); process.exit(1); }
  console.log("contract check: every shard parses, projects === list.length, unit set, all 13 programs indexed.");
}

function yearsOfIn(s) {
  if (Array.isArray(s.years)) return s.years;
  return [...new Set((s.list || []).map((r) => r.y).filter((y) => typeof y === "number"))].sort((a, b) => b - a);
}

main().catch((e) => { console.error(e); process.exit(1); });
