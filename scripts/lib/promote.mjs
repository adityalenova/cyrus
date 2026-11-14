/* ══ scripts/lib/promote.mjs — build aside, check, then swap ════════════
   The refresh pipelines write several datasets that the site reads together:
   the program index and one shard per program. Until now each file was written
   where it is read, so a run that died halfway left the pages serving a
   mixture - the new index pointing at shards that are still yesterday's, or
   the other way round.

   This module splits the two moments a snapshot has:

     openStaging()        a versioned directory nothing reads from
     validateSnapshot()   every required file is there, parses, and satisfies
                          the caller's contract
     promoteSnapshot()    back up what is live, then rename each staged file
                          over it, then write the shared metadata last

   A validation failure therefore costs nothing: the live directory was never
   opened. A failure during the swap is rarer but real (disk full, a file held
   open on Windows), so everything already swapped is put back from the backup
   copy taken one step earlier, and the report names the file that failed.

   Nothing here knows what a program shard is. The contract - row counts,
   units, which sources are required - comes in as `check(rel, json)`, so the
   same promotion discipline covers the single-file refreshes too.
                                                     ═ */
import nodeFs from "node:fs";
import { dirname, join } from "node:path";

/* one seam for the filesystem so a test can break one rename and watch the
   swap roll back; the production path is the plain node:fs module */
const realIo = {
  mkdirSync: (p) => nodeFs.mkdirSync(p, { recursive: true }),
  existsSync: (p) => nodeFs.existsSync(p),
  readFileSync: (p) => nodeFs.readFileSync(p, "utf8"),
  writeFileSync: (p, text) => nodeFs.writeFileSync(p, text),
  copyFileSync: (a, b) => nodeFs.copyFileSync(a, b),
  renameSync: (a, b) => nodeFs.renameSync(a, b),
  readdirSync: (p) => nodeFs.readdirSync(p),
  statSync: (p) => nodeFs.statSync(p),
  rmSync: (p) => nodeFs.rmSync(p, { recursive: true, force: true }),
};

const asList = (x) => (x === null || x === undefined ? [] : Array.isArray(x) ? x : [x]);
const relPath = (rel) => String(rel).replace(/^\.?\/+/, "").replace(/[\\/]+/g, "/");

/**
 * What one promotion attempt did. `ok` is true only when every file in `promoted`
 * is now the staged one and the metadata says so; a false here means the live
 * snapshot is byte-for-byte what it was before the run.
 *
 * @typedef {Object} PromotionReport
 * @property {string} name                the snapshot's label
 * @property {string} stamp               the version this run carried
 * @property {string} dataDir             where the site reads
 * @property {string} workDir             where this run staged and archived
 * @property {string} staging             the run's output directory
 * @property {boolean} ok
 * @property {string[]} promoted          the live files now serving this snapshot
 * @property {string[]} checked           datasets that parsed and were contract-checked
 * @property {Array<{file: string, problem: string}>} problems
 * @property {string|null} failedFile     the swap that threw, if the swap failed
 * @property {boolean} rolledBack         whether swapped files were put back
 * @property {string[]} pruned            older snapshot copies this run deleted
 * @property {string|null} backupDir      where the replaced copies went
 * @property {string|null} manifestFile   the metadata's path, relative to dataDir
 * @property {object|null} manifest
 */

/**
 * A versioned directory for one run's outputs. Nothing the site reads lives
 * here, so a run may write, fail, and be re-run without touching the snapshot.
 *
 * `dataDir` is where the site reads; `workDir` is where this run stages, and
 * where copies of what it replaced are kept. They are separate because the
 * served directory ships into the build verbatim, so a run's scratch files do
 * not belong inside it. `workDir` defaults to `dataDir`, which suits a
 * directory nothing ships from.
 *
 * @param {{ dataDir: string, name: string, stamp: string, workDir?: string, io?: object }} opts
 */
export function openStaging({ dataDir, name, stamp, workDir = dataDir, io = realIo }) {
  if (!name) throw new Error("openStaging needs a snapshot name");
  if (!stamp) throw new Error("openStaging needs a version stamp for the directory");
  const dir = join(workDir, ".staging", `${name}-${stamp}`);
  io.mkdirSync(dir);
  return {
    name,
    stamp,
    dataDir,
    workDir,
    dir,
    /** absolute path of one dataset inside the staging directory */
    file: (rel) => join(dir, relPath(rel)),
    /** absolute path the same dataset has where the site reads it */
    live: (rel) => join(dataDir, relPath(rel)),
    /** the path to write to, with its parent directories made ready */
    stage: (rel) => {
      const p = join(dir, relPath(rel));
      io.mkdirSync(dirname(p));
      return p;
    },
    io,
  };
}

/**
 * @param {{ staging: object, files: string[], check?: (rel: string, json: any) => (string|string[]|null), io?: object }} opts
 * @returns {{ ok: boolean, problems: Array<{file: string, problem: string}>, checked: string[] }}
 */
export function validateSnapshot({ staging, files, check, io = staging.io ?? realIo }) {
  const problems = [];
  const checked = [];
  for (const rel of files.map(relPath)) {
    const src = staging.file(rel);
    if (!io.existsSync(src)) {
      problems.push({ file: rel, problem: "this run wrote no such file" });
      continue;
    }
    let text;
    try {
      text = io.readFileSync(src);
    } catch (e) {
      problems.push({ file: rel, problem: `written but unreadable: ${e?.message ?? e}` });
      continue;
    }
    if (!String(text).trim()) {
      problems.push({ file: rel, problem: "written but empty" });
      continue;
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      problems.push({ file: rel, problem: `does not parse as JSON: ${e?.message ?? e}` });
      continue;
    }
    checked.push(rel);
    for (const problem of asList(check ? check(rel, json) : null)) {
      problems.push({ file: rel, problem: String(problem) });
    }
  }
  return { ok: problems.length === 0, problems, checked };
}

