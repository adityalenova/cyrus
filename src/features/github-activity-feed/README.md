# feat(activity): GitHub activity feed integration on user profiles

**Issue:** [#190](https://github.com/cyrus-ai/cyrus/issues/190)
**Labels:** Level 3
**Branch:** `feat/190-github-activity-feed`

## Problem
A contributor's GitHub activity was not readable inside the product except as a
summary on the existing profile page. #190 asks for a full public event feed —
timeline, type filter, 90-day contribution heatmap — served through a server
route that respects GitHub's unauthenticated rate limit and never invents data
when GitHub is throttling, missing, or down.

## What was built
- `GET /api/github/events/[login]` — validates the login against GitHub's own
  rule (400 otherwise), reads
  `https://api.github.com/users/{login}/events/public?per_page=100` with
  `next: { revalidate: 120 }`, and holds the mapped list in a module-scope TTL
  cache keyed by login (fresh for 90s, servable for 15 minutes as `stale`).
  - 404 → `404 { error: "GitHub has no user called <login>" }`
  - 403 / 429 → `429 { error, …reset hint }`; if a recent cached list exists it
    is returned with `stale: true` and the error text kept alongside, so the
    client can label it.
  - network failure / bad body / other upstream status → 502 with an honest
    message and zero events.
  - Response body is always `{ events, fetchedAt, stale?, error? }`.
- `/users/[login]/feed` — server page (dynamic `params` are Promises, Next 16)
  with `generateMetadata` and a canonical URL, rendering the client feed.
- Client feed: timeline rows with a kind glyph, repo, link and relative age;
  filter chips with `aria-pressed`; a 90-day heatmap bucketed in UTC with a
  day-by-day `<table>` alternative; explicit loading / invalid / 404 /
  rate-limited / upstream-error / empty states. Every outbound link is
  `target="_blank" rel="noreferrer noopener"`.
- Heatmap caption states the provenance verbatim: built from the public events
  API (up to 300 most recent events).
- One-line link added from the existing profile page
  (`src/views/UserActivity.tsx`) to the new feed.

## File map
| Path | Role |
| --- | --- |
| `src/features/github-activity-feed/model.ts` | pure mapper, filter, heatmap, status→state |
| `src/features/github-activity-feed/model.test.ts` | vitest, node env |
| `src/features/github-activity-feed/GithubFeed.tsx` | client feed screen |
| `src/app/api/github/events/[login]/route.ts` | server route + module TTL cache |
| `src/app/users/[login]/feed/page.tsx` | page + metadata |
| `src/views/UserActivity.tsx` | one link to the feed (2-line diff) |

## Data sources
- GitHub public Events API, read at request time by the route handler.
  Payload is GitHub's own; nothing is seeded or sampled.
- As-of date: **whatever the request returned** — the page prints the cache
  timestamp when serving a stale list, and never a fabricated "live" claim.
- Existing sibling route `/api/users/[login]/activity` and `src/lib/activity.ts`
  were read for context but not modified; this feature is independent and owns
  its own model so the two can be consolidated later without a flag day.

## Tests
`node ../../node_modules/vitest/vitest.mjs run src/features/github-activity-feed`

Covers: event→item mapping for push / pull_request / issues / review / star /
fork / create (plus unknown → "other"), compare-link suppression for the
all-zero initial sha, UTC heatmap bucketing including an offset timestamp
(`-05:00`) and a 23:59:59Z edge, out-of-window events not being moved in,
unparseable timestamps ignored, week-column padding, filter/count logic, the
summary line, `stateForStatus` for 200/400/404/403/429/5xx, login validation
and age formatting.

## Limitations
- One page of 100 events (GitHub's cap is 300 per feed); the API keeps only 90
  days, so older activity is not recoverable.
- Unauthenticated quota is 60 requests/hour per deployment; the route uses a
  `GITHUB_TOKEN` when present but the cache is the main protection.
- In-process cache is per server instance; serverless cold starts re-read
  upstream.
- Heatmap is UTC-bucketed on purpose (consistent for everyone, and testable);
  a visitor's local day may differ by one square near midnight.
