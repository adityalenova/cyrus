/* ══ model.test.ts — the dashboard's math, on hand-written fixtures ═
   The page only ever renders what these functions return, so bucketing,
   threshold states, the per-endpoint breakdown and the CSV rows are checked
   against fixed timestamps where the expected numbers are obvious by hand.
   Node environment only: no window, no fetch, no React.  ═ */
import { describe, expect, it } from "vitest";
import {
  APPROACH_RATIO, CSV_COLUMNS, ENDPOINT_LIMITS, PROBE_ENDPOINTS,
  breakdownByEndpoint, bucketLabel, bucketStart, bucketize, countInWindow,
  csvEscape, isProbeable, limitFor, limitState, percentile, summarize, toCsv,
  toCsvMatrix, type RequestRecord,
} from "./model";

function rec(partial: Partial<RequestRecord> & { ts: number; endpoint: string }): RequestRecord {
  return {
    id: partial.endpoint + ":" + partial.ts,
    method: "GET",
    status: 200,
    ok: partial.status === undefined || partial.status < 400,
    durationMs: 10,
    headers: {},
    ...partial,
  };
}

describe("limitState thresholds", () => {
  it("has no state when an endpoint is not limited in code", () => {
    expect(limitState(5, undefined)).toBe("unknown");
    expect(limitState(0, 0)).toBe("unknown");
  });
  it("is ok below the approach ratio, approaching above it, reached at the cap", () => {
    const limit = 100;
    expect(limitState(Math.floor(limit * APPROACH_RATIO) - 1, limit)).toBe("ok");
    expect(limitState(Math.ceil(limit * APPROACH_RATIO), limit)).toBe("approaching");
    expect(limitState(limit - 1, limit)).toBe("approaching");
    expect(limitState(limit, limit)).toBe("reached");
    expect(limitState(limit + 7, limit)).toBe("reached");
  });
});

describe("countInWindow", () => {
  const now = 1_000_000_000_000;
  const window = 60_000;
  const log = [
    rec({ endpoint: "/api/issues", ts: now - 1000 }),
    rec({ endpoint: "/api/issues", ts: now - 30_000 }),
    rec({ endpoint: "/api/issues", ts: now - window - 1 }), // just outside
    rec({ endpoint: "/api/me", ts: now - 500 }),
  ];
  it("counts only this endpoint+method inside the trailing window", () => {
    expect(countInWindow(log, "/api/issues", "GET", window, now)).toBe(2);
    expect(countInWindow(log, "/api/me", "GET", window, now)).toBe(1);
    expect(countInWindow(log, "/api/issues", "POST", window, now)).toBe(0);
  });
  it("excludes the boundary instant (strictly after window start, at or before now)", () => {
    const edge = rec({ endpoint: "/api/issues", ts: now - window });
    expect(countInWindow([...log, edge], "/api/issues", "GET", window, now)).toBe(2);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty sample and clamps the nearest rank", () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([5], 0.95)).toBe(5);
    expect(percentile([30, 10, 20], 0.5)).toBe(20);
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
  });
});

describe("summarize", () => {
  it("returns a clean zero state for no requests", () => {
    expect(summarize([])).toEqual({ total: 0, ok: 0, errors: 0, errorRate: 0, avgMs: 0, from: null, to: null });
  });
  it("tallies ok vs errors, rounds average latency and records the span", () => {
    const log = [
      rec({ endpoint: "/api/health", ts: 100, status: 200, durationMs: 12 }),
      rec({ endpoint: "/api/health", ts: 300, status: 429, ok: false, durationMs: 8 }),
      rec({ endpoint: "/api/me", ts: 200, status: 500, ok: false, durationMs: 40 }),
    ];
    const s = summarize(log);
    expect(s.total).toBe(3);
    expect(s.errors).toBe(2);
    expect(s.ok).toBe(1);
    expect(s.errorRate).toBeCloseTo(2 / 3, 3);
    expect(s.avgMs).toBe(20);
    expect(s.from).toBe(100);
    expect(s.to).toBe(300);
  });
});

describe("breakdownByEndpoint", () => {
  it("groups by endpoint+method, computes latency percentiles and last status", () => {
    const log = [
      rec({ endpoint: "/api/health", ts: 100, durationMs: 10 }),
      rec({ endpoint: "/api/health", ts: 200, durationMs: 30 }),
      rec({ endpoint: "/api/health", ts: 50, durationMs: 20 }),
      rec({ endpoint: "/api/me", ts: 300, status: 503, ok: false, durationMs: 5 }),
    ];
    const rows = breakdownByEndpoint(log);
    expect(rows).toHaveLength(2);
    // most recent activity first: /api/me at ts 300
    expect(rows[0].endpoint).toBe("/api/me");
    expect(rows[0].errors).toBe(1);
    expect(rows[0].errorRate).toBe(1);
    expect(rows[1].endpoint).toBe("/api/health");
    expect(rows[1].count).toBe(3);
    expect(rows[1].p50Ms).toBe(20);
    expect(rows[1].lastStatus).toBe(200);
    expect(rows[1].lastTs).toBe(200);
  });
  it("attaches the configured limit from source for guarded endpoints", () => {
    const log = [rec({ endpoint: "/api/issues", ts: 1, method: "GET" })];
    const [row] = breakdownByEndpoint(log);
    expect(row.configuredLimit?.limit).toBe(60);
    expect(row.configuredLimit?.scope).toBe("per-ip");
  });
});

