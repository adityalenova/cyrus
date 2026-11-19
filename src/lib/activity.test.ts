/* ══ src/lib/activity.test.ts ══
   Unit tests for the activity lib: normalization, sorting, filtering,
   relative time, heatmap, summary. The route is exercised in e2e. ═ */
import { describe, expect, it } from "vitest";
import {
  KINDS, KIND_LABEL, filter, heatmap, normalizeEvent, normalizeEvents,
  relativeTime, summaryOf, type Activity,
} from "./activity";

const raw = (type: string, created_at: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "E-1", type, created_at,
  repo: { id: 1, name: "octocat/Hello-World" },
  payload: extra,
});

describe("normalizeEvent", () => {
  it("maps PushEvent -> push, uses the first commit message", () => {
    const a = normalizeEvent({
      id: "E-1", type: "PushEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" },
      payload: { commits: [{ message: "Add feature\n\nmore" }], ref: "refs/heads/main" },
    } as never) as Activity;
    expect(a.kind).toBe("push");
    expect(a.title).toBe("Add feature");
    expect(a.repo).toBe("octocat/hello");
  });

  it("PushEvent with empty commits falls back to the ref", () => {
    const a = normalizeEvent({
      id: "E-1", type: "PushEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" }, payload: { ref: "refs/heads/topic" },
    } as never) as Activity;
    expect(a.title).toBe("push refs/heads/topic");
  });

  it("PullRequestEvent uses the PR title, number, state, html_url", () => {
    const a = normalizeEvent({
      id: "E-2", type: "PullRequestEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" },
      payload: { action: "opened", pull_request: { number: 42, title: "Add widget", state: "open", html_url: "https://github.com/octocat/hello/pull/42" } },
    } as never) as Activity;
    expect(a.kind).toBe("pr");
    expect(a.title).toBe("Add widget");
    expect(a.number).toBe(42);
    expect(a.state).toBe("open");
    expect(a.url).toBe("https://github.com/octocat/hello/pull/42");
  });

  it("IssueEvent uses the issue title, number, state", () => {
    const a = normalizeEvent({
      id: "E-3", type: "IssuesEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" },
      payload: { action: "opened", issue: { number: 7, title: "Bug: crash", state: "open", html_url: "https://github.com/octocat/hello/issues/7" } },
    } as never) as Activity;
    expect(a.kind).toBe("issue");
    expect(a.title).toBe("Bug: crash");
    expect(a.number).toBe(7);
    expect(a.url).toContain("/issues/7");
  });

  it("PullRequestReviewEvent -> review", () => {
    const a = normalizeEvent({
      id: "E-4", type: "PullRequestReviewEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" },
      payload: { review: { state: "approved", html_url: "https://github.com/octocat/hello/pull/42" } },
    } as never) as Activity;
    expect(a.kind).toBe("review");
    expect(a.state).toBe("approved");
    expect(a.title).toContain("review");
  });

  it("IssueCommentEvent -> comment, uses the issue title", () => {
    const a = normalizeEvent({
      id: "E-5", type: "IssueCommentEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" },
      payload: { issue: { title: "Bug: crash", html_url: "https://github.com/octocat/hello/issues/7" } },
    } as never) as Activity;
    expect(a.kind).toBe("comment");
    expect(a.title).toBe("Bug: crash");
  });

  it("ReleaseEvent -> release, uses tag", () => {
    const a = normalizeEvent({
      id: "E-6", type: "ReleaseEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" },
      payload: { action: "published", release: { tag_name: "v1.2.0" } },
    } as never) as Activity;
    expect(a.kind).toBe("release");
    expect(a.title).toBe("released v1.2.0");
    expect(a.url).toContain("/releases");
  });

  it("WatchEvent -> star", () => {
    const a = normalizeEvent({
      id: "E-7", type: "WatchEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" }, payload: { action: "started" },
    } as never) as Activity;
    expect(a.kind).toBe("star");
    expect(a.title).toBe("starred");
  });

  it("unknown kind falls through to 'other' and keeps raw type", () => {
    const a = normalizeEvent({
      id: "E-8", type: "MembershipEvent", created_at: "2026-11-17T19:30:00Z",
      repo: { name: "octocat/hello" }, payload: {},
    } as never) as Activity;
    expect(a.kind).toBe("other");
    expect(a.title).toBe("MembershipEvent");
  });

  it("null raw returns null", () => expect(normalizeEvent(null)).toBeNull());

  it("event with no repo.name still returns Activity with repo=''", () => {
    const a = normalizeEvent({
      id: "E-9", type: "PushEvent", created_at: "2026-11-17T19:30:00Z",
      payload: { commits: [{ message: "fix" }], ref: "refs/heads/main" },
    } as never) as Activity;
    expect(a.repo).toBe("");
  });
});

describe("normalizeEvents", () => {
  it("drops null entries", () => {
    const rows = normalizeEvents([raw("PushEvent", "2026-11-17T19:30:00Z", { commits: [] }), null, undefined]);
    expect(rows).toHaveLength(1);
  });

  it("sorts newest first", () => {
    const rows = normalizeEvents([
      raw("PushEvent", "2026-11-15T00:00:00Z"),
      raw("PushEvent", "2026-11-17T00:00:00Z"),
      raw("PushEvent", "2026-11-16T00:00:00Z"),
    ]);
    expect(rows.map((r) => r.time)).toEqual([
      "2026-11-17T00:00:00Z", "2026-11-16T00:00:00Z", "2026-11-15T00:00:00Z",
    ]);
  });
});