/** the snapshots kept for one dataset set, oldest stamp first */
function listSnapshots(io, workDir, name) {
  const root = join(workDir, ".snapshots", name);
  if (!io.existsSync(root)) return { root, stamps: [] };
  return { root, stamps: io.readdirSync(root).sort() };
}

/**
 * Replace the live snapshot with a staged one, or leave it exactly as it was.
 *
 * @param {{ staging: object, files: string[], check?: Function, meta?: object,
 *           keep?: number, now?: () => string, io?: object }} opts
 * @returns {PromotionReport}
 */
export function promoteSnapshot({ staging, files, check, meta = {}, keep = 3,
  now = () => new Date().toISOString(), io = staging.io ?? realIo }) {
  const rels = files.map(relPath);
  const report = {
    name: staging.name,
    stamp: staging.stamp,
    dataDir: staging.dataDir,
    workDir: staging.workDir,
    staging: staging.dir,
    ok: false,
    promoted: [],
    problems: [],
    checked: [],
    backupDir: null,
    failedFile: null,
    rolledBack: false,
    pruned: [],
    manifestFile: null,
    manifest: null,
  };

  const validation = validateSnapshot({ staging, files: rels, check, io });
  report.checked = validation.checked;
  if (!validation.ok) {
    report.problems = validation.problems;
    return report;
  }

  const backupDir = join(report.workDir, ".snapshots", staging.name, staging.stamp);
  report.backupDir = backupDir;
  io.mkdirSync(backupDir);

  /* back up first, by copy: the live file stays readable the whole time, and
     there is something to put back if the swap itself fails */
  const backups = new Map();
  for (const rel of rels) {
    const live = staging.live(rel);
    if (!io.existsSync(live)) continue;
    const copy = join(backupDir, rel);
    io.mkdirSync(dirname(copy));
    io.copyFileSync(live, copy);
    backups.set(rel, copy);
  }

  const restore = (rel) => {
    const live = staging.live(rel);
    const copy = backups.get(rel);
    if (!copy) { io.rmSync(live); return; }
    const tmp = `${live}.rollback-${staging.stamp}`;
    io.copyFileSync(copy, tmp);
    io.renameSync(tmp, live);
  };

  const swapped = [];
  for (const rel of rels) {
    const live = staging.live(rel);
    io.mkdirSync(dirname(live));
    try {
      io.renameSync(staging.file(rel), live);
      swapped.push(rel);
    } catch (e) {
      for (const done of swapped) {
        try { restore(done); } catch { /* the older snapshot stays where it is */ }
      }
      report.failedFile = rel;
      report.rolledBack = true;
      report.problems = [{ file: rel, problem: `swap failed after ${swapped.length} file(s) moved, rolled them back: ${e?.message ?? e}` }];
      return report;
    }
  }

  /* the metadata goes last and is what makes the set one snapshot: reading it
     tells you which files were promoted together and under which stamp */
  const manifest = {
    name: staging.name,
    stamp: staging.stamp,
    promotedAt: now(),
    files: rels.map((rel) => {
      const live = staging.live(rel);
      let bytes = null;
      try { bytes = io.statSync(live).size; } catch { /* a file the caller did not stage */ }
      return { file: rel, bytes };
    }),
    ...meta,
  };
  const manifestRel = `${staging.name}-snapshot.json`;
  const manifestTarget = staging.live(manifestRel);
  const manifestTmp = `${manifestTarget}.tmp`;
  io.mkdirSync(dirname(manifestTarget));
  io.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 1) + "\n");
  io.renameSync(manifestTmp, manifestTarget);

  report.ok = true;
  report.promoted = rels;
  report.manifest = manifest;
  report.manifestFile = manifestRel;

  if (keep > 0) {
    const { root, stamps } = listSnapshots(io, report.workDir, staging.name);
    const stale = stamps.slice(0, Math.max(0, stamps.length - keep));
    for (const s of stale) {
      io.rmSync(join(root, s));
      report.pruned.push(s);
    }
  }

  /* promotion is done and the staged files were renamed out of it, so the run
     leaves no scratch behind; a run that stopped earlier keeps its directory
     exactly so the output can be inspected */
  io.rmSync(staging.dir);
  return report;
}

/** the live snapshot's metadata, or null when nothing has been promoted yet */
export function readManifest({ dataDir, name, io = realIo }) {
  const file = join(dataDir, `${name}-snapshot.json`);
  if (!io.existsSync(file)) return null;
  try {
    return JSON.parse(io.readFileSync(file));
  } catch {
    return null;
  }
}

/** one paragraph for the end of a run's stdout: what happened, and where the
    temporary output is if it did not */
export function formatPromotion(report) {
  const head = `snapshot ${report.name} @ ${report.stamp}`;
  if (report.ok) {
    const lines = [`${head}: promoted ${report.promoted.length} file(s)`];
    lines.push(`  previous copies -> ${join(report.workDir, ".snapshots", report.name, report.stamp)}`);
    if (report.pruned.length) lines.push(`  pruned older snapshots: ${report.pruned.join(", ")}`);
    lines.push(`  metadata -> ${report.manifestFile}`);
    return lines.join("\n");
  }
  const why = report.rolledBack
    ? "swap failed; every file already moved was put back"
    : "validation failed; the live snapshot was never written to";
  const lines = [`${head}: NOT PROMOTED - ${why}`];
  for (const p of report.problems) lines.push(`  - ${p.file}: ${p.problem}`);
  lines.push(`  staged output kept for inspection at ${report.staging}`);
  return lines.join("\n");
}
