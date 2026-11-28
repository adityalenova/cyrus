#!/usr/bin/env node
/* ══ scripts/promote-snapshot.mjs — promote a whole catalog snapshot, or none ══
   node scripts/promote-snapshot.mjs                      validate + promote
   node scripts/promote-snapshot.mjs --dry-run            stage + validate, print the plan
   node scripts/promote-snapshot.mjs --source public/data --target public/data
   node scripts/promote-snapshot.mjs --staging .snapshot-staging/my-run

   The builders write their datasets in place, so this CLI promotes by taking a
   copy: it copies every required dataset out of the source directory into a
   versioned staging directory (.snapshot-staging/<timestamp> by default),
   validates the complete set, writes the shared metadata file there, and only
   then moves the set into the target directory. A later builder cannot see a
   half-promoted snapshot, and a failed run leaves the served files byte for
   byte as they were.

   On any failure the failing dataset and the staging directory are printed and
   the process exits 1. The staging directory is kept so the rejected set can
   be inspected; a successful promotion removes it.

   How scripts/refresh.mjs should call this once #87 owns that file:

     spawnSync(process.execPath, ["scripts/promote-snapshot.mjs"], { stdio: "inherit" });
     if (status !== 0) do not stamp the README;

   and the same call belongs at the end of `npm run refresh:all`, after the
   builders it promotes have run. Nothing in this file imports refresh.mjs and
   nothing in refresh.mjs imports this file, so either can land first.
   ═══════════════════════════════════════════════════════════════════════ */
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planPromotion, promote, requiredDatasets, validateDataset } from "./lib/snapshot.mjs";

const ROOT = dirname(fileURLToPath(new URL("..", import.meta.url)));

function args() {
  const out = { source: null, target: null, staging: null, dryRun: false, help: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--target") out.target = argv[++i];
    else if (a === "--staging") out.staging = argv[++i];
    else if (a.startsWith("--source=")) out.source = a.slice("--source=".length);
    else if (a.startsWith("--target=")) out.target = a.slice("--target=".length);
    else if (a.startsWith("--staging=")) out.staging = a.slice("--staging=".length);
    else return { error: `unknown argument ${a}` };
  }
  return out;
}

const USAGE = `usage: node scripts/promote-snapshot.mjs [--dry-run] [--source <dir>] [--target <dir>] [--staging <dir>]

  --dry-run         copy and validate the set, print the promotion plan, change nothing
  --source <dir>    where the refreshed datasets are (default public/data)
  --target <dir>    where the served snapshot lives (default public/data)
  --staging <dir>   versioned staging directory (default .snapshot-staging/<timestamp>)`;

function stamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "-");
}

async function main() {
  const parsed = args();
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  if (parsed.error) {
    console.error(parsed.error);
    console.error(USAGE);
    return 2;
  }

  const sourceDir = resolve(ROOT, parsed.source ?? "public/data");
  const targetDir = resolve(ROOT, parsed.target ?? "public/data");
  const stagingDir = resolve(ROOT, parsed.staging ?? join(".snapshot-staging", stamp()));
  const datasets = requiredDatasets();

  console.log(`promote-snapshot: ${datasets.length} datasets from ${sourceDir}`);
  console.log(`  staging -> ${stagingDir}`);

  /* 1. build the versioned staging copy */
  try {
    await mkdir(stagingDir, { recursive: true });
    for (const spec of datasets) {
      await cp(join(sourceDir, spec.name), join(stagingDir, spec.name));
    }
  } catch (err) {
    const failing = err.path ?? "the staging copy";
    console.error(`snapshot promotion failed: could not stage ${failing} (${err.code ?? err.message})`);
    console.error(`  source:  ${sourceDir}`);
    console.error(`  staging: ${stagingDir}  (kept for inspection)`);
    return 1;
  }

  /* 2. validate the whole set; promote() validates again before it writes
        anything, so this pass is what tells a reader the row counts */
  const rows = {};
  try {
    for (const spec of datasets) {
      const checked = validateDataset(spec.name, await readFile(join(stagingDir, spec.name)));
      rows[spec.name] = checked.rows;
      console.log(`  ok ${spec.name.padEnd(24)} ${String(checked.rows).padStart(7)} rows  <- ${spec.source}`);
    }
  } catch (err) {
    console.error(`snapshot promotion failed: ${err.message}`);
    console.error(`  source:  ${sourceDir}`);
    console.error(`  staging: ${stagingDir}  (kept for inspection)`);
    return 1;
  }

  if (parsed.dryRun) {
    const plan = planPromotion({
      stagingDir,
      targetDir,
      present: datasets.map((d) => d.name),
      withMeta: true,
    });
    console.log(`dry run: the set would replace ${targetDir} in ${plan.steps.length} moves`);
    for (const step of plan.steps) console.log(`  ${step.op.padEnd(8)} ${step.name}`);
    console.log(`staging: ${stagingDir}`);
    return 0;
  }

  /* 3. one metadata file, then the move, or nothing */
  try {
    const result = await promote({ stagingDir, targetDir });
    const total = Object.values(rows).reduce((s, n) => s + n, 0);
    console.log(`promoted ${result.files.length} datasets (${total} rows) into ${targetDir}`);
    console.log(`  metadata -> ${result.metadataPath}`);
    console.log(`  promotedAt ${result.promotedAt}`);
  } catch (err) {
    console.error(`snapshot promotion failed: ${err.message}`);
    console.error(`  source:  ${sourceDir}`);
    console.error(`  staging: ${err.stagingDir ?? stagingDir}  (kept for inspection)`);
    console.error(`  target:  ${targetDir}  (unchanged)`);
    return 1;
  }

  /* 4. only the empty shell is left once the files moved out */
  try {
    await rm(stagingDir, { recursive: true, force: true });
  } catch {
    /* an empty staging directory is not a failure */
  }
  return 0;
}

process.exitCode = await main();
