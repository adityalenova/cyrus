/* One-off: the Contribo shards for the per-project programs (LFX) also carried the
   raw project rows, which no page consumes. Strip them so a program page fetches
   only organization data; scripts/fetch-contribo-orgs.mjs can regenerate both. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DIR = "public/data/contribo-orgs";
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".json")) continue;
  const p = `${DIR}/${f}`;
  const j = JSON.parse(readFileSync(p, "utf8"));
  const n = Array.isArray(j.projects) ? j.projects.length : 0;
  if (!n) continue;
  j.projectRows = n;
  delete j.projects;
  writeFileSync(p, JSON.stringify(j));
  console.log(`${f}: dropped ${n} project rows -> ${Math.round(readFileSync(p).length / 1024)} KB`);
}
