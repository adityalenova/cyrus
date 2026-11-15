/* ══ scripts/lib/shard.mjs — the shared vocabulary of the program archive ══
   Everything scripts/build-program-projects.mjs and the fetch-*.mjs scripts
   need in order to write a shard in ONE shape:

     { program, label, source, readAt, unit, note, projects, orgs, list }

   with rows in the same field names public/data/otherProjects.json already
   uses (y,u,t,o,s,tt,tp,b,m,url,program) plus the three GitHub-enrichment
   fields (stars, lang, license) only when a GitHub API response supplied
   them. Nothing in here invents a value: an unknown field is empty, null or
   absent, never a guess.

   `unit` is the program's OWN word for one row of its record, because the
   programs are not comparable - GSSoC's board counts projects a student
   claimed, Season of KDE counts proposed ideas, 24 Pull Requests counts
   wishlist repositories, MLH leaves forks. src/lib/programRoster.ts already
   keeps that vocabulary (ROSTER_UNIT); UNIT here is the same table extended
   to the four programs whose evidence arrived after that file was written.
   If the two ever disagree, programRoster.ts is the site and wins.        ═ */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runExec = promisify(execFile);

export const ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..");
export const DATA = join(ROOT, "public/data");
export const OUT_DIR = join(DATA, "program-projects");
export const INDEX = join(DATA, "program-projects.json");
export const CACHE_DIR = join(ROOT, "scripts/.cache");

/** the day this run read its sources; override with CYRUS_READ_AT for a re-run */
export const READ_AT = process.env.CYRUS_READ_AT || new Date().toISOString().slice(0, 10);
/** offline mode: never touch the network, reuse what is already on disk */
export const OFFLINE = process.argv.includes("--offline");

export const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export const readJson = (p, fallback = null) =>
  (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);

export function writeJson(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 1));
  renameSync(tmp, file);
  return obj;
}

/* ── one row of one program's record ────────────────────────────────────
   Keys are deliberately the short names otherProjects.json uses, so a page
   can read /data/gsoc-projects.json, /data/otherProjects.json and a shard
   with the same column map. Absent === unknown, so we drop empty optional
   fields instead of writing null noise 5,000 times.                    ═ */
export function makeRow(r) {
  const row = {
    y: Number.isFinite(r.y) ? r.y : undefined,
    u: clean(r.u),
    t: clean(r.t),
    o: clean(r.o),
    s: clean(r.s),
    tt: (r.tt ?? []).filter(Boolean).map(clean).filter(Boolean),
    tp: (r.tp ?? []).filter(Boolean).map(clean).filter(Boolean),
    b: clean(r.b),
    m: clean(r.m),
    url: clean(r.url),
    program: clean(r.program),
  };
  if (row.y === undefined) delete row.y;
  if (typeof r.stars === "number") row.stars = r.stars;
  if (clean(r.lang)) row.lang = clean(r.lang);
  if (clean(r.license)) row.license = clean(r.license);
  /* a row with no title is not a row; a github url that is not a repo is not a link */
  if (!row.t) return null;
  if (row.url && !/^(https?:\/\/|\/)/.test(row.url)) row.url = "";
  return row;
}

/** organization rollup keyed by the same value the rows carry in `o` */
export function orgMap(rows, meta = () => ({})) {
  const out = {};
  for (const r of rows) {
    if (!r.o) continue;
    out[r.o] = out[r.o] || { url: "", category: "", n: 0 };
    out[r.o].n += 1;
    const m = meta(r.o) || {};
    if (!out[r.o].url && m.url) out[r.o].url = m.url;
    if (!out[r.o].category && m.category) out[r.o].category = m.category;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])));
}

export const yearsOf = (rows) =>
  [...new Set(rows.map((r) => r.y).filter((y) => typeof y === "number"))].sort((a, b) => b - a);

/** newest first, then biggest repo first; deterministic so re-runs diff clean */
export function sortRows(rows) {
  return rows.sort((a, b) => (b.y ?? 0) - (a.y ?? 0) || (b.stars ?? 0) - (a.stars ?? 0)
    || a.t.localeCompare(b.t));
}

export function shard({ id, label, source, unit, note, rows, evidence = "api", url = "", orgMeta = () => ({}) }) {
  const list = sortRows(rows.filter(Boolean));
  /* a program that publishes its own project id keeps it; the rest are numbered
     after the deterministic sort so the same file comes out every run */
  list.forEach((r, i) => { if (!r.u) r.u = `${id}-${i + 1}`; });
  return {
    program: id, label, source, readAt: READ_AT, unit, evidence, url, note,
    projects: list.length,
    orgs: orgMap(list, orgMeta),
    list,
  };
}

/* ── GitHub access: one gh api call, cached to disk so a re-run is free ──
   GH_CACHE_VERSION is bumped whenever the fields we store change, so an old
   cache never quietly supplies a row with a missing license.            ═ */
const GH_CACHE_VERSION = 2;
const ghCacheFile = join(CACHE_DIR, "program-projects-cache.json");
const ghCacheRaw = readJson(ghCacheFile, { repos: {} });
const ghCache = ghCacheRaw.version === GH_CACHE_VERSION ? ghCacheRaw : { version: GH_CACHE_VERSION, repos: {} };
if (!ghCache.repos) ghCache.repos = {};
let dirty = ghCache !== ghCacheRaw;

export function saveGhCache() {
  if (!dirty) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = `${ghCacheFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(ghCache));
  renameSync(tmp, ghCacheFile);
  dirty = false;
}

export async function ghApi(path, extra = []) {
  const { stdout } = await runExec("gh", ["api", path, ...extra], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/** full repository record, or null when the API says it does not exist (404) */
export async function ghRepo(ownerRepo) {
  const key = String(ownerRepo).toLowerCase();
  if (ghCache.repos[key]) return ghCache.repos[key];
  if (OFFLINE) return null;
  let meta;
  try {
    const r = await ghApi(`repos/${ownerRepo}`);
    meta = {
      ok: true, name: r.name || ownerRepo.split("/")[1],
      ownerLogin: r.owner?.login || ownerRepo.split("/")[0],
      lang: r.language || null, stars: r.stargazers_count ?? null,
      license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION"
        ? r.license.spdx_id : (r.license?.name || null),
      desc: clean(r.description) || null, topics: (r.topics || []).slice(0, 8),
      archived: !!r.archived,
    };
  } catch { meta = { ok: false }; }
  ghCache.repos[key] = meta;
  dirty = true;
  return meta;
}

export async function ghSearch(query, pages = 1, perPage = 100) {
  if (OFFLINE) return [];
  const items = [];
  for (let page = 1; page <= pages; page++) {
    let j = null;
    for (let t = 0; t < 3 && !j; t++) {
      try { j = await ghApi(`search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`); }
      catch { await new Promise((r) => setTimeout(r, 4000 * (t + 1))); }
    }
    if (!j || !Array.isArray(j.items) || !j.items.length) break;
    items.push(...j.items);
    if (j.items.length < perPage) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return items;
}

/** run `fn` over `items` with at most n in flight, keeping input order */
export async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

/** fetch with a UA (several program sites 403 a bare node fetch) */
export async function getPage(url, { tries = 3, headers = {}, accept = "text/html" } = {}) {
  if (OFFLINE) return null;
  const ua = headers["user-agent"] ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, {
        headers: { accept, "user-agent": ua, ...headers },
        redirect: "follow", signal: AbortSignal.timeout(30000),
      });
      if (r.ok) return await r.text();
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* transient */ }
    await new Promise((res) => setTimeout(res, 1200 * (t + 1)));
  }
  return null;
}
