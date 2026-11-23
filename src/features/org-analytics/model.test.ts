/* ══ model.test.ts — the dashboard's arithmetic ════════════════════
   Issue #187. Two things must never be invented: a time series (it is
   bucketed from stored timestamps only) and a snapshot trend (there is no
   function here that could draw one). These tests pin the bucketing, the
   comparison, the CSV shapes, the snapshot aggregation and the empty-state
   selection to hand-countable fixtures.                                ═ */
import { describe, expect, it } from "vitest";
import {
  bucketEvents, beginnerShare, collectEvents, cumulativeSeries, elapsedLabel, eventsFromLedger,
  eventsFromSearches, historyStart, historyState, instantOf, languageMix, lastEvent, nameCounts,
  orgAggregates, orgCsvRows, parseRecorded, percent, periodComparison, previousWindowDays,
  repoAggregates, repoCsvRows, seriesCsvRows, utcDay, windowDays,
  type RangeDays, type RecordedEvent, type SnapshotIssue,
} from "./model";

const NOW = new Date("2026-11-22T12:00:00Z");

const ev = (id: string, at: string, source: RecordedEvent["source"] = "tracker", name = "test.event"): RecordedEvent =>
  ({ id, name, at, source });

/* one event today, one yesterday, one inside the previous 7-day window,
   and one far outside any window this page offers */
const EVENTS: RecordedEvent[] = [
  ev("a", "2026-11-22T09:00:00Z"),
  ev("b", "2026-11-21T09:00:00Z"),
  ev("c", "2026-11-12T09:00:00Z"),
  ev("d", "2026-01-01T09:00:00Z"),
];

describe("windows", () => {
  it("builds inclusive UTC windows ending today, oldest first", () => {
    expect(windowDays(7, NOW)).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
    expect(windowDays(30, NOW)).toHaveLength(30);
    expect(windowDays(90, NOW)[0]).toBe("2026-08-25");
  });

  it("puts the previous window immediately before the current one", () => {
    const prev = previousWindowDays(7, NOW);
    expect(prev[0]).toBe("2026-11-09");
    expect(prev[6]).toBe("2026-11-15");
    expect(prev.some((d) => windowDays(7, NOW).includes(d))).toBe(false);
  });
});

describe("bucketEvents", () => {
  it("counts only events inside the window and keeps zero days", () => {
    const buckets = bucketEvents(EVENTS, 7, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets.find((b) => b.day === "2026-11-22")!.count).toBe(1);
    expect(buckets.find((b) => b.day === "2026-11-21")!.count).toBe(1);
    expect(buckets.find((b) => b.day === "2026-11-20")!.count).toBe(0);
    /* the 1 January event is outside the window: not moved, not counted */
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(2);
  });

  it("buckets an offset timestamp in UTC, not in its own zone", () => {
    /* 23:30 on the 20th in UTC-5 is 04:30 on the 21st in UTC */
    const rows = bucketEvents([ev("tz", "2026-11-20T23:30:00-05:00")], 7, NOW);
    expect(rows.find((b) => b.count === 1)!.day).toBe("2026-11-21");
    expect(utcDay(new Date("2026-11-20T23:30:00-05:00"))).toBe("2026-11-21");
  });

  it("keeps a day-anchored ledger row on its own day", () => {
    const ledger = eventsFromLedger(JSON.stringify({
      "https://github.com/a/b/issues/1": { stage: "saved", added: "2026-11-18" },
    }));
    const buckets = bucketEvents(ledger, 7, NOW);
    expect(buckets.find((b) => b.count === 1)!.day).toBe("2026-11-18");
  });

  it("ignores rows with an unreadable timestamp", () => {
    expect(bucketEvents([ev("bad", "not-a-date")], 7, NOW).every((b) => b.count === 0)).toBe(true);
  });
});

describe("periodComparison", () => {
  it("counts both windows and reports the change", () => {
    const c = periodComparison(EVENTS, 7, NOW);
    expect(c.current).toBe(2);       /* 22nd, 21st */
    expect(c.previous).toBe(1);      /* 12th */
    expect(c.delta).toBe(1);
    expect(c.pct).toBe(100);
  });

  it("does not divide by zero when the previous window is empty", () => {
    const c = periodComparison([ev("x", "2026-11-22T09:00:00Z")], 7, NOW);
    expect(c.previous).toBe(0);
    expect(c.pct).toBeNull();
    expect(c.delta).toBe(1);
  });

  it("reports a negative delta as negative", () => {
    const c = periodComparison([ev("x", "2026-11-12T09:00:00Z")], 7, NOW);
    expect(c.current).toBe(0);
    expect(c.previous).toBe(1);
    expect(c.delta).toBe(-1);
    expect(c.pct).toBe(-100);
  });

  it("rounds the percentage to one decimal", () => {
    const rows = [
      ev("p1", "2026-11-11T09:00:00Z"), ev("p2", "2026-11-10T09:00:00Z"), ev("p3", "2026-11-09T09:00:00Z"),
      ev("c1", "2026-11-22T09:00:00Z"), ev("c2", "2026-11-21T09:00:00Z"),
    ];
    /* 2 vs 3 -> -33.333...% -> -33.3 */
    expect(periodComparison(rows, 7, NOW).pct).toBe(-33.3);
  });
});

