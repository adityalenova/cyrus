/* ══ model.ts — pure math for the API usage dashboard ════════════════════
   No React, no window, no fetch, no Date.now() inside the exported helpers
   (callers pass `now`). Everything here is deterministic so the unit tests
   cover exactly what renders.

   THE HONESTY CONTRACT (see README for the full story):
   The only API traffic this dashboard can *observe* is the same-origin
   requests this very browser makes. The server-side primitives that already
   exist in the repo — `apiMetrics` (src/lib/server/apiMetrics.ts) and the
   limiter singletons (`slidingRateLimiter`, `rateLimit`) — are either never
   recorded from (apiMetrics.record/getSummary are defined but no route calls
   them) or not exposed through any route, and our routes emit no
   `x-ratelimit-*` headers. So server "remaining now" and cross-user totals
   are NOT charted anywhere; they surface as explicit unavailable states.

   What IS real and computed here:
   - counts, statuses and latencies measured from the browser's own requests
     (the RequestRecord log persisted in localStorage by the client);
   - the CONFIGURED per-endpoint limits, which are static facts transcribed
     from the route source (ENDPOINT_LIMITS below) — never presented as live
     usage, always labelled "read from route source". */

export type Granularity = "hour" | "day" | "week";

/** One same-origin request this browser actually made, observed live. */
export interface RequestRecord {
  id: string;
  /** path the browser requested, e.g. "/api/health" */
  endpoint: string;
  /** HTTP method used, e.g. "GET" */
  method: string;
  /** real HTTP status code the server returned */
  status: number;
  /** response.ok (status in [200,300)) */
  ok: boolean;
  /** wall-clock milliseconds measured around the fetch in this browser */
  durationMs: number;
  /** epoch ms when the response completed */
  ts: number;
  /** a safe, allow-listed subset of real response headers we could read */
  headers: Record<string, string>;
}

/** A configured rate limit transcribed from the route source. This is a fact
    about the code, not a measurement of live traffic. */
export interface EndpointLimit {
  endpoint: string;
  method: string;
  windowMs: number;
  limit: number;
  /** "per-ip" = keyed on the client address; "shared-key" = one counter for
      the whole serverless instance regardless of who calls */
  scope: "per-ip" | "shared-key";
  /** where this was read from, so a reader can go verify it */
  source: string;
  /** does the route emit x-ratelimit-* style headers we could observe? */
  emitsRatelimitHeaders: boolean;
}

/* The endpoints that are actually guarded in the current source. The limit is
   what the code hard-codes; it is in-memory and per serverless instance, so it
   resets on a cold start and is not a distributed account quota. */
export const ENDPOINT_LIMITS: EndpointLimit[] = [
  {
    endpoint: "/api/reports",
    method: "POST",
    windowMs: 60_000,
    limit: 12,
    scope: "shared-key",
    source: "src/app/api/reports/route.ts:47 -> slidingRateLimiter.check(\"pdf-reports\", 12, 60_000)",
    emitsRatelimitHeaders: false,
  },
  {
    endpoint: "/api/issues",
    method: "GET",
    windowMs: 60_000,
    limit: 60,
    scope: "per-ip",
    source: "src/app/api/issues/route.ts:14-16 (WINDOW=60_000, LIMIT=60, local per-IP map)",
    emitsRatelimitHeaders: false,
  },
  {
    endpoint: "/api/submissions",
    method: "POST",
    windowMs: 600_000,
    limit: 6,
    scope: "per-ip",
    source: "src/app/api/submissions/route.ts:18-30 (WINDOW=600_000, 6 per IP)",
    emitsRatelimitHeaders: false,
  },
];

export function limitFor(endpoint: string, method: string): EndpointLimit | undefined {
  return ENDPOINT_LIMITS.find((l) => l.endpoint === endpoint && l.method === method);
}

/* Cheap, public, GET-only endpoints the dashboard may issue a real request to.
   Everything is read-only and returns 200 without a body or a sign-in, so
   probing cannot mutate state or leak another user's data. The component looks
   a path up here and refuses to fetch anything not on the list. */