describe("bucketStart / bucketLabel (UTC)", () => {
  const ts = Date.UTC(2026, 10, 22, 14, 37, 12); // Sun 2026-11-22 14:37:12 UTC
  it("floors to the hour, day and week (Monday)", () => {
    expect(bucketStart(ts, "hour")).toBe(Date.UTC(2026, 10, 22, 14));
    expect(bucketStart(ts, "day")).toBe(Date.UTC(2026, 10, 22));
    // 2026-11-22 is a Sunday -> the Monday week start is 2026-11-16
    expect(bucketStart(ts, "week")).toBe(Date.UTC(2026, 10, 16));
  });
  it("labels each granularity", () => {
    expect(bucketLabel(bucketStart(ts, "hour"), "hour")).toBe("2026-11-22 14:00 UTC");
    expect(bucketLabel(bucketStart(ts, "day"), "day")).toBe("2026-11-22");
    expect(bucketLabel(bucketStart(ts, "week"), "week")).toBe("week of 2026-11-16");
  });
});

describe("bucketize", () => {
  it("returns [] with no data", () => {
    expect(bucketize([], "hour")).toEqual([]);
  });
  it("fills interior buckets with real zeros across the span", () => {
    const base = Date.UTC(2026, 10, 22, 10, 5);
    const log = [
      rec({ endpoint: "/api/health", ts: base }),
      rec({ endpoint: "/api/health", ts: base + 2 * 3_600_000 + 1000, status: 500, ok: false, durationMs: 50 }),
    ];
    const buckets = bucketize(log, "hour");
    expect(buckets).toHaveLength(3); // 10:00, 11:00 (empty), 12:00
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 1]);
    expect(buckets[1].label).toBe("2026-11-22 11:00 UTC");
    expect(buckets[2].errors).toBe(1);
    expect(buckets[2].avgMs).toBe(50);
    expect(buckets[1].avgMs).toBe(0);
  });
});

describe("CSV report", () => {
  it("emits a header row plus one row per request, sorted, all self-labelled", () => {
    const log = [
      rec({ endpoint: "/api/me", ts: 2000, status: 429, ok: false }),
      rec({ endpoint: "/api/health", ts: 1000, durationMs: 7 }),
    ];
    const matrix = toCsvMatrix(log);
    expect(matrix[0]).toEqual([...CSV_COLUMNS]);
    expect(matrix).toHaveLength(3);
    // chronological order
    expect(matrix[1][0]).toBe(new Date(1000).toISOString());
    expect(matrix[2][1]).toBe("/api/me");
    expect(matrix[2][3]).toBe("429");
    expect(matrix[2][6]).toBe("recorded in this browser");
  });
  it("quotes fields containing commas and escapes inner quotes", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape('a,"b"')).toBe('"a,""b"""');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });
  it("round-trips a full csv string with CRLF and a trailing newline", () => {
    const csv = toCsv([rec({ endpoint: "/api/health", ts: 0 })]);
    const lines = csv.split("\r\n");
    expect(lines[lines.length - 1]).toBe(""); // trailing newline
    expect(csv).toContain("recorded_at_utc");
  });
});

describe("transcribed facts vs probe allowlist", () => {
  it("keeps every configured limit's source pointer and header truth", () => {
    for (const l of ENDPOINT_LIMITS) {
      expect(l.source.length).toBeGreaterThan(0);
      expect(l.limit).toBeGreaterThan(0);
      expect(l.emitsRatelimitHeaders).toBe(false); // no route emits x-ratelimit-*
    }
    expect(limitFor("/api/reports", "POST")?.scope).toBe("shared-key");
    expect(limitFor("/api/health", "GET")).toBeUndefined();
  });
  it("only allows cheap public GET probes", () => {
    expect(PROBE_ENDPOINTS.every((p) => p.method === "GET")).toBe(true);
    expect(isProbeable("/api/health")).toBe(true);
    expect(isProbeable("/api/reports")).toBe(false); // POST / mutates + generates PDF
    expect(isProbeable("/api/me/saved")).toBe(false);
  });
});
