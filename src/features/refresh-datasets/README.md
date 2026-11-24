# `npm run refresh` must not stamp the README for datasets it did not rebuild

**Issue:** [#87](https://github.com/adityalenova/cyrus/issues/87) — Level 3

## Problem

`scripts/refresh.mjs` rebuilt exactly one dataset (the GSoC archive), then
called `updateReadmeSnapshot()`, whose badge was derived from the catalog in
`src/data/repos.ts` — a file the refresh never wrote. The README therefore
announced a refreshed snapshot on every invocation, including runs that
rewrote nothing, and the badge could drift away from the datasets it claimed
to describe. An earlier workaround (commit `9158f73`) commented the call out
entirely, so a run that did rewrite the archive left the README untouched.

## What was built

`scripts/refresh.mjs` now drives all four datasets and records the truth:

| id | dataset | builder | credential |
| --- | --- | --- | --- |
| `gsoc` | `public/data/gsoc-projects.json` | fetched in `refresh.mjs` from `summerofcode.withgoogle.com/api` | none (public API) |
| `issues` | `src/data/issueSignals.ts`, `src/data/crawlStats.ts` | `scripts/build-crawl-data.mjs` | none itself; its input `data/crawl/issues.jsonl` is written by `scripts/crawl-github.mjs`, which needs **`GH_TOKEN`** (or `gh auth token`) and exits 1 without one |
| `roster` | `public/data/program-roster.json` | `scripts/build-program-roster.mjs` | none — reads only checked-in `public/data` |
| `mentors` | `public/data/mentor-index.json` | `scripts/build-mentor-index.mjs` | none — reads only checked-in `public/data` |

- **`all` means every credential-free builder** — all four rows above. The
  crawl itself is not run by the refresh (hours of rate-limited requests); when
  `data/crawl/issues.jsonl` is missing the issue step prints an explicit reason
  naming `GH_TOKEN` (or pointing at `scripts/crawl-github.mjs --phase issues`
  when the variable is set) instead of silently vanishing.
- **`gsoc`, `issues`, `roster`, `mentors`** select one dataset each. `gsoc`
  keeps its existing meaning and default behaviour.
- **A failing builder aborts the run** with a non-zero exit naming the builder;
  `updateReadmeSnapshot()` is never reached, so no date is moved.
- **The README line is per dataset.** A marked block in *How the data is built*
  records one date per dataset; a run writes this run's date only for the
  datasets it actually rebuilt, and carries every other date forward. When a
  run rebuilt nothing, the README is not touched at all. When everything ran,
  every dataset keeps a date — the line is never emptied.

Pure, exported and tested without running any builder:

- `planRefresh(which, { env, hasCrawlInput })` — which datasets run, and the
  exact skip reason for a token-gated step.
- `stampPlan({ results, previous, date })` — no write on failure, no write when
  nothing was rebuilt, otherwise only rebuilt ids get the new date.
- `renderRefreshLine(dates)` / `parseRefreshLine(readme)` /
  `applyRefreshStamp(readme, dates)` — the marked line, in both directions.
- `updateReadmeSnapshot(root, { results, date, readFile, writeFile })` — the
  file write, injectable so a test never touches the real README.

The CLI only runs when the file is invoked directly (`realpathSync(argv[1])`),
so importing it from a test has no side effects.

## File map

```
scripts/refresh.mjs                       pipeline, pure planning/stamping, README line
scripts/refresh.test.mjs                  22 node:test cases
README.md                                 the dataset-rebuild block + revised copy
src/features/refresh-datasets/            this README
```

## How to run

```
node scripts/refresh.mjs              # all credential-free builders
node scripts/refresh.mjs gsoc         # one dataset
node scripts/refresh.mjs roster
node --test scripts/refresh.test.mjs  # or the glob below
node --test "scripts/**/*.test.mjs"
```

`node --test scripts/` is interpreted as a module path by Node v24.18.1 in
this environment; the glob form is the one that runs the suites.

## README line format

```html
<!--refresh:datasets-->
**Dataset rebuild** - issue snapshot 2026-10-21; program roster 2026-10-25; mentor index 2026-10-25. Each date is the day that dataset was last rebuilt by `npm run refresh`; a dataset that is not listed was not rebuilt by any recorded run.
<!--/refresh:datasets-->
```

Per-dataset timestamps were chosen over one run date because the issue needs
the line to distinguish "this dataset was rebuilt now" from "the script was
invoked". `gsoc` is absent from the seed line: the archive carries no
generated date, and inventing one would repeat the bug this fixes.

## Limitations and risks

- The crawl (`scripts/crawl-github.mjs`) is still not called by the refresh.
  `npm run refresh` refreshes the issue-derived datasets from the crawl already
  on disk; refreshing the crawl stays a separate, token-gated job. If the crawl
  file is stale, the rebuilt issue snapshot is current only as of that crawl.
- `build-program-roster.mjs` writes a `public/data/program-roster.json.bak`
  beside its output; the promotion gate added in #138 is the right place to
  stop that file being served, and is not changed here.
- `refresh.mjs` still has no `gh`-auth fallback for `GH_TOKEN`; it only reports
  it. A run without the variable keeps the previous crawl and the previous
  issue snapshot, and says so.
- An unknown flag now prints the usage line and exits 1; before, it printed the
  usage line and exited 0. `gsoc`, `all` and the no-argument default are
  unchanged, and `all` now means every credential-free builder rather than only
  the GSoC archive.
- The README block is required: if its markers are removed the stamp step
  throws and the run exits non-zero after the builders have already written.
  That is deliberate (silently appending a second line would hide the change),
  but it means a README edit can fail a refresh after the data is written.
- Datasets are still written in place by their builders; #138's
  `scripts/promote-snapshot.mjs` is what should run afterwards to validate and
  promote the set as a whole.
