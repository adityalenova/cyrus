import { describe, expect, it } from "vitest";
import { isFirstRun, selectEmptyState, type IssuesFeed } from "./model";

const feed = (over: Partial<IssuesFeed> = {}): IssuesFeed => ({
  ready: true,
  error: null,
  count: 0,
  ...over,
});

describe("selectEmptyState", () => {
  it("is loading until the ledger has been read, whatever the placeholder count says", () => {
    expect(selectEmptyState(feed({ ready: false, count: 0 })).kind).toBe("loading");
    expect(selectEmptyState(feed({ ready: false, count: 7 })).kind).toBe("loading");
  });

  it("does not mistake loading for the first run", () => {
    const state = selectEmptyState(feed({ ready: false, count: 0 }));
    expect(state.kind).not.toBe("empty");
    expect(isFirstRun(state)).toBe(false);
  });

  it("reports a failed read as an error with its message", () => {
    const state = selectEmptyState(feed({ error: "The ledger could not be read." }));
    expect(state).toEqual({ kind: "error", message: "The ledger could not be read." });
  });

  it("keeps the failure distinct from the empty state even with no rows", () => {
    expect(selectEmptyState(feed({ error: "nope", count: 0 })).kind).toBe("error");
    expect(selectEmptyState(feed({ error: "nope", count: 0 })).kind).not.toBe("empty");
  });

  it("puts the failure ahead of loading", () => {
    expect(selectEmptyState(feed({ ready: false, error: "nope" })).kind).toBe("error");
  });

  it("puts the failure ahead of a populated board, so its retry stays reachable", () => {
    expect(selectEmptyState(feed({ error: "nope", count: 12 })).kind).toBe("error");
  });

  it("is the first-run empty state only when a completed read has no rows", () => {
    const state = selectEmptyState(feed({ count: 0 }));
    expect(state).toEqual({ kind: "empty" });
    expect(isFirstRun(state)).toBe(true);
  });

  it("has nothing to say once a row is tracked", () => {
    expect(selectEmptyState(feed({ count: 1 })).kind).toBe("none");
    expect(selectEmptyState(feed({ count: 240 })).kind).toBe("none");
  });

  it("treats an unusable count as nothing tracked rather than rendering a broken page", () => {
    expect(selectEmptyState(feed({ count: -3 })).kind).toBe("empty");
    expect(selectEmptyState(feed({ count: Number.NaN })).kind).toBe("empty");
    expect(selectEmptyState(feed({ count: Number.POSITIVE_INFINITY })).kind).toBe("empty");
    expect(selectEmptyState(feed({ count: 2.7 })).kind).toBe("none");
  });

  it("covers the whole matrix with four distinct kinds", () => {
    const kinds = new Set([
      selectEmptyState(feed({ ready: false })).kind,
      selectEmptyState(feed({ error: "nope" })).kind,
      selectEmptyState(feed({ count: 0 })).kind,
      selectEmptyState(feed({ count: 4 })).kind,
    ]);
    expect([...kinds].sort()).toEqual(["empty", "error", "loading", "none"]);
  });
});
