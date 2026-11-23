# Announcing updated result counts on the Issue Finder

**Issue:** [#129 — The Issue Finder should announce updated result counts to assistive technology](https://github.com/adityalenova/cyrus/issues/129)
**Level:** 2 · **Branch:** `feat/129-finder-announcer`

## Problem
The finder's result count — "N issues match" — is painted as a `<span>` above the grid. A filter
change re-renders that line and the grid, but nothing tells a screen-reader user that the results
moved, how many are left, or that the search found nothing. The grid is a list of links, so tabbing
through it works; discovering that there are now 4 results instead of 300 did not.

## What was built
- A polite live region (`role="status" aria-live="polite" aria-atomic="true" className="sr-only"`)
  mounted from the first render, in the results column, never focusable and not in the tab order.
- It is filled **400 ms after a filter settles** (`ANNOUNCE_DELAY`), which covers the typed search
  (300 ms URL debounce), chips, sort and Reset. The timer is cleared on every new phase/count/query,
  so a burst of keystrokes produces one sentence, not one per character.
- **No repeated counts:** the last announced count is kept separately from the rendered one; a
  result total that has not moved returns `null` and the region is left untouched.
- **Four distinct sentences**, because they are four different situations:

| Phase / total | Spoken |
| --- | --- |
| first read (`loading`, nothing announced yet) | "Reading the issue index." |
| request failed | "The issue index did not answer, so these results are out of date." — the block with **Try again** stays on screen |
| ready, 0 results | "No issues match for “rust, beginner-labelled”." |
| ready, N results | "42 issues match for “rust”." / "1 issue matches." |

The query clause comes from the URL's own filters (search words, organization, label,
beginner-labelled, nobody assigned), clipped to 60 characters so the sentence stays short.

### Why loading is conditional
A loading frame carries the *previous* total in `body`, and announcing "reading the index" on every
filter change would double-speak each search (loading, then the count). It is therefore spoken only
when no count has ever been announced — the first paint. The visible "Reading the index" label is
untouched.

### sr-only
`src/app/globals.css` defines no `.sr-only` utility, but the project is Tailwind v4 and `sr-only` is
a built-in utility already used on this page (`<h2 className="sr-only">Matching issues</h2>`) and in
`Breadcrumbs`, `PdfExport` and `NotificationBell`. No globals edit was needed and none was made.

## File map
| Path | Role |
| --- | --- |
| `src/features/issue-finder-live/model.ts` | pure `describeResultStatus`, `queryPhrase`, `queryLabel`, phase texts |
| `src/features/issue-finder-live/model.test.ts` | 21 vitest cases (node only): loading / error / zero / N matrix, repeated counts, unusable counts, settled-filter sequence |
| `src/features/issue-finder-live/useAnnouncement.ts` | `useResultAnnouncement` — the 400 ms debounce and the announced-count baseline |

Integration edit (two hunks, one file):
- `src/views/IssueFinder.tsx` — two imports; one `useMemo` + one hook call beside the existing
  filter derivations; the `<p role="status" … className="sr-only">` region between the results
  header and the error block.

## Data sources
`body.total` from `GET /api/issues` (the crawl snapshot already used by the page), plus the filters
read from `useSearchParams()`. No new request, no client-side arithmetic over the rows, nothing
fabricated: when the request fails the region says so and the retry stays where it was.

## Limitations / notes
- Deduplication is on the count alone, as the issue asks. A filter change that lands on the same
  total (12 → 12) is therefore silent; the query is not used to force a repeat, because "does not
  repeat an unchanged count" was the explicit requirement.
- The debounce is a fixed 400 ms; there is no `prefers-reduced-motion` interplay because the region
  is text, not motion.
- The region holds the last sentence after a change (it is not cleared), which is standard live-region
  behaviour — screen readers announce insertions, not the standing text.