export interface ProbeEndpoint {
  path: string;
  method: "GET";
  label: string;
  note: string;
}
export const PROBE_ENDPOINTS: ProbeEndpoint[] = [
  { path: "/api/health", method: "GET", label: "GET /api/health", note: "liveness + capability booleans; always 200, no auth" },
  { path: "/api/me", method: "GET", label: "GET /api/me", note: "reads the session cookie; returns { user: null } when signed out" },
  { path: "/api/catalog/counts", method: "GET", label: "GET /api/catalog/counts", note: "catalog row counts; 503 when the backend is offline" },
];

export function isProbeable(path: string): boolean {
  return PROBE_ENDPOINTS.some((p) => p.path === path);
}

export const endpointKey = (endpoint: string, method: string): string => `${method} ${endpoint}`;

/* ── threshold states ─────────────────────────────────────────────────── */
export type LimitState = "unknown" | "ok" | "approaching" | "reached";

/** A request is "approaching" its configured limit at 75% of the window. */
export const APPROACH_RATIO = 0.75;

export function limitState(count: number, limit: number | undefined): LimitState {
  if (!limit || limit <= 0) return "unknown";
  const ratio = count / limit;
  if (ratio >= 1) return "reached";
  if (ratio >= APPROACH_RATIO) return "approaching";
  return "ok";
}

/* How many of this browser's own recorded requests for an endpoint fall inside
   one trailing window, counted as of `now`. Because the shared limiter also
   counts everyone else on the instance, this is a LOWER BOUND on true usage. */
export function countInWindow(log: RequestRecord[], endpoint: string, method: string, windowMs: number, now: number): number {
  const start = now - windowMs;
  let n = 0;
  for (const r of log) {
    if (r.endpoint === endpoint && r.method === method && r.ts > start && r.ts <= now) n++;
  }
  return n;
}

/* ── latency percentiles (nearest-rank, matches apiMetrics' convention) ── */
export function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[Math.max(0, idx)];
}

/* ── totals ───────────────────────────────────────────────────────────── */
export interface UsageSummary {
  total: number;
  ok: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  from: number | null;
  to: number | null;
}

export function summarize(log: RequestRecord[]): UsageSummary {
  const total = log.length;
  if (total === 0) return { total: 0, ok: 0, errors: 0, errorRate: 0, avgMs: 0, from: null, to: null };
  let errors = 0;
  let dur = 0;
  let from = Infinity;
  let to = -Infinity;
  for (const r of log) {
    if (r.status >= 400) errors++;
    dur += r.durationMs;
    if (r.ts < from) from = r.ts;
    if (r.ts > to) to = r.ts;
  }
  return {
    total,
    ok: total - errors,
    errors,
    errorRate: +(errors / total).toFixed(4),
    avgMs: Math.round(dur / total),
    from,
    to,
  };
}

/* ── per-endpoint breakdown ───────────────────────────────────────────── */
export interface EndpointBreakdown {
  endpoint: string;
  method: string;
  count: number;
  errors: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  lastStatus: number;
  lastTs: number;
  configuredLimit?: EndpointLimit;
}

export function breakdownByEndpoint(log: RequestRecord[]): EndpointBreakdown[] {
  const groups = new Map<string, RequestRecord[]>();
  for (const r of log) {
    const k = endpointKey(r.endpoint, r.method);
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }
  const out: EndpointBreakdown[] = [];
  for (const records of groups.values()) {
    let errors = 0;
    let lastTs = -Infinity;
    let lastStatus = 0;
    const lats: number[] = [];
    for (const r of records) {
      if (r.status >= 400) errors++;
      lats.push(r.durationMs);
      if (r.ts > lastTs) { lastTs = r.ts; lastStatus = r.status; }
    }
    out.push({
      endpoint: records[0].endpoint,
      method: records[0].method,
      count: records.length,
      errors,
      errorRate: +(errors / records.length).toFixed(4),
      p50Ms: percentile(lats, 0.5),
      p95Ms: percentile(lats, 0.95),
      lastStatus,
      lastTs,
      configuredLimit: limitFor(records[0].endpoint, records[0].method),
    });
  }
  // most recent activity first, then busiest
  return out.sort((a, b) => b.lastTs - a.lastTs || b.count - a.count);
}

