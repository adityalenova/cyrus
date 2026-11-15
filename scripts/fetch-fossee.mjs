/* ══ scripts/fetch-fossee.mjs — the FOSSEE Summer Fellowship result tables ══
   node scripts/fetch-fossee.mjs [firstYear lastYear]      default 2018 2026
   (also importable: buildFosseeShard() is called by build-program-projects.mjs)

   FOSSEE (the FOSS Systematic Education & Research Group at IIT Bombay) runs
   the Summer Fellowship and publishes its outcome year by year, as a table,
   on its own site:

     https://fossee.in/fellowship/<year>

   The column headers are FOSSEE's own words and they drift between years -
   2026 is "Name of the intern / Floss Name / Project name / Institute Name /
   Report Link", 2025-2023 are "Name of the Fellow / Project name / Institute
   name / Report Link" - so the columns are mapped from each page's <th> row
   rather than assumed by position. A year whose page has no result table
   contributes nothing.

   One row = one fellowship project as FOSSEE lists it: the project title is
   the "Project name" cell, the organization is the "Floss Name" cell (the
   FOSS project the work went into, e.g. Scilab, eSim, XOJIT) or FOSSEE itself
   where the table has no such column, and the report link is the program's
   own project page. The fellow's name and institute are put in the blurb
   because FOSSEE publishes no mentor per project - naming the fellow in the
   `m` field would be a lie about who mentored it.

   A sample of report links is re-read over HTTP at build time; the rest are
   trusted as printed on the page on the readAt date. No GitHub enrichment:
   these rows are the fellowship record, not repositories, and the fellowship
   table does not link a repository.

   Output: public/data/program-projects/fossee.json (contract shape).      ═ */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OUT_DIR, READ_AT, OFFLINE, clean, readJson, writeJson, makeRow, shard, getPage, ROOT,
} from "./lib/shard.mjs";

const OUT = join(OUT_DIR, "fossee.json");
const RAW = join(ROOT, "scripts/.cache/fossee-raw.json");
const decode = (s) => String(s ?? "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/* One header claims at most one role, tested in this order: a combined column
   like 2021's "FLOSS / Topic of Fellowship" is the project, not the floss. */
const RULES = [
  ["report", [/report ?link/i, /^link$/i]],
  ["institute", [/institute/i, /^college name$/i, /organisation/i]],
  ["name", [/name of the (intern|fellow|student)/i, /^full name$/i, /^fellow$/i, /^intern$/i, /^name$/i]],
  ["floss", [/f(?:l)?o?s?s? name/i, /^floss$/i, /^foss$/i]],
  ["project", [/project name/i, /^project$/i, /^title$/i, /topic of fellowship/i, /^work$/i]],
];

/** FOSSEE's header cells, tolerant of the mismatched tags Drupal emits
   (the 2023 page writes `<th>Sr. No.</td>`, which breaks a strict <th> scan
   and silently shifts every column index under it). */
function headCells(tableHtml) {
  const row = tableHtml.match(/<thead[\s\S]*?<\/thead>/i)?.[0]
    ?? tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/i)?.[0] ?? "";
  return row
    .split(/<\/?t[hd][^>]*>/gi)
    .map((s) => clean(decode(s.replace(/<[^>]+>/g, " "))))
    .filter(Boolean);
}

/** FOSSEE's own header words -> our column roles, position-independent */
function mapHeaders(html) {
  const heads = headCells(html);
  const idx = {};
  heads.forEach((h, i) => {
    for (const [role, pats] of RULES) {
      if (idx[role] === undefined && pats.some((p) => p.test(h))) { idx[role] = i; break; }
    }
  });
  return { idx, heads };
}

/* FOSSEE puts more than one table on a fellowship page: the result table
   (which names each completed fellowship project and links its report) and,
   below it, a screening-task or contact table for applicants. Only a table
   with a fellow/intern column AND a report column is a result table; the
   others are ignored rather than folded in, because an applicant's screening
   task is not a fellowship project. */
function parsePage(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  const rows = [];
  const used = [];
  for (const t of tables) {
    const { idx, heads } = mapHeaders(t);
    if (idx.name === undefined || idx.project === undefined || idx.report === undefined) continue;
    used.push(heads.join(" | "));
    for (const tr of t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      if (cells.length < 3) continue;
      const cell = (i) => (i === undefined ? "" : (cells[i] ?? ""));
      const text = (i) => clean(decode(cell(i).replace(/<[^>]+>/g, " ")));
      const link = (i) => (cell(i).match(/href="([^"]+)"/i) || [])[1] || "";
      const abs = (u) => (!u ? "" : /^https?:/i.test(u) ? u : new URL(u, "https://fossee.in/").href);
      const name = text(idx.name);
      const project = text(idx.project);
      if (!name || !project || /^\d+$/.test(name)) continue;
      if (/name of the|topic of fellowship/i.test(project)) continue; /* a stray header row */
      rows.push({
        name, project,
        floss: text(idx.floss),
        institute: text(idx.institute),
        report: abs(link(idx.report)),
      });
    }
  }
  /* a year may print the same result list twice (2020 does, as two identical
     Google-Sheets tables); keep one row per fellow + project, the one with a
     report link if either has it */
  const best = new Map();
  for (const r of rows) {
    const k = `${r.name}|${r.project}`.toLowerCase();
    if (!best.has(k) || (!best.get(k).report && r.report)) best.set(k, r);
  }
  return { heads: used, rows: [...best.values()] };
}

