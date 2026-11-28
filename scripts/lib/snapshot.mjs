/* ══ scripts/lib/snapshot.mjs — all datasets, or none of them ══════════════
   The refresh writes four catalog JSON files one after another into
   public/data. Until now nothing stood between the last builder and the site:
   a builder that half-wrote a dataset, or a fetch that returned an empty
   archive, left the served snapshot in whatever shape the run happened to
   reach. A reader saw a page counting 12 projects where it had counted 5,000,
   and no file on disk said why.

   This module is the gate that runs before a promotion. It knows which
   datasets a catalog snapshot consists of, how many rows each one must carry
   for the run to be believable, and how to move the complete set into place
   without ever leaving a mixture of old and new files behind.

     requiredDatasets()                -> the four dataset specs (name, rows, source, minRows)
     validateDataset(name, raw)        -> { name, rows, source, minRows } | throws
     planPromotion({ ... })            -> an ordered list of backup/move steps
     promote({ stagingDir, targetDir, fs }) -> metadata + the move, with rollback

   Every minimum below is read off the builder that produces the dataset, not
   guessed here:

     gsoc-projects.json   scripts/refresh.mjs refuses to overwrite the archive
                          when a fetch returns fewer than 5,000 accepted
                          projects ("archive looks degraded, keeping the
                          existing file").
     otherProjects.json   scripts/build-program-roster.mjs emits a section only
                          for a program whose archive has rows, and it reads
                          three programs (LFX, Outreachy, Summer of Bitcoin)
                          out of this one file; fewer than three rows means at
                          least one of those archives is gone.
     program-roster.json  the same builder writes one section per program it
                          could derive and states that count in totals.programs;
                          a file with no section is not a roster.
     mentor-index.json    scripts/build-mentor-index.mjs creates a program
                          bucket only for programs whose rows name a mentor,
                          so an empty object is an empty index.

   The crawl snapshot (public/data/issues.json.gz) is deliberately not part of
   this set: it is gzipped, not JSON, and it is produced only from a
   token-gated crawl. scripts/build-issue-index.mjs already validates it with
   src/lib/crawlSnapshotSchema.mjs before writing, and it is not one of the
   four datasets `npm run refresh` rebuilds.

   Nothing here reads the network, a credential, or the clock unless the
   caller passes a clock. `fs` is injected into promote() so a test can make
   the second move fail and watch the first one come back.
   ════════════════════════════════════════════════════════════════════════ */
import { join } from "node:path";
import * as nodeFs from "node:fs/promises";

/** the file that carries the promotion record, written once into the set */
export const SNAPSHOT_META = "snapshot.json";

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isObjectRow = (v) => !!v && typeof v === "object";

/**
 * @typedef {object} DatasetSpec
 * @property {string} name file name inside the snapshot directory
 * @property {string} source what wrote it, in words a reader can follow
 * @property {Array<string>} shape the top-level keys the dataset must carry
 * @property {(data: any) => number} rows how many rows the dataset holds
 * @property {(data: any) => string[]} problems shape problems beyond the top level
 * @property {number} minRows the smallest believable row count, and why
 * @property {string} threshold where that number comes from
 */

/** @type {DatasetSpec[]} */
const DATASETS = [
  {
    name: "gsoc-projects.json",
    source: "summerofcode.withgoogle.com/api via scripts/refresh.mjs",
    shape: ["projects", "orgs"],
    rows: (d) => d.projects.length,
    problems: (d) => {
      const bad = [];
      if (!Array.isArray(d.projects)) bad.push("projects must be an array");
      if (!isPlainObject(d.orgs)) bad.push("orgs must be an object keyed by organization name");
      if (Array.isArray(d.projects) && d.projects.some((r) => !isObjectRow(r))) {
        bad.push("every projects row must be an object");
      }
      if (Array.isArray(d.projects) && d.projects.length && !d.projects.some((r) => r.y && r.t)) {
        bad.push("no projects row carries the program year (y) and title (t) the site reads");
      }
      return bad;
    },
    minRows: 5000,
    threshold: "scripts/refresh.mjs keeps the existing file below 5,000 accepted projects",
  },
  {
    name: "otherProjects.json",
    source: "the program archives folded together by scripts/fetch-*.mjs, read by build-program-roster and build-mentor-index",
    shape: ["projects"],
    rows: (d) => d.projects.length,
    problems: (d) => {
      const bad = [];
      if (!Array.isArray(d.projects)) bad.push("projects must be an array");
      if (Array.isArray(d.projects) && d.projects.some((r) => !isObjectRow(r))) {
        bad.push("every projects row must be an object");
      }
      if (Array.isArray(d.projects) && d.projects.length && !d.projects.some((r) => r.program)) {
        bad.push("no projects row names the program it belongs to");
      }
      return bad;
    },
    minRows: 3,
    threshold: "scripts/build-program-roster.mjs reads three programs (LFX, Outreachy, Summer of Bitcoin) out of this file and only emits a section for one with rows",
  },
  {
    name: "program-roster.json",
    source: "scripts/build-program-roster.mjs",
    shape: ["programs", "totals"],
    rows: (d) => Object.keys(d.programs ?? {}).length,
    problems: (d) => {
      const bad = [];
      if (!isPlainObject(d.programs)) return ["programs must be an object keyed by program id"];
      if (!isPlainObject(d.totals) || typeof d.totals.programs !== "number") {
        bad.push("totals.programs must state how many sections the file carries");
      }
      for (const [id, section] of Object.entries(d.programs)) {
        if (!isPlainObject(section)) bad.push(`programs.${id} must be an object`);
        else if (typeof section.label !== "string" || !section.label.trim()) bad.push(`programs.${id}.label must be a non-empty string`);
      }
      if (bad.length) return bad;
      if (d.totals.programs !== Object.keys(d.programs).length) {
        bad.push(`totals.programs (${d.totals.programs}) disagrees with the ${Object.keys(d.programs).length} sections on disk`);
      }
      return bad;
    },
    minRows: 1,
    threshold: "scripts/build-program-roster.mjs writes a section only for a program whose archive has rows",
  },
  {
    name: "mentor-index.json",
    source: "scripts/build-mentor-index.mjs",
    shape: ["programs"],
    rows: (d) => Object.keys(d.programs ?? {}).length,
    problems: (d) => {
      const bad = [];
      if (!isPlainObject(d.programs)) return ["programs must be an object keyed by program id"];
      for (const [id, program] of Object.entries(d.programs)) {
        if (!isPlainObject(program)) bad.push(`programs.${id} must be an object`);
        else if (typeof program.mentors !== "number" || program.mentors < 0) {
          bad.push(`programs.${id}.mentors must be a non-negative number`);
        }
      }
      return bad;
    },
    minRows: 1,
    threshold: "scripts/build-mentor-index.mjs creates a program bucket only for a program whose rows name a mentor",
  },
];