describe("cumulativeSeries", () => {
  it("accumulates this window and the one before, aligned by day number", () => {
    const series = cumulativeSeries(EVENTS, 7, NOW);
    expect(series).toHaveLength(7);
    expect(series[series.length - 1]).toEqual({ day: "2026-11-22", current: 2, previous: 1 });
    /* running totals never decrease */
    for (let i = 1; i < series.length; i++) {
      expect(series[i].current).toBeGreaterThanOrEqual(series[i - 1].current);
      expect(series[i].previous).toBeGreaterThanOrEqual(series[i - 1].previous);
    }
  });
});

describe("live line and history state", () => {
  it("reports the newest event and its age in seconds", () => {
    const last = lastEvent(EVENTS, NOW);
    expect(last.at).toBe("2026-11-22T09:00:00.000Z");
    expect(last.seconds).toBe(3 * 3600);
    expect(lastEvent([], NOW)).toEqual({ at: null, seconds: null });
  });

  it("formats an elapsed time compactly", () => {
    expect(elapsedLabel(null)).toBe("no event recorded yet");
    expect(elapsedLabel(9)).toBe("9s");
    expect(elapsedLabel(90)).toBe("1m");
    expect(elapsedLabel(3 * 3600)).toBe("3h");
    expect(elapsedLabel(50 * 3600)).toBe("2d");
  });

  it("chooses the empty state from what is actually stored", () => {
    expect(historyState([], 7, NOW)).toBe("no-history");
    expect(historyState([ev("old", "2026-01-01T09:00:00Z")], 7, NOW)).toBe("no-events-in-range");
    expect(historyState(EVENTS, 7, NOW)).toBe("ready");
    /* history outside the short window still shows under the long one */
    expect(historyState([ev("old", "2026-10-01T09:00:00Z")], 90, NOW)).toBe("ready");
  });

  it("dates the history from its earliest row", () => {
    expect(historyStart(EVENTS)).toBe("2026-01-01T09:00:00.000Z");
    expect(historyStart([])).toBeNull();
  });

  it("counts event names, largest first then alphabetically", () => {
    expect(nameCounts([
      ev("1", "2026-11-20T09:00:00Z", "tracker", "issue.saved"),
      ev("2", "2026-11-20T10:00:00Z", "tracker", "issue.saved"),
      ev("3", "2026-11-20T11:00:00Z", "ledger", "search.saved"),
    ])).toEqual([{ name: "issue.saved", count: 2 }, { name: "search.saved", count: 1 }]);
  });
});

describe("store parsing", () => {
  it("reads recorder rows and drops anything malformed", () => {
    const raw = JSON.stringify([
      { name: "issue.saved", at: "2026-11-20T09:00:00Z" },
      { name: "legacy.ms", time: 1_763_000_000_000 },
      { name: "", at: "2026-11-20T09:00:00Z" },
      { name: "no.timestamp" },
      null,
      "not an object",
    ]);
    const rows = parseRecorded(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "issue.saved", source: "tracker" });
    expect(rows[1].name).toBe("legacy.ms");
    expect(parseRecorded("{not json")).toEqual([]);
    expect(parseRecorded(null)).toEqual([]);
  });

  it("turns ledger entries into one event per issue, named by stage", () => {
    const raw = JSON.stringify({
      "https://github.com/a/b/issues/1": { stage: "saved", added: "2026-11-18" },
      "https://github.com/a/b/issues/2": { stage: "applied", added: "2026-11-19" },
      "https://github.com/a/b/issues/3": { stage: "saved", added: "" },
      "https://github.com/a/b/issues/4": { stage: "saved" },
    });
    const rows = eventsFromLedger(raw);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name).sort()).toEqual(["issue.applied", "issue.saved"]);
    expect(rows.every((r) => r.at.endsWith("T12:00:00.000Z"))).toBe(true);
    expect(rows[0].id.startsWith("ledger:https://github.com/")).toBe(true);
    expect(eventsFromLedger("[]")).toEqual([]);
  });

  it("turns saved searches into search.saved events", () => {
    const raw = JSON.stringify({
      s1: { name: "Rust beginner", added: "2026-11-10", filters: { q: "rust" } },
      s2: { name: "Broken", added: "yesterday" },
    });
    const rows = eventsFromSearches(raw);
    expect(rows).toEqual([{ id: "search:s1", name: "search.saved", at: "2026-11-10T12:00:00.000Z", source: "search" }]);
  });

  it("merges the three stores newest first without duplicates", () => {
    const rows = collectEvents({
      recorded: JSON.stringify([{ name: "tracker.one", at: "2026-11-20T09:00:00Z" }]),
      ledger: JSON.stringify({ "https://github.com/a/b/issues/1": { stage: "saved", added: "2026-11-21" } }),
      searches: JSON.stringify({ s1: { added: "2026-11-19" } }),
    });
    expect(rows.map((r) => r.source)).toEqual(["ledger", "tracker", "search"]);
    expect(collectEvents({})).toEqual([]);
  });

  it("accepts ISO strings and epoch milliseconds as instants", () => {
    expect(instantOf("2026-11-22T00:00:00Z")).toBe(Date.parse("2026-11-22T00:00:00Z"));
    expect(instantOf(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(instantOf("")).toBeNull();
    expect(instantOf(NaN)).toBeNull();
    expect(instantOf({})).toBeNull();
  });
});

