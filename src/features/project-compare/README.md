# Repository comparison (`/projects/compare`)

**Issue:** [#192 — Implement side-by-side project comparison feature](https://github.com/adityalenova/cyrus/issues/192)
**Level:** 3

## Problem

The platform could compare *archived program projects* (`/compare`) and
*programs* (`/programs/compare`), but there was no repository-level reading of
the catalog: stars, forks, open issues, language, licence, GitHub topics, the
publishing program's stack and last-push age. A visitor weighing repositories
had to open three pages and remember the numbers.

## What was built

- `/projects/compare` — a **distinct** page from `/compare`. The archived
  project matrix asks about a program round and named mentors; this one asks
  what the repository catalog states about a repository. The page links to
  `/compare` and says which is which.
- **Choose up to three** repositories from the live catalog (`CATALOG` in
  `src/lib/util.ts`). The picker searches name first, then topics, then the
  description, and never offers one already selected.
- **Comparison matrix** with real table semantics: `<caption>`, `<th scope="col">`
  with an `aria-label` per column, `<th scope="row">` per field, a sticky header
  and sticky field column on desktop, and a labelled scroll region so the table
  is keyboard-reachable. Every interactive control has a focus-visible ring.
- **Differences vs similarities** read off the same predicate: each row is
  `same`, `differs` or `unknown`, a summary names which rows split the
  selection, and differing rows are tinted.
- **Missing is not zero.** Each cell carries `value: null` for absent and keeps
  `"0"` for a reported zero; the legend explains both, and the table prints an
  italic dash for absence and a tabular `0` for a real zero.
- **Shareable URL** carrying `?repos=owner/name,owner/name` (commas and repeated
  params both parse). Copy button for the absolute link.
- **Saved comparisons** in `localStorage` under `cyrus.compare.saved.v1`: name
  the current selection, load or delete saved entries. A saved row stores the
  repository keys, so it re-reads the current snapshot instead of holding a
  stale copy.
- **Mobile stacked view**: the same matrix rendered as one card per repository.
- **Stale links** from an older snapshot resolve to a named missing list, with a
  one-click "drop the stale keys" action rather than a blank column.

## Files

| Path | Role |
| --- | --- |
| `src/features/project-compare/model.ts` | pure selection/URL logic, facts, matrix predicate, activity band, saved-comparison store shape |
| `src/features/project-compare/ProjectCompare.tsx` | the client page: picker, table, stacked cards, share, save |
| `src/features/project-compare/model.test.ts` | URL round-trip, cap, diff/similarity, missing-vs-zero, saved rows |
| `src/app/projects/compare/page.tsx` | route + metadata + canonical |

## Data sources and as-of date

- **Repositories:** `CATALOG` (`REPOS` + `PROGRAM_REPOS`) in `src/data/repos.ts`
  and `src/data/programRepos.ts`, via `src/lib/util.ts`. The regular catalog
  snapshot is **2026-10-21** (`CRAWL.crawledAt`); the program shelf header dates
  its GitHub API snapshot **2026-10-03**. Each column prints the snapshot its
  row came from.
- **Tech stack:** the repository's GitHub topics (`tags` in the snapshot), in
  the order the snapshot carries them. Not a curated stack.
- **Program stack:** union of the stacks published for the mentoring programs
  that list the repository, from `src/data/programDetails.ts`; empty where no
  tracked program lists it.
- **Difficulty (derived):** `levelOf()` from `src/lib/util.ts` — over 50k stars
  advanced, over 10k intermediate, otherwise beginner. Labelled "Derived".
- **Activity (derived):** last-push age (`updated`) against that row's snapshot
  date: active ≤30 days, quiet 31–90, dormant >90. Labelled "Derived".
- **Mentors:** not in the repository catalog. Every cell is "Not published"; the
  legend says mentor names live per program project (`/compare`, `/mentorship`).

No value is invented: stars, forks, issues, language, licence, topics and last
push are the snapshot's own; difficulty and activity name their formulas.

## Limitations

- The numbers are a snapshot, not live GitHub. Stars, forks and issue counts
  drift; the page prints the snapshot date in every column and the footer.
- "Difficulty" is a star band, not an organizer's assessment. It exists because
  the site already filters by that band on `/skills`; it is marked derived.
- "Activity" is last-push age only; it says nothing about review, release or
  issue responsiveness.
- Program stack is program-level metadata, so every repository under the same
  program shows the same stack. It is a programme's published stack, not a
  claim about the repository's own dependencies.
- Mentors are unavailable per repository by design; see `/compare` for
  per-project mentor names.
- A saved comparison is a list of keys, not a frozen snapshot.

## Tests

```
node ../../node_modules/vitest/vitest.mjs run src/features/project-compare
```

Covers: `owner/name` normalisation from URLs and `.git`, parse/serialise
round-trip, repeated and comma-separated params, casing and duplicate handling,
the three-column cap (including refusing a fourth), diff/similarity including
order-insensitive topic sets and partially stated rows, zero-vs-missing cell
shape, activity bands against each snapshot, catalog resolution and stale keys,
program-stack derivation from the real catalog, and the saved-comparison store
(shape, name errors, cap, malformed rows).