describe("filter", () => {
  const a: Activity = {
    id: "1", kind: "pr", repo: "octocat/hello", title: "Add widget",
    url: "https://github.com/octocat/hello/pull/1", time: "2026-11-17T00:00:00Z", number: 1,
  };
  const b: Activity = {
    id: "2", kind: "push", repo: "octocat/hello", title: "fix bug",
    url: "https://github.com/octocat/hello", time: "2026-11-17T00:00:00Z",
  };
  const rows = [a, b];

  it("kind filter", () => expect(filter(rows, { kind: "pr" })).toEqual([a]));
  it("substring filter matches title", () => expect(filter(rows, { q: "widget" })).toEqual([a]));
  it("substring filter is case-insensitive", () => expect(filter(rows, { q: "FIX" })).toEqual([b]));
  it("kind all returns every row", () => expect(filter(rows, { kind: "all" })).toEqual(rows));
  it("both kind and substring applied", () => expect(filter(rows, { kind: "pr", q: "widget" })).toEqual([a]));
  it("empty rows -> empty", () => expect(filter([], { q: "x" })).toEqual([]));
});

describe("relativeTime", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  it("seconds => 'now'", () => expect(relativeTime("2026-11-17T11:59:45Z", now)).toBe("now"));
  it("minutes => 'Nm'", () => expect(relativeTime("2026-11-17T11:30:00Z", now)).toBe("30m"));
  it("hours => 'Nh'", () => expect(relativeTime("2026-11-17T09:00:00Z", now)).toBe("3h"));
  it("days => 'Nd'", () => expect(relativeTime("2026-11-15T12:00:00Z", now)).toBe("2d"));
  it("weeks => 'Nw'", () => expect(relativeTime("2026-10-20T12:00:00Z", now)).toBe("4w"));
  it("years => 'Ny'", () => expect(relativeTime("2025-11-01T12:00:00Z", now)).toBe("1y"));
  it("empty returns em dash", () => expect(relativeTime("", now)).toBe("—"));
  it("garbage returns em dash", () => expect(relativeTime("not a date", now)).toBe("—"));
});

describe("heatmap", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;
  const rows: Activity[] = [
    { id: "1", kind: "push", repo: "x", title: "t", url: "", time: `2026-11-17T01:00:00Z` },
    { id: "2", kind: "push", repo: "x", title: "t", url: "", time: `2026-11-17T02:00:00Z` },
    { id: "3", kind: "pr", repo: "x", title: "t", url: "", time: `2026-11-14T00:00:00Z` },
  ];

  it("counts events by UTC day", () => {
    const { cells } = heatmap(rows, { now });
    const byDay: Record<string, number> = Object.fromEntries(cells.map((c) => [c.day, c.count]));
    expect(byDay[day(17)]).toBe(2);
    expect(byDay[day(14)]).toBe(1);
  });

  it("level: 0-2 -> 0|1, 3-5 -> 2, 6-8 -> 3, 9+ -> 4", () => {
    const h = (n: number) => heatmap(Array(n).fill(0).map((_, i) => ({ id: `r${i}`, kind: "push" as const, repo: "x", title: "t", url: "", time: "2026-11-17T00:00:00Z" })), { now }).cells.find((c) => c.day === day(17))!.level;
    expect(h(0)).toBe(0);
    expect(h(1)).toBe(1);
    expect(h(2)).toBe(1);
    expect(h(3)).toBe(2);
    expect(h(5)).toBe(2);
    expect(h(6)).toBe(3);
    expect(h(8)).toBe(3);
    expect(h(9)).toBe(4);
  });

  it("zero-count cells appear (no sparse array)", () => {
    const { cells } = heatmap([{ id: "1", kind: "push", repo: "x", title: "t", url: "", time: "2026-11-01T00:00:00Z" }], { now });
    const zero = cells.find((c) => c.count === 0);
    expect(zero?.level).toBe(0);
  });

  it("days before window excluded", () => {
    const { total } = heatmap(
      [{ id: "1", kind: "push", repo: "x", title: "t", url: "", time: "2020-01-01T00:00:00Z" }],
      { now, days: 20 },
    );
    expect(total).toBe(0);
  });

  it("days > cells default", () => {
    const a = heatmap([], { now, days: 20 }).cells;
    const b = heatmap([], { now, days: 30 }).cells;
    expect(b.length).toBeGreaterThan(a.length);
  });
});

describe("summaryOf", () => {
  it("empty: 'no recent activity'", () => expect(summaryOf([])).toBe("no recent activity"));
  it("top 3 kinds", () => {
    const rows: Activity[] = [
      { id: "1", kind: "push", repo: "x", title: "t", url: "", time: "" },
      { id: "2", kind: "push", repo: "x", title: "t", url: "", time: "" },
      { id: "3", kind: "push", repo: "x", title: "t", url: "", time: "" },
      { id: "4", kind: "pr", repo: "x", title: "t", url: "", time: "" },
      { id: "5", kind: "pr", repo: "x", title: "t", url: "", time: "" },
      { id: "6", kind: "issue", repo: "x", title: "t", url: "", time: "" },
    ];
    expect(summaryOf(rows)).toBe("3 pushes, 2 pull requests, 1 issues");
  });

  it("lowercases kinds", () => {
    const rows: Activity[] = [{ id: "1", kind: "review", repo: "x", title: "t", url: "", time: "" }];
    expect(summaryOf(rows)).toBe("1 reviews");
  });
});

describe("KINDS / KIND_LABEL", () => {
  it("covers all ActivityKind union values", () => {
    expect(new Set(KINDS).size).toBe(9);
    expect(KIND_LABEL.push).toBe("Pushes");
    expect(KIND_LABEL.pr).toBe("Pull requests");
  });
});
