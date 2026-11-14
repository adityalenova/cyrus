/* ══ scripts/lib/quality-gate.mjs — the review that sits between a build and a publish ══
   scripts/build-program-projects.mjs reads thirteen programs and turns what it
   read into shards. Until now the run ended by writing those shards into
   public/data/program-projects/ and printing a table: the archive the site
   serves was replaced before anybody had compared it to the one it served
   yesterday, and the only number anybody saw was a row count in a console line.

   This module puts that comparison in front of the write, and leaves it on
   disk in two shapes:

     data/quality/program-projects-<read date>.json   what a gate can read
     data/quality/program-projects-<read date>.md    what a person reviews

   The decision is one boolean, `publish`. It is false when a threshold was
   exceeded and no maintainer said why that was expected. The thresholds come
   from scripts/lib/quality-report.mjs DEFAULT_THRESHOLDS and may be raised for
   one run by CYRUS_QUALITY_THRESHOLDS (JSON), CYRUS_QUALITY_<THRESHOLD>, or a
   file passed with --thresholds; publishing over a failed threshold needs
   CYRUS_QUALITY_OVERRIDE="<why>" and that reason is printed in both reports,
   next to the numbers it was granted over.

   Nothing here touches the network and nothing here reads a credential. The
   before half of every comparison is the JSON file the site is already
   serving; the after half is what this process built in memory. Values reach
   a report only through safePreview, which redacts a field named like a token
   whatever it held.

     import { reviewRefresh } from "./lib/quality-gate.mjs";
   ═══════════════════════════════════════════════════════════════════════════ */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReport, formatConsole, renderMarkdown, resolveOverride, resolveThresholds,
} from "./quality-report.mjs";

const realIo = { existsSync, mkdirSync, readFileSync, writeFileSync };

/**
 * Compare what this run built against what the site serves, write the review
 * documents, and decide whether the run may publish.
 *
 * `built` is the list of shard objects, capped and final, before any of them
 * has been written: this function does not write to `liveDir`.
 *
 * @param {{name: string, stamp: string, liveDir: string, qualityDir: string,
 *           built: Array<object>, env?: Record<string, string|undefined>,
 *           thresholdsFile?: string|null, io?: Record<string, Function>}} opts
 */
export function reviewRefresh({ name, stamp, liveDir, qualityDir, built,
  env = process.env, thresholdsFile = null, io = realIo }) {
  const datasets = [];
  const notes = [];

  for (const shard of built) {
    const file = join(liveDir, `${shard.program}.json`);
    let before = null;
    if (io.existsSync(file)) {
      /* a live file we cannot parse is not an empty archive: say so, because
         every row counting as new is exactly what the diff will look like */
      try {
        before = JSON.parse(io.readFileSync(file, "utf8"));
      } catch (e) {
        notes.push(`${shard.program}: the snapshot the site serves does not parse (${e.message}); every row of this run counts as new`);
      }
    }
    datasets.push({ id: shard.program, source: shard.source ?? "", before, after: shard });
  }

  const resolved = resolveThresholds({
    file: thresholdsFile,
    env,
    read: thresholdsFile ? (p) => io.readFileSync(p, "utf8") : null,
  });
  notes.push(...resolved.notes);

  const report = buildReport({
    name,
    stamp,
    datasets,
    thresholds: resolved.thresholds,
    thresholdSource: resolved.from.join(", "),
    override: resolveOverride(env),
  });

  const files = writeArtifacts({ qualityDir, name, stamp, report, io });

  /* the run that was blocked still has to be reviewable, so the artifacts are
     written whatever the decision is and the decision is printed after them */
  const lines = [formatConsole(report)];
  for (const n of notes) lines.push(`  note: ${n}`);
  lines.push(`  review -> ${files.md}`);
  lines.push(`  machine-readable -> ${files.json}`);

  return { report, publish: report.status !== "fail", files, notes, text: lines.join("\n") };
}

/** the two documents a maintainer or a job reads after the run */
function writeArtifacts({ qualityDir, name, stamp, report, io }) {
  io.mkdirSync(qualityDir, { recursive: true });
  const base = join(qualityDir, `${name}-${stamp}`);
  const files = { json: `${base}.json`, md: `${base}.md` };
  io.writeFileSync(files.json, JSON.stringify(report, null, 1) + "\n");
  io.writeFileSync(files.md, renderMarkdown(report));
  return files;
}
