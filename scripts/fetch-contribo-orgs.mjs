#!/usr/bin/env node
/* ══ fetch-contribo-orgs.mjs - pull Contribo's organization records ═══════
   https://contribo-one.vercel.app publishes an open JSON API behind its
   program pages:

     GET /api/organizations?program=<slug>&limit=200&page=<n>
       -> { organizations, total, page, limit, totalPages }

   It is worth taking because it carries three things our own archives do not:
   a logo URL per organization, a written description, and the technology list
   the program itself attaches to each participant. That is what makes the
   card grid on /programs/:id/organizations possible.

   One trap, and it is the reason this file is longer than the fetch:
   for LFX Mentorship (and Summer of Bitcoin, if it ever populates) Contribo's
   rows are not organizations at all. Each row is one mentored project, named
   after the project, with the foundation that ran it in `category`. Taking
   those rows at face value would put "Hyperledger - Implement a CLI for node
   interactions" on the screen as if it were a company. So those programs are
   grouped by category first, and the project rows are kept separately as the
   project listing they actually are.

   Rows are stored under our own program ids, and the source is recorded on
   every file so a reader can always tell where a number came from.
   ═══════════════════════════════════════════════════════════════════════ */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ORIGIN = "https://contribo-one.vercel.app";
const DIR = resolve(process.cwd(), "public/data/contribo-orgs");
const INDEX = resolve(process.cwd(), "public/data/contribo-orgs.json");

/* their slug -> our program id. `org` rows are organizations; `project` rows
   are one-per-project and must be grouped before they can be shown as orgs. */
const PROGRAMS = [
  { contribo: "gsoc", id: "gsoc", rows: "org" },
  { contribo: "lfx", id: "lfx", rows: "project" },
  { contribo: "outreachy", id: "outreachy", rows: "org" },
  { contribo: "esoc", id: "esoc", rows: "org" },
  { contribo: "mlh-fellowship", id: "mlh", rows: "org" },
  { contribo: "gssoc", id: "gssoc", rows: "org" },
  { contribo: "hacktoberfest", id: "oct", rows: "org" },
  { contribo: "nsoc", id: "nsoc", rows: "org" },
  { contribo: "summer-of-bitcoin", id: "sob", rows: "project" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${ORIGIN}${path}`, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1200 * (i + 1));
    }
  }
}

/* Pull every page of one program. The API caps a page at 200 rows. */
async function fetchAll(slug) {
  const rows = [];
  let page = 1, pages = 1;
  while (page <= pages) {
    const body = await getJson(`/api/organizations?program=${slug}&limit=200&page=${page}`);
    const items = body.organizations ?? [];
    rows.push(...items);
    pages = body.totalPages ?? 1;
    if (!items.length) break;
    page++;
    await sleep(250);
  }
  return rows;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const mode = (xs) => {
  const c = new Map();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/* Rank technologies by how often they appear across the group, so the chips on
   a card say something true about the whole organization rather than about
   whichever project happened to sort first. */
function rankedTechs(items, limit = 6) {
  const c = new Map();
  for (const it of items)
    for (const t of it.technologies ?? []) {
      const k = clean(t).toLowerCase();
      if (k) c.set(k, (c.get(k) ?? 0) + 1);
    }
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([k]) => k);
}

function shapeOrg(o) {
  return {
    name: clean(o.name),
    slug: clean(o.slug),
    logo: clean(o.logoUrl) || null,
    desc: clean(o.description) || null,
    site: clean(o.websiteUrl) || null,
    sector: clean(o.category) || null,
    techs: uniq((o.technologies ?? []).map((t) => clean(t).toLowerCase())).slice(0, 8),
    topics: uniq((o.topics ?? []).map(clean)).slice(0, 6),
    years: uniq(o.years ?? []).sort((a, b) => b - a),
    projects: Number(o.projectCount ?? 0) || 0,
  };
}

/* LFX / SoB: one row per mentored project -> one row per organizing foundation */
function groupByCategory(items) {
  const by = new Map();
  for (const it of items) {
    const key = clean(it.category) || clean(it.name);
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(it);
  }
  return [...by.entries()]
    .map(([category, group]) => ({
      name: category,
      slug: null,
      logo: mode(group.map((g) => clean(g.logoUrl))) || null,
      desc: null,
      site: mode(group.map((g) => clean(g.websiteUrl))) || null,
      sector: null,
      techs: rankedTechs(group),
      topics: [],
      years: uniq(group.flatMap((g) => g.years ?? [])).sort((a, b) => b - a),
      projects: group.length,
    }))
    .sort((a, b) => b.projects - a.projects);
}

const index = {
  generated: new Date().toISOString().slice(0, 10),
  source: `${ORIGIN}/api/organizations`,
  note: "Organization records published by Contribo for each program: logo, description, sector, technologies and the years that organization took part. Programs whose rows are per-project (LFX Mentorship, Summer of Bitcoin) are grouped by the foundation that ran them, so nothing on an organization card is a project title. Rows live one file per program under /data/contribo-orgs/.",
  programs: {},
};

mkdirSync(DIR, { recursive: true });

for (const p of PROGRAMS) {
  process.stdout.write(`  ${p.contribo.padEnd(20)}`);
  let items;
  try {
    items = await fetchAll(p.contribo);
  } catch (e) {
    console.log(`FAILED (${e.message}) - keeping whatever is already on disk`);
    continue;
  }
  const orgs = p.rows === "org" ? items.map(shapeOrg) : groupByCategory(items);
  orgs.sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));
  const projects = p.rows === "project" ? items.map(shapeOrg) : [];
  writeFileSync(
    resolve(DIR, `${p.id}.json`),
    JSON.stringify({ program: p.id, contriboSlug: p.contribo, rowKind: p.rows, orgs, ...(projects.length ? { projects } : {}) }),
  );
  index.programs[p.id] = {
    contriboSlug: p.contribo,
    rowKind: p.rows,
    orgs: orgs.length,
    projects: projects.length,
    logos: orgs.filter((o) => o.logo).length,
    techs: orgs.reduce((n, o) => n + o.techs.length, 0),
  };
  console.log(`orgs=${String(orgs.length).padEnd(6)} rows=${String(items.length).padEnd(6)} logos=${index.programs[p.id].logos}`);
}

writeFileSync(INDEX, JSON.stringify(index));
const bytes = Object.values(index.programs).reduce((n, v) => n + (v.orgs + v.projects), 0);
console.log(`\nWrote ${Object.keys(index.programs).length} shards to ${DIR} (${bytes} rows total)`);
