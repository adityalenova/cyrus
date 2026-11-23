# Promote refreshed catalog snapshots only after all source datasets pass validation

**Issue:** [#138](https://github.com/adityalenova/cyrus/issues/138) — Level 3

## Problem

The refresh pipeline writes its dataset files one at a time into `public/data`.
Nothing sat between the last builder and the site: a fetch that returned a
degraded archive, a builder that produced an empty file, or a run interrupted
halfway through its writes left the served snapshot in whatever mixed state the
run happened to reach. A page could count 12 projects where it had counted
5,000, and no file on disk said why.

## What was built

- **`scripts/lib/snapshot.mjs`** — pure, `fs`-injected logic:
  - `requiredDatasets()` returns the four datasets a catalog snapshot consists
    of (file name, source, top-level shape, row accessor, minimum row count and
    where that number comes from).
  - `validateDataset(name, raw)` parses the bytes (or accepts an already-parsed
    object), checks the top-level shape, rejects empty datasets and enforces the
    minimum. Every failure is a `SnapshotError` that names the dataset and the
    problem.
  - `planPromotion({ stagingDir, targetDir, present, withMeta })` returns the
    ordered backup/move steps without touching the filesystem, so the order can
    be asserted in a test and printed by `--dry-run`.
  - `promote({ stagingDir, targetDir, fs, now })` validates every required
    dataset in staging, writes `snapshot.json` (promotedAt + per-dataset row
    counts + source names) **once**, then moves the complete set into place.
    Existing target files are parked in `.snapshot-backup` first. If any move
    fails, everything already moved is renamed back, the backups are restored,
    and the error names the failing dataset and the staging directory.
- **`scripts/promote-snapshot.mjs`** — the standalone CLI. It copies the
  refreshed datasets from a source directory into a versioned staging
  directory (`.snapshot-staging/<timestamp>`), validates the whole set, and
  promotes it. Any failure leaves the served files byte-identical and exits 1
  with the failing source and the staging path. `--dry-run` stages and
  validates but changes nothing.
- **`scripts/promote-snapshot.test.mjs`** — 15 `node:test` cases over temp
  directories.

### The four datasets and where each minimum comes from

| Dataset | Rows counted | Minimum | Read off |
| --- | --- | --- | --- |
| `gsoc-projects.json` | `projects.length` | 5,000 | `scripts/refresh.mjs` refuses to overwrite the archive below 5,000 accepted projects |
| `otherProjects.json` | `projects.length` | 3 | `scripts/build-program-roster.mjs` reads three programs (LFX, Outreachy, Summer of Bitcoin) out of this file and emits a section only for one with rows |
| `program-roster.json` | number of `programs` sections | 1 | `build-program-roster.mjs` writes a section only when the source archive has rows; `totals.programs` must agree with the file |
| `mentor-index.json` | number of `programs` sections | 1 | `build-mentor-index.mjs` creates a bucket only for a program whose rows name a mentor |

`public/data/issues.json.gz` is deliberately out of this set: it is gzipped,
not JSON, and is produced only from a token-gated crawl.
`scripts/build-issue-index.mjs` already validates it with
`src/lib/crawlSnapshotSchema.mjs` before writing.

## File map

```
scripts/lib/snapshot.mjs             validation, plan, promotion with rollback
scripts/promote-snapshot.mjs         CLI: stage -> validate -> promote
scripts/promote-snapshot.test.mjs    node:test suite over temp dirs
src/features/snapshot-promotion/     this README
```

## How to run

```
# validate and promote the current public/data set (creates snapshot.json)
node scripts/promote-snapshot.mjs

# stage and validate only; print the move plan
node scripts/promote-snapshot.mjs --dry-run

# explicit source/target/staging directories
node scripts/promote-snapshot.mjs --source public/data --target public/data --staging .snapshot-staging/my-run

# tests (node v24.18.1 treats `node --test scripts/` as a module path here,
# so pass the glob)
node --test "scripts/**/*.test.mjs"
```

## Wiring it into `npm run refresh`

`scripts/refresh.mjs` is owned by issue #87, so this change does not touch it.
Once both land, the last step of a refresh is one call:

```js
import { spawnSync } from "node:child_process";
const promoted = spawnSync(process.execPath, ["scripts/promote-snapshot.mjs"], { stdio: "inherit" });
if (promoted.status !== 0) process.exit(promoted.status); // do not stamp the README
```

The same call belongs at the end of `npm run refresh:all`, after every builder
whose output is promoted has run. Nothing here imports `refresh.mjs` and
`refresh.mjs` does not import this, so either can land first.

## Limitations

- The set is the four catalog JSON files. The per-program shards under
  `public/data/program-roster/` and `public/data/program-projects/` are
  referenced by `program-roster.json` but are promoted as separate directories;
  a future change should promote the directory tree or add the shard files to
  `requiredDatasets()`.
- Promotion is a sequence of renames, not one atomic filesystem operation. It
  is atomic from the reader's point of view only in the sense that a failed
  run restores the previous bytes; a reader that opens a file in the middle of
  a successful run can still see one old file next to one new file.
- A failed promotion keeps its staging directory for inspection (the path is
  printed). It is not deleted automatically.
- `.snapshot-staging/` is not in `.gitignore` (that file is outside this
  change); a failed run leaves an untracked directory.
- The minimum counts are floors, not diff gates: a dataset can pass with 5,000
  rows while being a different 5,000 rows. The before/after comparison already
  exists in `scripts/lib/quality-gate.mjs` for `program-projects` and is the
  right place to extend later.
