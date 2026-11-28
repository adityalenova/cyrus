# A recoverable empty state for My Issues

**Issue:** [#130 — My Issues needs a recoverable empty state when no issues are tracked](https://github.com/adityalenova/cyrus/issues/130)
**Level:** 2 · **Branch:** `feat/130-my-issues-empty`

## Problem
A first visit to My Issues showed a quiet card — "No issues tracked yet", "Paste a link above, or
track one of the open issues the crawl found below" — under a paste box and a row of empty stage
chips. Nothing on the page said what tracking a board issue actually does, and nothing pointed at
the place where there is something to track. The same card also served a stage filter with no rows,
so "empty board" and "empty stage" were one state with two sentences.

## What was built
A first-run state for the issue column, drawn only when the ledger has been read and is actually
empty:

- **What tracking is, in three sentences.** It keeps the issue's link, repository and stage in this
  browser; it is a note to yourself, not an assignment claim.
- **A direct route to the Issue Finder** (`/issues`) as the primary action, plus the reminder that
  pasting a link in the box above does the same thing.
- The stage-filtered case keeps its own card ("Nothing in Working on it" and how to move a row
  there) — the first-run explanation is not shown to someone who already tracks issues.

### Three states, deliberately not collapsed
`selectEmptyState({ ready, error, count })` in `model.ts` answers one of four kinds, in this
precedence:

| Input | Kind | What the column shows |
| --- | --- | --- |
| `error` set (with or without rows, ready or not) | `error` | the message and its own **Try again** — never "nothing tracked" |
| `!ready` | `loading` | the "Reading your issue ledger" indicator with the column's shape |
| `ready`, no error, `count === 0` | `empty` | the first-run door described above |
| `ready`, no error, `count > 0` | `none` | the rows, as before |

A failure outranks loading and outranks stale rows because the retry is the only honest next step;
an unread ledger outranks the placeholder count because `0` before the read is not a fact about the
board. A corrupt count (`NaN`, `Infinity`, negative) is treated as nothing tracked rather than as a
reason to render a half-built page.

### Accessibility and layout
The first-run door is one `<h2>` plus body text and one link, all inside the existing `Card`.
On narrow screens the column is a single centred stack (`flex-col`), the body copy is capped at
`470px` and wraps, and the action is `w-full max-w-[300px]` below `420px`-scale widths, so nothing
overflows horizontally. The only interactive element is a real `<Link>`, reachable and visible on
focus through the global `:focus-visible` outline. Loading announces through `role="status"`
(polite); the failure block is `role="alert"`; nothing here moves focus.

## File map
| Path | Role |
| --- | --- |
| `src/features/my-issues-empty/model.ts` | pure `selectEmptyState`, `isFirstRun`, count normalisation |
| `src/features/my-issues-empty/model.test.ts` | 10 vitest cases (node only): full loading / error / zero / non-zero matrix |
| `src/features/my-issues-empty/EmptyState.tsx` | `MyIssuesEmptyState` rendering the empty, loading and error variants |

Integration edit (surgical, two hunks in one file):
- `src/lib/dash/issues.tsx` — two imports, and the `shown.length ? rows : …` branch became
  `rows / first-run state / stage-empty card`.

## Data sources
`Dash.issues` and `Dash.boardReady` from `src/lib/dash/useDash.ts`, which reads the issue ledger out
of `localStorage` (key `cyrus.issues.v1` via `useIssueLedger`). No network read, no fabricated counts.

## Limitations
- My Issues reads only this browser's ledger, so the page currently has **no request that can fail**:
  the section passes `ready: d.boardReady, error: null`. The error variant and its retry exist and
  are tested so a future server read cannot fall through to "nothing tracked"; `onRetry` is optional
  and, without it, the block says to reload rather than showing a dead button.
- The board gate (`DashGate`) keeps its own "Loading your board" indicator. The loading variant here
  keeps the column's shape for a caller that renders the section outside that gate.
- The existing stage-empty card still contains its original `stage === "all"` sentence. It is
  unreachable now (the `all` stage with no rows is the first run), and was left untouched to keep
  the integration diff to the two hunks above.