/* ── crawl snapshot ───────────────────────────────────────── */

const issue = (partial: Partial<SnapshotIssue> & { repo: string }): SnapshotIssue => ({
  title: "t", url: "https://github.com/x/y/issues/1", number: 1, stars: 10,
  lang: "TypeScript", labels: ["good first issue"], updated: "2026-10-20", beginner: true,
  ...partial,
});

const SNAPSHOT: SnapshotIssue[] = [
  issue({ repo: "acme/widgets", number: 1 }),
  issue({ repo: "acme/widgets", number: 2, lang: "Go" }),
  issue({ repo: "acme/gadgets", number: 3, lang: "Go", beginner: false }),
  issue({ repo: "other/tool", number: 4, lang: null, beginner: false }),
];

describe("snapshot aggregation", () => {
  it("counts organisations by distinct repositories, issues, languages and beginners", () => {
    const orgs = orgAggregates(SNAPSHOT);
    expect(orgs).toHaveLength(2);
    expect(orgs[0]).toEqual({
      org: "acme", repos: 2, issues: 3, beginner: 2,
      beginnerShare: 2 / 3, languages: ["Go", "TypeScript"],
    });
    expect(orgs[1]).toMatchObject({ org: "other", repos: 1, issues: 1, beginner: 0, beginnerShare: 0 });
  });

  it("sorts organisations by issue count, then name", () => {
    expect(orgAggregates([
      issue({ repo: "b/one" }), issue({ repo: "a/two" }),
    ]).map((o) => o.org)).toEqual(["a", "b"]);
  });

  it("aggregates at repository level with the repo's language", () => {
    const repos = repoAggregates(SNAPSHOT);
    expect(repos[0]).toEqual({ repo: "acme/widgets", org: "acme", issues: 2, lang: "TypeScript", beginner: 2 });
    expect(repos.find((r) => r.repo === "other/tool")!.lang).toBe("—");
  });

  it("mixes languages, largest first, collecting missing ones under a dash", () => {
    /* ties are broken by name, so the em dash for "no language" lands
       before the named languages on the same count */
    expect(languageMix(SNAPSHOT)).toEqual([
      { lang: "Go", issues: 2 },
      { lang: "—", issues: 1 },
      { lang: "TypeScript", issues: 1 },
    ]);
  });

  it("computes the beginner share, and admits when there is nothing to divide", () => {
    expect(beginnerShare(SNAPSHOT)).toBe(0.5);
    expect(beginnerShare([])).toBeNull();
    expect(percent(0.5)).toBe("50.0%");
    expect(percent(0)).toBe("0.0%");
    expect(percent(null)).toBe("—");
  });

  it("never produces a time series from the snapshot", () => {
    /* the module deliberately has no snapshot->series function; the only
       date it exposes is the crawl date, so a caller cannot bucket it */
    const keys = Object.keys(orgAggregates(SNAPSHOT)[0]);
    expect(keys).not.toContain("updated");
    expect(keys).not.toContain("at");
  });
});

describe("CSV shapes", () => {
  it("exports one row per day, zero days included", () => {
    const rows = seriesCsvRows(bucketEvents(EVENTS, 7, NOW));
    expect(rows).toHaveLength(7);
    expect(rows).toEqual([
      { day: "2026-11-16", events: 0 },
      { day: "2026-11-17", events: 0 },
      { day: "2026-11-18", events: 0 },
      { day: "2026-11-19", events: 0 },
      { day: "2026-11-20", events: 0 },
      { day: "2026-11-21", events: 1 },
      { day: "2026-11-22", events: 1 },
    ]);
  });

  it("exports the organisation table as the visible columns", () => {
    expect(orgCsvRows(orgAggregates(SNAPSHOT))[0]).toEqual({
      organisation: "acme", repositories: 2, openIssues: 3,
      beginnerLabelled: 2, beginnerShare: "67%", languages: "Go TypeScript",
    });
  });

  it("exports the repository table as the visible columns", () => {
    expect(repoCsvRows(repoAggregates(SNAPSHOT))[0]).toEqual({
      repository: "acme/widgets", organisation: "acme", openIssues: 2,
      language: "TypeScript", beginnerLabelled: 2,
    });
  });
});

describe("range typing", () => {
  it("only offers the three ranges the selector shows", () => {
    const ranges: RangeDays[] = [7, 30, 90];
    for (const r of ranges) expect(windowDays(r, NOW)).toHaveLength(r);
  });
});