/** A failure a caller can print without re-reading the dataset: it names the
    dataset, the staging directory, and what was wrong with it. */
export class SnapshotError extends Error {
  constructor(dataset, message, { stagingDir = null, targetDir = null } = {}) {
    super(`${dataset}: ${message}`);
    this.name = "SnapshotError";
    this.dataset = dataset;
    this.stagingDir = stagingDir;
    this.targetDir = targetDir;
  }
}

/** The four datasets a catalog snapshot is made of. */
export function requiredDatasets() {
  return DATASETS.map((spec) => ({ ...spec }));
}

/** @param {string} name */
export function datasetSpec(name) {
  const spec = DATASETS.find((d) => d.name === name);
  if (!spec) {
    throw new SnapshotError(name, `unknown dataset (expected one of ${DATASETS.map((d) => d.name).join(", ")})`);
  }
  return spec;
}

/**
 * Parse and check one dataset. `raw` may be the file text, a Buffer, or an
 * already-parsed object, so a caller can validate what a builder produced in
 * memory before it is ever written.
 *
 * @param {string} name
 * @param {string|Uint8Array|object} raw
 * @returns {{ name: string, rows: number, source: string, minRows: number }}
 */
export function validateDataset(name, raw) {
  const spec = datasetSpec(name);

  let data = raw;
  if (typeof raw === "string" || raw instanceof Uint8Array) {
    const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new SnapshotError(name, `does not parse as JSON (${err.message})`);
    }
  }

  if (!isPlainObject(data)) {
    throw new SnapshotError(name, `top level must be a JSON object, got ${Array.isArray(data) ? "an array" : typeof data}`);
  }

  const missing = spec.shape.filter((key) => !(key in data));
  if (missing.length) {
    throw new SnapshotError(name, `missing top-level ${missing.length === 1 ? "key" : "keys"} ${missing.join(", ")} (expected ${spec.shape.join(", ")})`);
  }

  const problems = spec.problems(data);
  let rows = 0;
  try {
    rows = spec.rows(data);
  } catch {
    rows = 0;
  }
  if (!Number.isFinite(rows) || rows <= 0) {
    if (problems.length) throw new SnapshotError(name, problems.join("; "));
    throw new SnapshotError(name, `carries no rows (${rows}); an empty dataset is not a snapshot`);
  }
  if (problems.length) throw new SnapshotError(name, problems.join("; "));
  if (rows < spec.minRows) {
    throw new SnapshotError(
      name,
      `carries ${rows} rows, below the minimum of ${spec.minRows} (${spec.threshold})`,
    );
  }

  return { name, rows, source: spec.source, minRows: spec.minRows };
}

/**
 * The ordered work of replacing a snapshot. Pure: it touches no files, so the
 * order can be asserted in a test and printed with --dry-run.
 *
 * Existing target files are moved into a backup directory first; only then do
 * the staged files move in. Every backup is listed before every promotion, so
 * a caller that stops on the first failure can undo exactly what it did.
 *
 * @param {{ stagingDir: string, targetDir: string, present?: string[],
 *           withMeta?: boolean, names?: string[] }} opts
 *   `present` are the dataset names already in targetDir, `withMeta` says the
 *   target already carries snapshot.json, `names` narrows the set (defaults to
 *   every required dataset).
 */
