/* ══ model.test.ts — the feed's pure half ═════════════════════════════
   Issue #190. Everything the client feed draws passes through these
   functions: the event mapper, the 90-day heatmap, the type filter and
   the status→state table. Fixtures are trimmed copies of real GitHub
   event payloads (Events API v2022-11-28), not invented rows.          ═ */
import { describe, expect, it } from "vitest";
import {
  LOGIN_RE, age, dayKey, filterEvents, heatWeeks, heatmap, isValidLogin,
  kindCounts, levelOf, mapEvent, mapEvents, sortNewestFirst, stateForStatus,
  summary, type FeedEvent,
} from "./model";

/* one raw event per type the issue names */
const RAW = {
  push: {
    id: "1", type: "PushEvent", created_at: "2026-11-20T10:00:00Z",
    repo: { name: "acme/widgets" },
    payload: {
      size: 2, ref: "refs/heads/main",
      before: "1111111111111111111111111111111111111111",
      head: "2222222222222222222222222222222222222222",
      commits: [{ message: "fix: stop the flaky retry\n\nlong body" }],
    },
  },
  pullRequest: {
    id: "2", type: "PullRequestEvent", created_at: "2026-11-19T09:00:00Z",
    repo: { name: "acme/widgets" },
    payload: {
      action: "opened",
      pull_request: { number: 41, title: "Add retry budget", html_url: "https://github.com/acme/widgets/pull/41", state: "open" },
    },
  },
  issues: {
    id: "3", type: "IssuesEvent", created_at: "2026-11-18T08:00:00Z",
    repo: { name: "acme/widgets" },
    payload: {
      action: "closed",
      issue: { number: 12, title: "Docs build fails", html_url: "https://github.com/acme/widgets/issues/12", state: "closed" },
    },
  },
  review: {
    id: "4", type: "PullRequestReviewEvent", created_at: "2026-11-17T07:00:00Z",
    repo: { name: "acme/widgets" },
    payload: {
      review: { state: "approved", html_url: "https://github.com/acme/widgets/pull/41#pullrequestreview-9" },
      pull_request: { number: 41 },
    },
  },
  star: {
    id: "5", type: "WatchEvent", created_at: "2026-11-16T06:00:00Z",
    repo: { name: "other/lib" }, payload: { action: "started" },
  },
  fork: {
    id: "6", type: "ForkEvent", created_at: "2026-11-15T05:00:00Z",
    repo: { name: "other/lib" },
    payload: { forkee: { full_name: "someone/lib", html_url: "https://github.com/someone/lib" } },
  },
  create: {
    id: "7", type: "CreateEvent", created_at: "2026-11-14T04:00:00Z",
    repo: { name: "acme/widgets" },
    payload: { ref: "feat/retry", ref_type: "branch" },
  },
} as const;

describe("mapEvent", () => {
  it("maps a push to its head commit, with a compare link when both shas are real", () => {
    const e = mapEvent(RAW.push)!;
    expect(e.kind).toBe("push");
    expect(e.repo).toBe("acme/widgets");
    expect(e.title).toBe("fix: stop the flaky retry (+1 more)");
    expect(e.url).toContain("/compare/1111111");
    expect(e.time).toBe("2026-11-20T10:00:00Z");
  });

  it("does not build a compare link from the all-zero initial sha", () => {
    const e = mapEvent({
      ...RAW.push, id: "8", payload: { ...RAW.push.payload, before: "0".repeat(40) },
    })!;
    expect(e.url).toBe("https://github.com/acme/widgets");
  });

  it("maps a pull request with its action, number and html_url", () => {
    const e = mapEvent(RAW.pullRequest)!;
    expect(e.kind).toBe("pr");
    expect(e.title).toBe("opened pull request: Add retry budget");
    expect(e.url).toBe("https://github.com/acme/widgets/pull/41");
  });

  it("maps an issue event", () => {
    const e = mapEvent(RAW.issues)!;
    expect(e.kind).toBe("issue");
    expect(e.title).toBe("closed issue: Docs build fails");
    expect(e.url).toBe("https://github.com/acme/widgets/issues/12");
  });

  it("maps a pull request review", () => {
    const e = mapEvent(RAW.review)!;
    expect(e.kind).toBe("review");
    expect(e.title).toBe("reviewed pull request #41 (approved)");
    expect(e.url).toContain("#pullrequestreview-9");
  });

  it("maps a star to the repository", () => {
    const e = mapEvent(RAW.star)!;
    expect(e.kind).toBe("star");
    expect(e.title).toBe("starred other/lib");
    expect(e.url).toBe("https://github.com/other/lib");
  });

  it("maps a fork to the new fork, not the upstream repo", () => {
    const e = mapEvent(RAW.fork)!;
    expect(e.kind).toBe("fork");
    expect(e.title).toBe("forked other/lib to someone/lib");
    expect(e.url).toBe("https://github.com/someone/lib");
  });

  it("maps a branch creation and links to the branch", () => {
    const e = mapEvent(RAW.create)!;
    expect(e.kind).toBe("create");
    expect(e.title).toBe("created branch feat/retry");
    expect(e.url).toBe("https://github.com/acme/widgets/tree/feat%2Fretry");
  });

  it("names an unknown event type rather than dropping it", () => {
    const e = mapEvent({ id: "9", type: "SponsorshipEvent", created_at: "2026-11-01T00:00:00Z", repo: { name: "a/b" } })!;
    expect(e.kind).toBe("other");
    expect(e.title).toBe("Sponsorship on a/b");
  });

  it("returns null for rows with no event type", () => {
    expect(mapEvent(null)).toBeNull();
    expect(mapEvent({})).toBeNull();
    expect(mapEvent([])).toBeNull();
  });
});

