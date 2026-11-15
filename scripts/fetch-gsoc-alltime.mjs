/* ══ scripts/fetch-gsoc-alltime.mjs - the whole GSoC organization record ═
   node scripts/fetch-gsoc-alltime.mjs

   Google's own headline for Summer of Code is "1000+ open source organizations"
   and "21 years". Our archive only covered 2022-2026, because that is all the
   new site's API serves. This pulls gsocorganizations.dev's organizations.json,
   a community mirror of Google's published per-year org pages, which carries
   every organization that took part from 2016 to 2026 with its accepted
   projects, and rewrites the GSoC section of public/data/program-roster.json
   from it.

   What the file gives us, per organization: name, its own website, category,
   topics, technologies, and for each year the project list with titles, student
   names and URLs. What it does not give us: mentors. Google publishes no mentor
   roster for any year, so the site keeps saying so.

   Numbers come from the source verbatim. The only thing computed here is the
   count of projects per organization per year, which is a length of the list
   the file itself carries.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "https://api.gsocorganizations.dev/organizations.json";
const RAW = join(ROOT, "data/gsoc-alltime-raw.json");
const ROSTER = join(ROOT, "public/data/program-roster.json");

const YEARS = Object.keys(JSON.parse('{"2016":1}')).length ? [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] : [];

console.log(`fetching ${SRC}`);
const buf = execFileSync("curl", ["-s", "--compressed", "--fail", "--max-time", "180", SRC], { maxBuffer: 200 * 1024 * 1024 });
const all = JSON.parse(buf.toString("utf8"));
writeFileSync(RAW, JSON.stringify(all));
console.log(`${all.length} organizations, ${(buf.length / 1048576).toFixed(1)} MB kept at ${RAW.replace(ROOT + "/", "")}`);

/* ── one row per organization, per year it ran ── */
const rows = [];
let projects = 0;
for (const o of all) {
  const years = Object.entries(o.years ?? {})
    .map(([y, d]) => [Number(y), d])
    .filter(([y, d]) => YEARS.includes(y) && Array.isArray(d?.projects))
    .sort((a, b) => a[0] - b[0]);
  if (!years.length) continue;
  const n = years.reduce((s, [, d]) => s + d.projects.length, 0);
  projects += n;
  rows.push({
    name: o.name,
    n,
    years: years.map(([y]) => y),
    url: o.url ?? "",
    category: o.category ?? "",
    per_year: Object.fromEntries(years.map(([y, d]) => [y, d.projects.length])),
  });
}
rows.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

/* ── rewrite only the gsoc section of the roster ── */
const roster = JSON.parse(readFileSync(ROSTER, "utf8"));
const before = roster.programs.gsoc?.orgs?.length ?? 0;
roster.programs.gsoc = {
  projects,
  years: YEARS,
  window: `${YEARS[0]}-${YEARS[YEARS.length - 1]}`,
  source: "gsocorganizations.dev, a community mirror of Google's published per-year organization pages",
  fetched: new Date().toISOString().slice(0, 10),
  orgs: rows,
};
roster.generated = new Date().toISOString().slice(0, 10);
if (existsSync(ROSTER)) writeFileSync(ROSTER + ".bak", readFileSync(ROSTER, "utf8"));
writeFileSync(ROSTER, JSON.stringify(roster));

console.log(`gsoc section: ${before} orgs / ${roster.programs.gsoc.projects} projects -> ${rows.length} orgs / ${projects} projects`);
console.log(`other programs untouched: ${Object.keys(roster.programs).filter((k) => k !== "gsoc").join(", ")}`);