/* ── time bucketing (UTC, deterministic) ──────────────────────────────── */
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function bucketStart(ts: number, g: Granularity): number {
  const d = new Date(ts);
  if (g === "hour") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (g === "day") return day;
  // week: Monday 00:00 UTC. getUTCDay(): Sun=0..Sat=6 -> offset from Monday.
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  return day - mondayOffset * DAY;
}

function isoDay(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isoHour(ms: number): string {
  const d = new Date(ms);
  return `${isoDay(ms)} ${String(d.getUTCHours()).padStart(2, "0")}:00 UTC`;
}

export function bucketLabel(ms: number, g: Granularity): string {
  if (g === "hour") return isoHour(ms);
  if (g === "day") return isoDay(ms);
  return `week of ${isoDay(ms)}`;
}

export interface Bucket {
  start: number;
  label: string;
  count: number;
  errors: number;
  avgMs: number;
}

/** Groups records into contiguous buckets across the observed span, so a quiet
    hour/day still shows as a real zero rather than being skipped. */
export function bucketize(log: RequestRecord[], g: Granularity): Bucket[] {
  if (log.length === 0) return [];
  const step = g === "hour" ? HOUR : g === "day" ? DAY : 7 * DAY;
  const acc = new Map<number, { count: number; errors: number; dur: number }>();
  let min = Infinity;
  let max = -Infinity;
  for (const r of log) {
    const s = bucketStart(r.ts, g);
    if (s < min) min = s;
    if (s > max) max = s;
    const cur = acc.get(s) ?? { count: 0, errors: 0, dur: 0 };
    cur.count++;
    cur.dur += r.durationMs;
    if (r.status >= 400) cur.errors++;
    acc.set(s, cur);
  }
  const out: Bucket[] = [];
  for (let s = min; s <= max; s += step) {
    const b = acc.get(s);
    out.push({
      start: s,
      label: bucketLabel(s, g),
      count: b ? b.count : 0,
      errors: b ? b.errors : 0,
      avgMs: b && b.count ? Math.round(b.dur / b.count) : 0,
    });
  }
  return out;
}

/* ── CSV report ───────────────────────────────────────────────────────── */
export const CSV_COLUMNS = [
  "recorded_at_utc",
  "endpoint",
  "method",
  "http_status",
  "response_ok",
  "duration_ms",
  "provenance",
] as const;

/** One row per recorded request. Every row carries its own provenance so the
    file never reads as server-authoritative usage. */
export function toCsvMatrix(log: RequestRecord[]): string[][] {
  const rows: string[][] = [CSV_COLUMNS.map(String)];
  const ordered = [...log].sort((a, b) => a.ts - b.ts);
  for (const r of ordered) {
    rows.push([
      new Date(r.ts).toISOString(),
      r.endpoint,
      r.method,
      String(r.status),
      r.ok ? "true" : "false",
      String(r.durationMs),
      "recorded in this browser",
    ]);
  }
  return rows;
}

/** RFC-4180-ish quoting with CRLF line breaks. */
export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(log: RequestRecord[]): string {
  return toCsvMatrix(log).map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

/* ── live server metrics: what can and cannot be read here ────────────── */
/** The repo ships an in-memory metrics collector, but no route calls its
    record() method and no route exposes getSummary(). It cannot be read from
    the browser. This flag documents that; the UI turns it into an explicit
    unavailable state rather than a chart. */
export const SERVER_METRICS_WIRED = false;
export const SERVER_LIMITER_PARTIALLY_WIRED = true; // only /api/reports uses it
export const SERVER_EMITS_RATELIMIT_HEADERS = false; // no route emits x-ratelimit-*
export const API_KEY_LIFECYCLE_WIRED = false; // apiKeyManager has crypto only, no store/route
