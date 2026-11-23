# feat(analytics): analytics dashboard for organization admins

**Issue:** [#187](https://github.com/cyrus-ai/cyrus/issues/187)
**Labels:** Level 3
**Branch:** `feat/187-org-analytics`

## Problem
There was no analytics surface at all: `src/lib/analyticsTracker.ts` dispatched
`cyrus:analytics` events that nothing listened to, the issue ledger and saved
searches held dated rows nobody read back, and the crawl snapshot was only
exposed as lists. #187 asks for a dashboard with a time range, period
comparison, charts, CSV export and organisation-level aggregates — built from
real data only, with provenance on every panel.

## What was built
Route: `/organizations/analytics`.

- **Time series from this browser (7 / 30 / 90 days)** — three real stores are
  merged by `model.ts`:
  - `cyrus.analytics.events.v1`, written by a recorder that listens to the
    app's existing `cyrus:analytics` events while the dashboard is open
    (capped at 500 rows, name + timestamp only, no payload);
  - `cyrus.issues.v1` — the issue ledger, one event per tracked issue, dated by
    its stored `added` day, named `issue.<stage>`;
  - `cyrus.searches.v1` — saved searches, one `search.saved` per row, dated by
    `added`.
- **Period-over-period comparison** — current window vs the equally long window
  before it: counts, delta, and a percent that is `null` (shown as `—`) rather
  than a division by zero.
- **Two hand-rolled accessible SVG charts** — daily bars and a cumulative
  current-vs-previous line, both with `<details>` tables of the same values and
  a `role="img"` label; no chart library.
- **CSV export of the visible dataset** — per-day rows for the selected range
  (zero days included, so the file matches the chart), plus organisation or
  repository rows for the visible snapshot table. Uses the existing
  `src/lib/exportCsv.ts`.
- **Real-time-ish line** — "last event 12s ago", derived from the newest
  stored timestamp and a one-second clock. It states that there is one visitor
  (you) and no server-side count; there is no socket.
- **Organisation and repository views** — from the crawl snapshot detail rows:
  repositories per organisation, open issues, languages, beginner counts/share.
  Snapshot totals (40,017 issues, 290 repositories, 272 organisations, 17
  languages, 757 beginner-labelled) are shown as one point in time, with the
  sentence that a second snapshot would be needed for a trend.
- **Explicit empty states** — "no history yet" (nothing stored) and "nothing in
  this window" (history exists outside it), named in `historyState()` and
  tested.

## File map
| Path | Role |
| --- | --- |
| `src/features/org-analytics/model.ts` | pure windows, buckets, comparison, store parsing, snapshot aggregation, CSV shapes |
| `src/features/org-analytics/model.test.ts` | vitest, node env (31 tests) |
| `src/features/org-analytics/storage.ts` | browser reads + the `cyrus:analytics` recorder |
| `src/features/org-analytics/OrgAnalytics.tsx` | the dashboard, charts, tables, export |
| `src/app/organizations/analytics/page.tsx` | route + metadata |

## Data sources and as-of dates
1. **This browser, this visitor.** Reads at page load; the recorder adds rows
   while the page is open. Each panel prints "your recorded events in this
   browser, since <date>", where the date is the earliest stored timestamp.
2. **Crawl snapshot, crawled 2026-10-21.** `src/data/issueSignals.ts` (30
   crawled issues that carry labels/language) and `src/data/crawlStats.ts`
   (snapshot totals). Every snapshot panel prints "crawl snapshot, crawled
   2026-10-21".

No sample traffic, no synthetic series, no interpolated snapshot trend.

## Tests
`node ../../node_modules/vitest/vitest.mjs run src/features/org-analytics`

Covers: inclusive UTC windows and the preceding window; bucket counts with zero
days, offset timestamps, day-anchored ledger rows, invalid timestamps and
out-of-window rows; comparison math including `null` percent and rounding;
cumulative series; last-event age and labels; empty-state selection; name
counts; recorder/ledger/search parsing and merge; org/repository/language
aggregation and beginner share; CSV row shapes for all three exports.

## Limitations (also stated on the page)
- **One snapshot is one point in time.** No growth line is drawn for the
  snapshot, because there is nothing to difference it against.
- **The organisation table is the detail set, not the full index.** Only 30
  crawled issues ship with labels and language, over 17 organisations and 18
  repositories; the totals panel shows the full 40,017-issue snapshot.
- **Every detail row is beginner-labelled**, because that is the crawl's
  selection rule — so the per-organisation beginner share is 100% by
  construction, and the page says so instead of presenting it as insight.
- **No tenant attribution.** The ledger and saved searches store no user or
  team, so "organisation analytics" here are the snapshot's aggregates; the
  visitor-level panels are per browser.
- **Recorder coverage is honest but narrow.** The recorder is mounted on this
  page only (mounting it in the root shell is a one-line follow-up), so tracker
  events accrue only while an analytics page is open. The ledger and saved
  searches reach back further because they are written by the pages that own
  them.
- Reading `localStorage` in private mode can fail silently; the page then shows
  the empty states rather than stale numbers.
