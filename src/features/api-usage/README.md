# #191 — API usage dashboard with rate-limit visualization

**Issue:** https://github.com/adityalenova/cyrus/issues/191
**Level:** 3 · **Route:** `/platform/api-usage`

## Problem

The issue asks for an admin-style API console: current rate-limit status per endpoint,
usage over time (hourly/daily/weekly), alert thresholds approaching limits, API key
management (generate/revoke/rotate), usage breakdown by endpoint, and downloadable
usage reports. Its tech notes assume Postgres + WebSockets.

That data contract is **unsettled upstream**, and this app has no way to observe most of
it. The hard rule this feature is built under: **never present generated or sample traffic
as real API usage; if the app cannot observe a number, do not chart it — show an explicit
empty / unavailable state that says why.** So this dashboard is built only on data that
genuinely exists, with the provenance of every figure named on screen.

## What the existing code actually provides (found & reused, not reinvented)

The previous contributor was right that the primitives exist. Their real wiring:

| Primitive | File | Wired to live requests? | Readable from the browser? |
|---|---|---|---|
| `rateLimit()` in-memory sliding window | `src/lib/rateLimit.ts` | **No** — imported by no route (dead code) | No |
| `slidingRateLimiter` singleton | `src/lib/server/slidingRateLimit.ts` | **Partly** — only `POST /api/reports` (shared key `pdf-reports`, 12 / 60s) | No — no route exposes its counters |
| `ApiMetricsCollector` (`apiMetrics.record/getSummary`) | `src/lib/server/apiMetrics.ts` | **No** — `record()` is never called by any route handler | No — and would be in-memory per serverless instance, resetting on cold start |
| `generateApiKey/hashApiKey/verifyApiKey` | `src/lib/server/apiKeyManager.ts` | **No** — crypto only; no key store, table, route, or auth path uses it | n/a |

Ad-hoc per-IP limiters are also inline in `GET /api/issues` (60 / 60s) and
`POST /api/submissions` (6 / 10min). Authentication is a stateless httpOnly JWT session
cookie (`src/lib/server/auth.ts`), not API keys.

**No route emits `x-ratelimit-*` response headers**, and none exposes the limiter/metrics
store to the client. Therefore the server's live "remaining now" and any cross-user totals
are **not observable** from a browser — and are surfaced as explicit unavailable states.

## What was built

- **`model.ts`** — pure, deterministic (no `Date.now()` inside the exports; callers pass `now`):
  hourly / daily / weekly bucketing (UTC, with real interior zeros), threshold states
  (`ok` / `approaching` @75% / `reached`), trailing-window counts, per-endpoint breakdown
  with nearest-rank p50/p95 latency, totals, and CSV rows. It also holds the two single
  sources of truth: `ENDPOINT_LIMITS` (configured limits transcribed from route source, each
  with a `file:line` pointer) and `PROBE_ENDPOINTS` (the safe allow-list).
- **`BarChart.tsx`** — hand-rolled SVG column chart (no chart library). Every bar has a
  `<title>`, the SVG is `role="img"` with a summary label, and the identical numbers are
  always rendered as a real `<table>` — the required text alternative.
- **`ApiUsageDashboard.tsx`** — `"use client"` page body wired to `Card`/`btn`/`Chip`,
  `Link` from `@/lib/router`, and `useSearchParams()` (the tuple form) to persist the
  bucket size in the URL. localStorage (`useStored`) holds the per-browser request log.
- **`src/app/platform/api-usage/page.tsx`** — server component exporting `metadata` with
  `alternates.canonical = canonical("/platform/api-usage")`.
- **`model.test.ts`** — vitest, node environment, relative imports; covers bucketing,
  thresholds, window counting, breakdown, CSV and the transcribed-facts/allow-list.

## Exactly what is real vs not yet wired

**Real (genuinely observed):**
- **Per-browser request log.** The "Send request" control issues one real same-origin GET
  to a cheap, public, read-only endpoint (`/api/health`, `/api/me`, `/api/catalog/counts` —
  hard allow-list, refused otherwise), records the **actual HTTP status** and **wall-clock
  latency**, plus any real response headers from an allow-list (`retry-after`, etc.).
  Usage-over-time, breakdown-by-endpoint, error rate and the CSV export are computed from
  this log. Provenance is labelled "recorded in this browser" everywhere, including inside
  each CSV row.
- **Threshold alerts** are honest two ways: a real HTTP 4xx/5xx the browser just received,
  and a per-endpoint this-browser window count vs the configured limit (a lower bound, since
  the shared limiter also counts everyone else).
- **Configured limits** are labelled "read from route source" and link to the file/line.

**Not wired / deliberately not faked (shown as unavailable):**
- **Server "remaining now" per endpoint** — `Chip: not observable`. No route emits
  `x-ratelimit-*` and none exposes the limiter store.
- **Cross-user / whole-service usage over time** — only this browser's traffic is visible.
- **API key generate / revoke / rotate** — **no manager is built.** The lifecycle does not
  exist end-to-end (`API_KEY_LIFECYCLE_WIRED = false`); the page states this plainly rather
  than shipping a fake key console. The `apiKeyManager` crypto helpers are named and reused
  only as documentation of what exists.
- **The authentication boundary is untouched.** No new auth, session, or admin-permission
  model was added; the page is public like the other `/platform/*` pages.

## What a follow-up PR must do to make the Postgres / WebSocket parts real

This dashboard is the honest UI layer; it is ready to consume real aggregates without
changing its provenance rules:

1. **Wire the metrics collector.** Call `apiMetrics.record(route, status, durationMs)` in a
   single instrumentation seam (Next `middleware` or a shared route wrapper) so every API
   route feeds it — and add `export` of `apiMetrics.getSummary()`. In-memory means per
   instance + cold-start loss; that limitation must still be shown.
2. **Persist aggregates in Postgres.** Introduce a `api_usage` table (endpoint, method,
   minute bucket, count, errors, latency histogram) and a periodic flush from the in-memory
   store (or write-through), so usage-over-time and per-endpoint totals survive restarts and
   span all users. Replace the per-browser fallback with this server data, labelled
   "measured server-side".
3. **Emit `x-ratelimit-limit` / `-remaining` / `-reset`** from the limiter-middleware on every
   guarded route, so the browser can read true "remaining now" and the unavailable chips
   become real charts.
4. **Distributed limiter.** Back `slidingRateLimiter` with Postgres/Redis instead of the
   per-process `Map` so the 12/60s and 60/60s numbers are account-scoped, not instance-scoped.
5. **API keys end-to-end.** Add a `api_keys` table (hashed key via `apiKeyManager`, prefix,
   owner, status, created/revoked/rotated timestamps) plus authenticated admin routes for
   generate/revoke/rotate behind the existing permission model, then surface them read-mostly
   here. Until routes + storage + a permission check exist, this page keeps saying "not wired".
6. **WebSocket live updates.** Replace the "Send request / Re-measure window" pull model with
   a `/notifications/stream`-style subscription that pushes new server aggregates; the UI
   already separates "as of {time}" snapshots so a live feed can drop in.

## Verification

- `node ../../node_modules/typescript/bin/tsc --noEmit` → exit 0
- `node ../../node_modules/vitest/vitest.mjs run src/features/api-usage` → all green
