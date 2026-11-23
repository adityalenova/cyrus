# docs(util): make the CATALOG comment match what the module derives

**Issue:** [#101 — src/lib/util.ts describes a catalog three times smaller than the array it builds](https://github.com/adityalenova/cyrus/issues/101)
**Level:** 3

## Problem

`CATALOG` in `src/lib/util.ts` is built as `[...REPOS, ...PROGRAM_REPOS]`, but
the comment above it described a fixed "528-repo agent catalog". The two source
arrays are `REPOS` (1528 rows) and `PROGRAM_REPOS` (87 rows), so the comment
understated the derived catalog by roughly a factor of three — and would have
gone stale again on the next data refresh even if the number had been right.

Nothing enforced the relationship either: a future edit could filter, dedupe or
append to that line and the site's catalog would quietly shrink with no test
noticing.

## What changed

| File | Change |
| --- | --- |
| `src/lib/util.ts` | The comment on `CATALOG` now states the derivation — `REPOS` followed by `PROGRAM_REPOS`, therefore `REPOS.length + PROGRAM_REPOS.length` rows — and says explicitly that no count is written down because a refresh changes both inputs. No constant was added and no number is hardcoded. |
| `src/lib/util.test.ts` | **New file.** One unit test asserting `CATALOG.length === REPOS.length + PROGRAM_REPOS.length`, with a one-line comment on why the guard exists. |

No other line in `util.ts` was touched: no renames, no reformatting, no export
changes.

## Note for reviewers

- The commit that preceded this branch (`a07ad97`) had already replaced the
  `528` literal with "agent catalog repos (REPOS) plus program projects
  (PROGRAM_REPOS)". This branch keeps that direction and adds the sizing
  relationship the issue asks for, so the comment names the derivation rather
  than only the two inputs.
- No `src/lib/util.test.ts` existed, and no equivalent assertion existed
  anywhere else (`grep CATALOG.length` found no test before this one), so the
  test is new rather than an extension.

## Deliberately left alone

- `src/lib/util.ts`'s formatting, hook and helper exports (`fmtCompact`, `useStored`, `hash`, …) — issue #206 documents other modules; this branch stays inside the one comment block plus the new test.
- The data modules themselves (`src/data/repos.ts`, `src/data/programRepos.ts`) — the duplicate/shape question belongs to the catalog refresh work, not to a comment fix.

## Verification

```
node ../../node_modules/typescript/bin/tsc --noEmit           # exit 0
node ../../node_modules/vitest/vitest.mjs run src/lib/util.test.ts
# Test Files 1 passed (1) | Tests 1 passed (1)
```
