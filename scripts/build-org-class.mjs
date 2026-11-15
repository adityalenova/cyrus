/* ══ build-org-class.mjs - write src/data/orgClass.ts ═══════════════════
   Run: npx tsx scripts/build-org-class.mjs

   The directory classifies every organization by field and by technology -
   sector instead of the old "beginner / intermediate / advanced", technology
   instead of the old focus tag. The rulebook is src/lib/orgTaxonomy.ts, the
   same one /programs/<id>/organizations runs, and the derivation is
   src/lib/orgClassify.ts.

   It is done here rather than in the browser because it reads the description
   of every tracked repository of 364 organizations, which costs about a tenth
   of a second nobody should pay on page load. Re-run it whenever the roster
   or the GitHub snapshot is refreshed (scripts/build-roster-orgs.mjs,
   scripts/resolve-org-logins.mjs). */
import { writeFileSync } from "node:fs";
import { deriveOrgClasses } from "../src/lib/orgClassify.ts";
import { ORGS } from "../src/data/orgs.ts";

const OUT = "src/data/orgClass.ts";

const rows = deriveOrgClasses();
const byLogin = new Map(rows.map((r) => [r.login, r]));
const missing = ORGS.filter((o) => !byLogin.get(o.login));
if (missing.length) {
  console.error(`refusing to write: ${missing.length} directory org(s) unclassified - ${missing.slice(0, 5).map((m) => m.login).join(", ")}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const sorted = [...rows].sort((a, b) => a.login.localeCompare(b.login));

const body = sorted
  .map((r) => `  ${JSON.stringify(r.login)}: { sector: ${JSON.stringify(r.sector)}, techs: [${r.techs.map((t) => JSON.stringify(t)).join(", ")}] },`)
  .join("\n");

writeFileSync(OUT, `/* ══ orgClass.ts - what field each directory organization is in, and what it builds with.
   Generated ${today} by: npx tsx scripts/build-org-class.mjs
   Derived, never hand-typed: the sector comes from the program's own category
   for that organization, then from its GitHub description and the descriptions
   of its tracked repositories; the technologies are the languages GitHub
   reports, folded through the same alias table the program explorer uses.
   Change the rulebook in src/lib/orgTaxonomy.ts and re-run the script. ═ */
import type { Sector } from "../lib/orgTaxonomy";

export type OrgClass = { sector: Sector; techs: string[] };

export const ORG_CLASS: Record<string, OrgClass> = {
${body}
};
`);

/* a short read-out so a refresh can be eyeballed for a nonsense bucket */
const tally = new Map();
for (const r of sorted) tally.set(r.sector, (tally.get(r.sector) ?? 0) + 1);
console.log(`wrote ${OUT} - ${sorted.length} organizations`);
[...tally.entries()].sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${String(n).padStart(4)} ${s}`));
const noTech = sorted.filter((r) => !r.techs.length).length;
console.log(`  ${noTech} orgs list no technology at all`);
