/* ══ contribo-summary.mjs — one number per program, computed the same way
   the organization explorer computes its rows.

   /programs/<id>/organizations merges Contribo's organization list with our
   own archive rows and shows "N organizations". The directory page needs the
   same N without fetching every program's shard in the browser (24 Pull
   Requests alone is 790 KB), so this script runs the identical merge over the
   files on disk and writes the result into /data/contribo-orgs.json as
   `stats`. Run it after either data set changes:

     npx tsx scripts/contribo-summary.mjs                                         */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mergeProgramOrgs } from "../src/lib/contriboOrgs.ts";
import { techRank } from "../src/lib/orgTaxonomy.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const data = (p) => `${root}/public/data/${p}`;

const index = JSON.parse(readFileSync(data("contribo-orgs.json"), "utf8"));
const roster = JSON.parse(readFileSync(data("program-roster.json"), "utf8"));

const PROGRAM_IDS = [
  "gsoc", "outreachy", "lfx", "esoc", "mlh", "gssoc", "kde", "sob",
  "nsoc", "oct", "24pr", "fossee", "vercel-oss",
];

const stats = {};
for (const id of PROGRAM_IDS) {
  const shardPath = `contribo-orgs/${id}.json`;
  const shard = existsSync(data(shardPath))
    ? JSON.parse(readFileSync(data(shardPath), "utf8"))
    : null;
  const meta = roster.programs?.[id];
  const archive = meta && existsSync(data(meta.file))
    ? (JSON.parse(readFileSync(data(meta.file), "utf8")).orgs ?? [])
    : [];
  if (!shard && !archive.length) continue;

  const rows = mergeProgramOrgs(shard?.orgs ?? [], archive, shard?.rowKind ?? "org");
  stats[id] = {
    orgs: rows.length,
    projects: rows.reduce((s, r) => s + r.projects, 0),
    years: [...new Set(rows.flatMap((r) => r.years))].sort((a, b) => b - a).length,
    techs: techRank(rows).length,
    sectors: new Set(rows.map((r) => r.sector)).size,
    logos: rows.filter((r) => r.branded).length,
    profiles: rows.filter((r) => r.inSite).length,
    from: shard && archive.length ? "contribo + archive" : shard ? "contribo" : "archive",
  };
  console.log(id.padEnd(12), JSON.stringify(stats[id]));
}

index.stats = stats;
index.statsGenerated = roster.generated;
writeFileSync(data("contribo-orgs.json"), JSON.stringify(index, null, 1));
console.log(`\nwrote stats for ${Object.keys(stats).length} programs`);
