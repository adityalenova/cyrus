/* scripts/readme-stats.mjs - keep the figures in README.md and the hero banner true.

     npx tsx scripts/readme-stats.mjs            rewrite them from the data
     npx tsx scripts/readme-stats.mjs --check    change nothing, exit 1 if any is stale

   The figures come from src/lib/siteStats.ts (issues, archive, repos, orgs,
   programs), a count of the page.tsx and route.ts files under src/app, and the
   file and test totals from one `vitest run`. Run through tsx because siteStats
   is TypeScript. `npm run refresh` calls the rewrite; CI calls the check.

   Where each figure sits is described in scripts/lib/readme-figures.mjs. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteFixed, rewriteMarkers, rewriteTiles, routeCounts } from "./lib/readme-figures.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");

/* A failing test does not stop the count: the report is written either way, and
   the tests are what `npm test` is for. */
function suiteTotals() {
  const dir = mkdtempSync(join(tmpdir(), "cyrus-vitest-"));
  const out = join(dir, "report.json");
  try {
    const bin = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
    spawnSync(process.execPath, [bin, "run", "--reporter=json", `--outputFile=${out}`], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "inherit"],
    });
    if (!existsSync(out)) throw new Error("vitest wrote no report; run `npm test` to see why");
    const report = JSON.parse(readFileSync(out, "utf8"));
    return { testFiles: report.testResults.length, tests: report.numTotalTests };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const { STATS, fmtFull } = await import("../src/lib/siteStats.ts");
  const routes = routeCounts(join(ROOT, "src/app"));
  const totals = suiteTotals();
  const figures = {
    issues: fmtFull(STATS.issues),
    archive: fmtFull(STATS.archive),
    repos: fmtFull(STATS.repos),
    orgs: fmtFull(STATS.orgs),
    programs: String(STATS.programs),
    archivePrograms: String(STATS.archivePrograms),
    pages: String(routes.pages),
    handlers: String(routes.handlers),
    api: String(routes.api),
    testFiles: String(totals.testFiles),
    tests: String(totals.tests),
  };

  const TARGETS = [
    ["README.md", [rewriteMarkers, rewriteFixed]],
    ["docs/readme/hero.svg", [rewriteTiles]],
  ];

  const stale = [];
  for (const [file, rewrites] of TARGETS) {
    const path = join(ROOT, file);
    const before = readFileSync(path, "utf8");
    let text = before;
    for (const rewrite of rewrites) {
      const result = rewrite(text, figures);
      text = result.text;
      for (const change of result.changes) stale.push({ file, ...change });
    }
    if (!check && text !== before) writeFileSync(path, text);
  }

  const lines = stale.map(({ file, key, from, to }) => `  ${file}: ${key} ${from} -> ${to}`);
  if (check && stale.length) {
    console.error(`The figures quoted in the README and hero banner are out of date:\n${lines.join("\n")}\nRun \`npm run readme:stats\` and commit the result.`);
    process.exit(1);
  }
  console.log(stale.length ? `Updated ${stale.length} figure${stale.length === 1 ? "" : "s"}:\n${lines.join("\n")}` : "README and hero banner figures match the data.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
