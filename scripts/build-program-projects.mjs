/* ══ scripts/build-program-projects.mjs — one machine-readable archive per program ══
   Run:  node scripts/build-program-projects.mjs [--offline]
         CYRUS_READ_AT=YYYY-MM-DD node scripts/build-program-projects.mjs

   It writes, and nothing else:

     public/data/program-projects/<id>.json   one archive per program
     public/data/program-projects.json        the index of all 13 programs

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
import { openStaging, promoteSnapshot, formatPromotion } from "./lib/promote.mjs";
import { buildFosseeShard } from "./fetch-fossee.mjs";
import { buildVercelShard } from "./fetch-vercel-oss.mjs";

/* One run writes one versioned directory and nothing else. The site keeps
   serving the snapshot it has until every shard and the index passed the
   contract check below, at which point promoteSnapshot() swaps them together
   and keeps a copy of what it replaced (scripts/lib/promote.mjs). A fetch that
   died, a shard that does not parse, or an index that disagrees with its files
   therefore costs a release rather than leaving a half-new archive on disk.
   `data` is gitignored and never shipped, so the scratch lives there rather
   than inside public/data, which the build copies into the deployment. */
const staging = openStaging({
  dataDir: DATA,
  workDir: join(ROOT, "data"),
  name: "program-projects",
  stamp: READ_AT,
});
/** the datasets this run is responsible for, in the layout the site reads */
const stagedFiles = [];
const shardRel = (id) => `program-projects/${id}.json`;
const INDEX_REL = "program-projects.json";

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