# Bulk removal for stale tracked repositories — My Repositories

**Issue:** [#135 — My Repositories needs bulk removal for stale tracked entries](https://github.com/adityalenova/cyrus/issues/135)
**Level:** 2 · **Branch:** `feat/135-repo-bulk`

## Problem
Following repositories is one click each, but unfollowing was also one click each: the bookmark
button on every card is the only way out of the list. After a few months the board fills with
repositories the visitor no longer works in, and clearing ten of them means ten separate
confirmations with no way to see what is about to go.

## What was built
A selection-and-review flow mounted on the existing My Repositories board page.

- Every card gains a labelled checkbox (`Select owner/repo for removal`).
- The toolbar above the grid carries a **Select all shown** checkbox (with the native
  indeterminate state when only some rows are ticked), a live `N selected` count, a
  **Clear selection** action, and **Review removal**, which is disabled at zero selection.
- The review step names the count and lists every repository by name, with **Remove N
  repositories** / **Keep them**. Nothing is removed before that confirm.
- After the confirm each row reports its own outcome. Successes read `removed`; anything the
  store could not drop is listed under a `role="alert"` block with its own **Retry** button.
- Retrying rebuilds the plan from the failed rows only and merges the answers back, so a row
  that failed once and then succeeded changes state in place.

### Selection is scoped to visible rows
The filter box is the page's own. A selection can only ever contain rows on screen:

1. **Select all shown** takes exactly the rows the current filter leaves, never a union with a
   stale hidden id.
2. When the filter changes, the hook prunes the selection to what is still visible, so the
   `N selected` count never describes a row the visitor cannot see.
3. `planRemoval` intersects the selection with the visible rows a second time and reports any
   dropped id as `plan.dropped`. The confirm passes only `plan.ids` to the store.

### Data source
Only the existing store. `useStore().saved` (localStorage key `agenthub.saved`) is the list of
followed repository ids; `removeSavedRepos(ids)` filters that list in one state update and
mirrors the removal to `/api/me/saved` when a server session is active. The catalog rows
(`src/data`, via `repoById`) supply names, descriptions and stats - nothing here writes them.

### Accessibility
Labelled native checkboxes (globals already restores a visible `:focus-visible` outline on form
controls), `aria-label` that includes the repository name, `role="status"` + `aria-live="polite"`
on the selection count and the outcome summary, one `role="alert"` block for failures, no focus
stealing (the review step opens inline, not in a dialog), and `.reveal` animation that globals
disables under `prefers-reduced-motion`.

## File map
| Path | Role |
| --- | --- |
| `src/features/repo-bulk/model.ts` | pure selection set, select-all-visible, prune, removal plan, per-row outcomes, retry, summary |
| `src/features/repo-bulk/model.test.ts` | 24 vitest cases (node only): toggling, filtered select-all, plan contents, partial failure, empty-selection guard |
| `src/features/repo-bulk/BulkPanel.tsx` | `useRepoBulk` controller, `RepoBulkCheckbox`, `RepoBulkPanel` (toolbar, review, outcomes) |

Integration edits:
- `src/lib/dash/repos.tsx` — imports + `useStore().removeSavedRepos`, the `bulkRows`/`useRepoBulk`
  wiring after the filtered `rows`, `<RepoBulkPanel>` between the filter box and the grid, and one
  `<RepoBulkCheckbox>` per card.
- `src/lib/store.tsx` — new `removeSavedRepos(ids)` on the store (interface, callback, provider
  value). See the note under Limitations for why this was required.

## Limitations / notes
- **Why the store gained a method.** `toggleSaved` reads `savedStored` from the current render, so
  calling it once per selected id inside one handler would keep only the last removal. One write
  over the whole selection is the only correct route, and its return value (ids still followed) is
  what makes per-row failure reporting honest rather than assumed.
- Local removal is synchronous, so a failure is only observable as "the id is still in the store"
  after the write. The panel reports exactly that and offers the retry; it never assumes success.
- Selection is deliberately not persisted across visits - a stale selection is how the wrong
  repository gets removed.
- Organizations are out of scope: the issue asks for tracked repository entries.