export function planPromotion({ stagingDir, targetDir, present = [], withMeta = false, names }) {
  const specs = (names ?? DATASETS.map((d) => d.name)).map(datasetSpec);
  const backupDir = join(targetDir, ".snapshot-backup");
  const steps = [];

  for (const spec of specs) {
    if (present.includes(spec.name)) {
      steps.push({
        op: "backup",
        name: spec.name,
        from: join(targetDir, spec.name),
        to: join(backupDir, spec.name),
      });
    }
  }
  if (withMeta) {
    steps.push({
      op: "backup",
      name: SNAPSHOT_META,
      from: join(targetDir, SNAPSHOT_META),
      to: join(backupDir, SNAPSHOT_META),
    });
  }
  for (const spec of specs) {
    steps.push({
      op: "promote",
      name: spec.name,
      from: join(stagingDir, spec.name),
      to: join(targetDir, spec.name),
    });
  }
  steps.push({
    op: "promote",
    name: SNAPSHOT_META,
    from: join(stagingDir, SNAPSHOT_META),
    to: join(targetDir, SNAPSHOT_META),
  });

  return {
    stagingDir,
    targetDir,
    backupDir,
    metadataPath: join(targetDir, SNAPSHOT_META),
    names: specs.map((s) => s.name),
    steps,
  };
}

async function exists(fs, path) {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate every required dataset in `stagingDir`, write one metadata file
 * describing the set, and move the whole set into `targetDir`.
 *
 * On any failure the target is left as it was found: files this call already
 * moved in are moved back out, and files it backed up are renamed back. The
 * thrown SnapshotError carries `stagingDir` so the caller can print where the
 * rejected set still sits.
 *
 * @param {{ stagingDir: string, targetDir: string, fs?: object,
 *           now?: () => Date, datasets?: string[] }} opts
 * @returns {Promise<{ promotedAt: string, metadata: object, plan: object,
 *                     files: string[], metadataPath: string }>}
 */
export async function promote({ stagingDir, targetDir, fs = nodeFs, now = () => new Date(), datasets }) {
  const specs = (datasets ?? DATASETS.map((d) => d.name)).map(datasetSpec);

  /* 1. every dataset, from the copy that is about to be promoted */
  const validated = [];
  for (const spec of specs) {
    let raw;
    try {
      raw = await fs.readFile(join(stagingDir, spec.name));
    } catch (err) {
      throw new SnapshotError(spec.name, `is missing from staging (${join(stagingDir, spec.name)}): ${err.message}`, { stagingDir, targetDir });
    }
    try {
      validated.push(validateDataset(spec.name, raw));
    } catch (err) {
      throw new SnapshotError(spec.name, err.message, { stagingDir, targetDir });
    }
  }

  /* 2. what is already served, so the plan can back it up */
  const present = [];
  for (const spec of specs) {
    if (await exists(fs, join(targetDir, spec.name))) present.push(spec.name);
  }
  const withMeta = await exists(fs, join(targetDir, SNAPSHOT_META));
  const plan = planPromotion({ stagingDir, targetDir, present, withMeta, names: specs.map((s) => s.name) });

  /* 3. the shared record, written once, before anything moves */
  const metadata = {
    promotedAt: now().toISOString(),
    datasets: Object.fromEntries(validated.map((v) => [v.name, { rows: v.rows, source: v.source }])),
  };
  try {
    await fs.writeFile(join(stagingDir, SNAPSHOT_META), JSON.stringify(metadata, null, 2) + "\n");
  } catch (err) {
    throw new SnapshotError(SNAPSHOT_META, `could not be written to staging (${join(stagingDir, SNAPSHOT_META)}): ${err.message}`, { stagingDir, targetDir });
  }

  /* 4. move: out with the old, in with the new, or back again */
  const done = [];
  let failedStep = null;
  try {
    await fs.mkdir(targetDir, { recursive: true });
    if (present.length || withMeta) await fs.mkdir(plan.backupDir, { recursive: true });
    for (const step of plan.steps) {
      failedStep = step;
      await fs.rename(step.from, step.to);
      done.push(step);
    }
    failedStep = null;
  } catch (err) {
    const undo = [];
    for (const step of [...done].reverse()) {
      try {
        await fs.rename(step.to, step.from);
      } catch (undoErr) {
        undo.push(`${step.name}: ${undoErr.message}`);
      }
    }
    const detail = undo.length
      ? `; rollback incomplete (${undo.join("; ")})`
      : "; every file this run moved was put back";
    throw new SnapshotError(
      failedStep?.name ?? SNAPSHOT_META,
      `promotion failed while moving the snapshot into ${targetDir} (${err.message})${detail}`,
      { stagingDir, targetDir },
    );
  }

  /* 5. the backup is only useful until the move ends */
  if (present.length || withMeta) {
    try {
      await fs.rm(plan.backupDir, { recursive: true, force: true });
    } catch {
      /* a backup directory left behind is clutter, not a reason to fail the run */
    }
  }

  return {
    promotedAt: metadata.promotedAt,
    metadata,
    plan,
    files: validated.map((v) => v.name),
    metadataPath: plan.metadataPath,
  };
}