/** which years publish a result table; probed, never assumed */
export async function fetchYears(from, to) {
  const out = [];
  for (let y = from; y <= to; y++) {
    const url = `https://fossee.in/fellowship/${y}`;
    const html = await getPage(url);
    if (!html) continue;
    const { heads, rows } = parsePage(html);
    if (!rows.length) { console.log(`  ${y}: no result table on the page`); continue; }
    console.log(`  ${y}: ${rows.length} rows from the result table [${heads[0]}]`);
    out.push({ year: y, url, heads, rows });
  }
  return out;
}

/** re-read a spread of report links so we are not shipping pure guesswork */
async function checkLinks(rows, n = 8) {
  if (OFFLINE || !rows.length) return { checked: 0, dead: 0, deadUrls: [] };
  const step = Math.max(1, Math.floor(rows.length / n));
  const pick = rows.filter((_, i) => i % step === 0).slice(0, n);
  let dead = 0; const deadUrls = [];
  for (const r of pick) {
    if (!r.report) continue;
    let ok = true;
    try {
      const res = await fetch(r.report, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20000) });
      ok = res.ok;
    } catch { ok = false; }
    if (!ok) { dead += 1; deadUrls.push(r.report); }
  }
  return { checked: pick.filter((r) => r.report).length, dead, deadUrls };
}

export async function buildFosseeShard({ from = 2018, to = 2026, write = true } = {}) {
  if (OFFLINE && readJson(OUT, null)) return readJson(OUT);

  let byYear = await fetchYears(from, to);
  if (!byYear.length) {
    const cached = readJson(RAW, null);
    if (!cached) throw new Error("fossee.in published no fellowship result table and no cached read exists");
    byYear = cached.years;
    console.log(`offline/cached: ${byYear.length} years from ${cached.readAt}`);
  } else {
    writeJson(RAW, { readAt: READ_AT, source: "https://fossee.in/fellowship/<year>", years: byYear });
  }

  const flat = byYear.flatMap((y) => y.rows.map((r) => ({ ...r, year: y.year, page: y.url })));
  const noLink = flat.filter((r) => !r.report).length;
  const link = await checkLinks(flat);

  const rows = byYear.flatMap((y) => y.rows.map((r) => makeRow({
    t: r.project, o: r.floss || "FOSSEE, IIT Bombay",
    s: `FOSSEE Summer Fellowship ${y.year}`, y: y.year,
    b: clean(`Fellow ${r.name}${r.institute ? ` - ${r.institute}` : ""}${r.floss ? ` - ${r.floss}` : ""}`),
    m: "", url: r.report || y.url, tt: [], tp: [], program: "FOSSEE",
  })));

  const out = shard({
    id: "fossee", label: "FOSSEE Summer Fellowship", evidence: "listing",
    url: "https://fossee.in/fellowship/2026", unit: "fellowship projects",
    source: `https://fossee.in/fellowship/<year> - the per-year result tables FOSSEE publishes (${byYear.map((y) => `${y.year}: ${y.rows.length}`).join(", ")})`,
    note: `One row per fellowship project in the outcome table FOSSEE (IIT Bombay) publishes for each year it has run the Summer Fellowship - ${byYear.length} years read, ${flat.length} rows in total. The title is the page's "Project name" cell, the organization is its "Floss Name" cell (the FOSS codebase the fellow worked on) or FOSSEE itself for the years whose table has no such column, and the link is the program's own project report page on static.fossee.in; ${noLink} row(s) whose table cell carries no report link fall back to that year's fellowship page instead. ${link.checked} report links were re-read this run and ${link.dead} did not answer${link.deadUrls.length ? ` (${link.deadUrls.slice(0, 3).join(", ")})` : ""}. FOSSEE names the fellow and the institute, not a mentor, so the fellow and institute sit in the blurb and \`m\` is empty; no row carries a repository, stars or a language because the fellowship table does not publish them. Applicant screening tables on the same pages are ignored - a screening task is not a fellowship project - and where a year repeats the same result list in two tables (2020 does) each fellow and project is kept once.`,
    rows,
  });
  if (write) writeJson(OUT, out);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [from, to] = process.argv.slice(2).map(Number);
  buildFosseeShard({ from: from || 2018, to: to || 2026 })
    .then((s) => console.log(`fossee: ${s.projects} rows, unit "${s.unit}" -> ${OUT}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
