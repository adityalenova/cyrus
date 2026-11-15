/* ══ normalize-program-projects.mjs — one shard shape, one truth ═══════
   The per-program archive was written in two passes. The first ten shards use
   {projects: [rows]}; the two written last (FOSSEE, Vercel OSS) still use the
   old {projects: <count>, list: [shorthand rows]} shape, and the FOSSEE one
   carries a better record than the index describes - 414 rows read out of the
   fellowship result tables FOSSEE publishes for 2020-2026, not 289 repos.

   This script is the single place that decides the canonical shape:
     - every shard ends up as {projects: [rows]} with full field names;
     - every index entry is re-derived from the file behind it (years, distinct
       orgs, rows carrying a URL), so the index can never describe rows that
       are not there;
     - `projects` stays the FULL fetched count and `rows` the number the shard
       actually carries, so a capped shard can say "showing 400 of 5,238".

   Run it after scripts/build-program-projects.mjs, or on its own to fold in a
   hand-written shard.                                        ═ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = `${ROOT}public/data/program-projects/`;
const INDEX_FILE = `${DIR}index.json`;

/** legacy shorthand row -> the row shape every shard uses now */
function upgrade(p) {
  return {
    title: p.title ?? p.t ?? "",
    org: p.org ?? p.o ?? "",
    orgLogin: p.orgLogin ?? (p.o && /^[\w.-]+$/.test(p.o) ? p.o : null),
    url: p.url ?? null,
    year: p.year ?? p.y ?? null,
    lang: p.lang ?? null,
    stars: typeof p.stars === "number" ? p.stars : null,
    desc: p.desc ?? p.b ?? "",
    season: p.season ?? p.s ?? null,
    techs: p.techs ?? [...(p.tt ?? []), ...(p.tp ?? [])],
    mentors: p.mentors ?? (p.m ? String(p.m).split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []),
  };
}

const index = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
const changed = [];

/* the two big exports are the full record for the programs reshaped from them,
   so their headline numbers come from there rather than from a capped shard */
const BIG = {
  gsoc: { file: "gsoc-projects.json" },
  lfx: { file: "otherProjects.json", is: (p) => p.program === "LFX" },
  outreachy: { file: "otherProjects.json", is: (p) => p.program === "Outreachy" },
  sob: { file: "otherProjects.json", is: (p) => p.program === "Summer of Bitcoin" },
};
function fullRecord(id) {
  const b = BIG[id];
  if (!b) return null;
  const cache = (fullRecord.cache ??= new Map());
  if (!cache.has(b.file)) {
    cache.set(b.file, JSON.parse(readFileSync(`${ROOT}public/data/${b.file}`, "utf8")).projects ?? []);
  }
  const all = cache.get(b.file);
  const rows = b.is ? all.filter(b.is) : all;
  return {
    projects: rows.length,
    years: [...new Set(rows.map((r) => r.y).filter((y) => y > 2000))].sort((a, z) => a - z),
    orgs: [...new Set(rows.map((r) => r.o).filter(Boolean))].length,
  };
}

for (const [id, entry] of Object.entries(index.programs)) {
  const file = `${DIR}${id}.json`;
  let shard;
  try { shard = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }

  const legacy = !Array.isArray(shard.projects) && Array.isArray(shard.list);
  const rows = (legacy ? shard.list : shard.projects).map(upgrade);

  const seenYears = [...new Set(rows.map((r) => r.year).filter((y) => typeof y === "number" && y > 2000))];
  const seenOrgs = [...new Set(rows.map((r) => r.org).filter(Boolean))].length;
  const withUrl = rows.filter((r) => !!r.url).length;
  /* a shard is capped at 400 rows, so the full record can only be re-derived
     from the file it was reshaped from; everything else takes the larger of
     the number the build read and the number the rows show */
  const full = fullRecord(id);
  const total = full?.projects ?? Math.max(Number(entry.projects) || 0, rows.length);
  const years = [...new Set([...(full?.years ?? entry.years ?? []), ...seenYears])].sort((a, b) => a - b);
  const orgs = Math.max(Number(entry.orgs) || 0, seenOrgs, full?.orgs ?? 0);

  const out = {
    program: id,
    label: shard.label ?? entry.label,
    source: legacy ? shard.source : (shard.source ?? entry.source),
    evidence: shard.evidence ?? entry.evidence,
    url: shard.url ?? entry.url,
    note: shard.note ?? entry.note,
    unit: shard.unit ?? null,
    generated: shard.generated ?? shard.readAt ?? index.generated,
    years,
    rows: rows.length,
    capped: rows.length < total,
    projects: rows,
  };
  writeFileSync(file, JSON.stringify(out, null, 1));

  index.programs[id] = {
    ...entry,
    label: out.label,
    source: out.source,
    evidence: out.evidence,
    url: out.url,
    projects: total,
    rows: rows.length,
    capped: out.capped,
    years,
    orgs,
    withUrl: Math.max(Number(entry.withUrl) || 0, withUrl),
    unit: out.unit,
    file: `program-projects/${id}.json`,
  };
  if (legacy) changed.push(`${id}: legacy list[${shard.list.length}] -> projects[${rows.length}], index ${entry.projects} -> ${total}`);
  else if (Number(entry.projects) !== total || entry.orgs !== orgs) changed.push(`${id}: index refreshed (${entry.projects} -> ${total}, orgs ${entry.orgs} -> ${orgs})`);
}

writeFileSync(INDEX_FILE, JSON.stringify(index, null, 1));

const total = Object.values(index.programs).reduce((s, e) => s + e.projects, 0);
const browsable = Object.values(index.programs)
  .reduce((s, e) => s + e.rows, 0);
console.log(`${Object.keys(index.programs).length} shards, ${total} rows in the full records, ${browsable} rows carried on disk`);
for (const c of changed) console.log(" -", c);
