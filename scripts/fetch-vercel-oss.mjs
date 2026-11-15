/* ══ scripts/fetch-vercel-oss.mjs — the Vercel Open Source Program cohorts ══
   node scripts/fetch-vercel-oss.mjs
   (also importable: buildVercelShard() is called by build-program-projects.mjs)

   What we read, on the date in the output file's readAt field:

     https://vercel.com/open-source-program

   The page renders two kinds of project list in its server HTML:
   - the current cohort as a card grid ("Our <Cohort> Cohort", each card an
     <a href="https://github.com/owner/repo"><span class="font-medium">Name</span>);
   - every past cohort as a collapsed section whose data-slot="collapse-title"
     names the cohort and whose body is a <ul> of
     <a href="https://github.com/owner/repo">Name</a> links.

   Both are Vercel's own words for the same thing - a funded project in a
   named cohort - so the unit is "cohort projects".

   Then every repository link is re-read through the GitHub API
   (`gh api repos/owner/repo`) for stars, language, license, description and
   topics, and a card whose repository no longer resolves (404, renamed,
   private) is DROPPED rather than shipped as a dead link. The number in
   `projects` is therefore the verified count, which is allowed to be smaller
   than the number of cards on the page; both are stated in the note.

   Vercel publishes no mentor and no per-project year beyond the cohort name,
   so `m` stays empty and `y` is the cohort's year.

   Output: public/data/program-projects/vercel-oss.json (contract shape).  ═ */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OUT_DIR, READ_AT, OFFLINE, clean, readJson, writeJson, makeRow, shard,
  ghRepo, mapLimit, getPage, saveGhCache, ROOT,
} from "./lib/shard.mjs";

const URL_PAGE = "https://vercel.com/open-source-program";
const OUT = join(OUT_DIR, "vercel-oss.json");
const CARDS = join(ROOT, "scripts/.cache/vercel-oss-cards.json");
const COHORT = /^(Winter|Spring|Summer|Fall) \d{4}$/;

/** every project card on the page: { cohort, repo, title } */
export function parseCohorts(html) {
  const found = [];

  /* 1. the current cohort, drawn as the card grid above "See past cohorts" */
  for (const m of html.matchAll(
    /<a href="(https:\/\/github\.com\/[^"]+)"[^>]*><span class="font-medium">([^<]{1,140})<\/span>/g
  )) {
    const before = html.slice(0, m.index);
    /* the heading is split by React comment nodes: "Our <!-- -->Spring 2026<!-- --> Cohort." */
    const named = [...before.matchAll(/Our\s*(?:<!--\s*-->\s*)?((?:Winter|Spring|Summer|Fall) \d{4})\s*(?:<!--\s*-->\s*)?Cohort/g)];
    found.push({ cohort: named.length ? named[named.length - 1][1] : "Current cohort", repo: m[1], title: clean(m[2]) });
  }

  /* 2. each collapsed past cohort, keyed by its own heading */
  const heads = [...html.matchAll(/data-slot="collapse-title">((?:Winter|Spring|Summer|Fall) \d{4})</g)];
  heads.forEach((h, i) => {
    const start = h.index;
    const end = i + 1 < heads.length ? heads[i + 1].index : html.length;
    const seg = html.slice(start, end);
    for (const m of seg.matchAll(/<a href="(https:\/\/github\.com\/[^"]+)"[^>]*>([^<]{1,140})<\/a>/g)) {
      found.push({ cohort: h[1], repo: m[1], title: clean(m[2]) });
    }
  });

  /* de-dupe on repository, keeping the first cohort that names it */
  const seen = new Map();
  for (const f of found) {
    const key = f.repo.toLowerCase().replace(/\/+$/, "");
    if (!/^(winter|spring|summer|fall) \d{4}$/.test(f.cohort) && !COHORT.test(f.cohort)) continue;
    if (!seen.has(key)) seen.set(key, { ...f, repo: key.replace(/^https:\/\/github\.com\//, "") });
  }
  return [...seen.values()];
}

export async function buildVercelShard({ write = true } = {}) {
  if (OFFLINE && existsSync(OUT)) return readJson(OUT);

  let cards = null;
  const html = await getPage(URL_PAGE);
  if (html) cards = parseCohorts(html);
  if (!cards || !cards.length) {
    /* offline or a page redesign: reuse the card list we read last time */
    const cached = readJson(CARDS, null);
    cards = cached?.cards ?? null;
  }
  if (!cards || !cards.length) throw new Error("vercel.com/open-source-program returned no project cards");
  writeJson(CARDS, { readAt: READ_AT, source: URL_PAGE, cards });

  const verified = await mapLimit(cards, 5, async (c) => {
    const meta = await ghRepo(c.repo);
    await new Promise((r) => setTimeout(r, 60));
    return { ...c, meta };
  });

  const kept = verified.filter((c) => c.meta?.ok);
  const dropped = verified.length - kept.length;
  const perCohort = {};
  for (const c of kept) perCohort[c.cohort] = (perCohort[c.cohort] || 0) + 1;

  const rows = kept.map((c) => {
    const m = c.meta;
    const y = Number(/(\d{4})$/.exec(c.cohort)?.[1]) || undefined;
    return makeRow({
      t: c.title, o: m.ownerLogin || c.repo.split("/")[0],
      s: c.cohort, y,
      b: m.desc || "", tt: m.lang ? [m.lang] : [], tp: m.topics || [],
      url: `https://github.com/${m.ownerLogin || c.repo.split("/")[0]}/${m.name || c.repo.split("/")[1]}`,
      stars: m.stars, lang: m.lang, license: m.license, m: "",
      program: "Vercel Open Source Program",
    });
  });

  const out = shard({
    id: "vercel-oss", label: "Vercel Open Source Program", evidence: "scrape",
    url: URL_PAGE, unit: "cohort projects",
    source: `${URL_PAGE} (the current-cohort card grid plus every collapsed past cohort list), each repository then re-read via the GitHub API`,
    note: `One row per funded project Vercel names on its open-source program page, tagged with the cohort the page files it under (${Object.entries(perCohort).map(([k, v]) => `${k} ${v}`).join(", ")}). Every card was then read back through \`gh api repos/owner/repo\`: ${dropped === 1 ? "1 card link" : `${dropped} card links`} no longer resolve on GitHub and were dropped rather than shipped, so \`projects\` is the verified count, not the number of cards on the page. Stars, language, license, description and topics are that API response, not our estimate; Vercel publishes no mentor or maintainer per project, so \`m\` is empty. This is not a mentored-program archive - it is the list of projects Vercel funds, in the program's own cohort words.`,
    rows,
  });
  if (write) { writeJson(OUT, out); saveGhCache(); }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildVercelShard().then((s) => console.log(`vercel-oss: ${s.projects} verified projects, unit "${s.unit}" -> ${OUT}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