describe("mapEvents", () => {
  it("drops unusable rows and sorts newest first", () => {
    const rows = mapEvents(Object.values(RAW));
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.kind)).toEqual(["push", "pr", "issue", "review", "star", "fork", "create"]);
    expect(rows[0].time > rows[6].time).toBe(true);
  });

  it("returns an empty list for a non-array body", () => {
    expect(mapEvents(null)).toEqual([]);
    expect(mapEvents({ message: "Not Found" })).toEqual([]);
  });

  it("sorts rows with a missing timestamp last", () => {
    const a: FeedEvent = { id: "a", kind: "push", type: "PushEvent", repo: "x/y", title: "a", url: "", time: "" };
    const b: FeedEvent = { id: "b", kind: "star", type: "WatchEvent", repo: "x/y", title: "b", url: "", time: "2026-01-01T00:00:00Z" };
    expect(sortNewestFirst([a, b]).map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("heatmap", () => {
  const now = new Date("2026-11-22T12:00:00Z");

  it("buckets by UTC day and pads the window to exactly 90 cells", () => {
    const cells = heatmap(mapEvents(Object.values(RAW)), { now, days: 90 }).cells;
    expect(cells).toHaveLength(90);
    expect(cells[89].day).toBe("2026-11-22");
    expect(cells[0].day).toBe("2026-08-25");
    const total = cells.reduce((n, c) => n + c.count, 0);
    expect(total).toBe(7);
  });

  it("keeps an offset timestamp in the UTC day it actually happened", () => {
    /* 23:30 on the 22nd in UTC-5 is 04:30 on the 23rd in UTC */
    const late = mapEvent({
      id: "tz", type: "PushEvent", created_at: "2026-11-22T23:30:00-05:00",
      repo: { name: "a/b" }, payload: { commits: [{ message: "late" }] },
    })!;
    /* the clock is the 23rd in UTC, so the event is inside the window */
    const utcNextDay = new Date("2026-11-23T12:00:00Z");
    const { cells } = heatmap([late], { now: utcNextDay, days: 90 });
    const hit = cells.find((c) => c.count === 1)!;
    expect(hit.day).toBe("2026-11-23");
    expect(dayKey(new Date(late.time))).toBe("2026-11-23");
    /* read from the 22nd's clock it is tomorrow's event, not today's */
    expect(heatmap([late], { now, days: 90 }).total).toBe(0);
  });

  it("puts an event one second before UTC midnight on the earlier day", () => {
    const before = mapEvent({
      id: "edge", type: "WatchEvent", created_at: "2026-11-21T23:59:59Z", repo: { name: "a/b" }, payload: {},
    })!;
    const { cells } = heatmap([before], { now, days: 90 });
    expect(cells.find((c) => c.count > 0)!.day).toBe("2026-11-21");
  });

  it("does not move an event outside the window into it", () => {
    const old = mapEvent({
      id: "old", type: "WatchEvent", created_at: "2026-06-01T10:00:00Z", repo: { name: "a/b" }, payload: {},
    })!;
    const { total, max } = heatmap([old], { now, days: 90 });
    expect(total).toBe(0);
    expect(max).toBe(0);
  });

  it("ignores unparseable timestamps instead of counting them today", () => {
    const row: FeedEvent = { id: "x", kind: "push", type: "PushEvent", repo: "a/b", title: "x", url: "", time: "not-a-date" };
    expect(heatmap([row], { now, days: 7 }).total).toBe(0);
  });

  it("stretches the five-step scale over a small feed", () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(1)).toBe(1);
    expect(levelOf(3)).toBe(2);
    expect(levelOf(7)).toBe(3);
    expect(levelOf(30)).toBe(4);
  });

  it("starts the first week column on the weekday of the first cell", () => {
    const cells = heatmap([], { now, days: 14 }).cells;
    const weeks = heatWeeks(cells);
    expect(weeks).toHaveLength(3);
    const firstDay = new Date(`${cells[0].day}T00:00:00Z`).getUTCDay();
    expect(weeks[0].slice(0, firstDay).every((c) => c === null)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(14);
  });
});

describe("filterEvents / kindCounts", () => {
  const rows = mapEvents(Object.values(RAW));

  it("filters to one kind, and 'all' is the whole list", () => {
    expect(filterEvents(rows, { kind: "pr" }).map((r) => r.kind)).toEqual(["pr"]);
    expect(filterEvents(rows, { kind: "all" })).toHaveLength(rows.length);
  });

  it("searches repository and title case-insensitively", () => {
    expect(filterEvents(rows, { kind: "all", q: "WIDGETS" })).toHaveLength(5);
    expect(filterEvents(rows, { kind: "all", q: "retry budget" }).map((r) => r.kind)).toEqual(["pr"]);
    expect(filterEvents(rows, { kind: "all", q: "nothing-matches" })).toEqual([]);
  });

  it("counts only the kinds present, in the declared order", () => {
    expect(kindCounts(rows)).toEqual([
      { kind: "push", count: 1 },
      { kind: "pr", count: 1 },
      { kind: "issue", count: 1 },
      { kind: "review", count: 1 },
      { kind: "create", count: 1 },
      { kind: "star", count: 1 },
      { kind: "fork", count: 1 },
    ]);
    expect(kindCounts([])).toEqual([]);
  });

  it("names the top three kinds in the summary line", () => {
    const many = [...rows, ...rows.filter((r) => r.kind === "push"), ...rows.filter((r) => r.kind === "push")];
    expect(summary(many)).toBe("3 pushes, 1 pull requests, 1 issues");
    expect(summary([])).toBe("no public events to show");
  });
});

describe("stateForStatus", () => {
  it("maps each status the route can answer with", () => {
    expect(stateForStatus(200)).toBe("ok");
    expect(stateForStatus(400)).toBe("invalid");
    expect(stateForStatus(404)).toBe("not-found");
    expect(stateForStatus(403)).toBe("rate-limited");
    expect(stateForStatus(429)).toBe("rate-limited");
    expect(stateForStatus(500)).toBe("error");
    expect(stateForStatus(502)).toBe("error");
  });

  it("never reads a throttle as an empty feed", () => {
    expect(stateForStatus(403)).not.toBe("ok");
  });
});

describe("login validation and age", () => {
  it("accepts GitHub's rule and rejects the rest", () => {
    expect(isValidLogin("torvalds")).toBe(true);
    expect(isValidLogin("a")).toBe(true);
    expect(isValidLogin("some-user-1")).toBe(true);
    expect(isValidLogin("-leading")).toBe(false);
    expect(isValidLogin("trailing-")).toBe(false);
    expect(isValidLogin("two--hyphens")).toBe(true);
    expect(isValidLogin("has space")).toBe(false);
    expect(isValidLogin("a".repeat(40))).toBe(false);
    expect(isValidLogin("")).toBe(false);
    expect(LOGIN_RE.test("../etc")).toBe(false);
  });

  it("formats age without ever going negative", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(age("2026-11-22T11:59:30Z", now)).toBe("30s");
    expect(age("2026-11-22T10:00:00Z", now)).toBe("2h");
    expect(age("2026-11-19T12:00:00Z", now)).toBe("3d");
    expect(age("2026-11-25T12:00:00Z", now)).toBe("0s");
    expect(age("garbage", now)).toBe("—");
  });
});
