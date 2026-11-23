import { describe, expect, it, vi } from "vitest";
import {
  STILL_FOLLOWED,
  allVisibleSelected,
  describeOutcomes,
  matchStoredId,
  mergeOutcomes,
  planRemoval,
  pruneToVisible,
  retryPlan,
  runRemoval,
  selectAllVisible,
  someVisibleSelected,
  summariseOutcomes,
  toggleSelected,
  visibleSelectionIds,
  type BulkRow,
} from "./model";

const row = (repo: string): BulkRow => ({ id: repo, label: repo });

const ALL: BulkRow[] = [
  row("vercel/next.js"),
  row("facebook/react"),
  row("rust-lang/rust"),
];

/* what a filter leaves on screen: two of the three */
const FILTERED: BulkRow[] = [ALL[0], ALL[2]];

describe("matchStoredId", () => {
  it("answers the id the store holds, not the catalog spelling", () => {
    expect(matchStoredId(["Vercel/Next.js"], "vercel/next.js")).toBe("Vercel/Next.js");
  });
  it("falls back to the name when the store does not hold it", () => {
    expect(matchStoredId([], "vercel/next.js")).toBe("vercel/next.js");
  });
});

describe("toggleSelected", () => {
  it("adds an unselected id and removes a selected one", () => {
    expect(toggleSelected([], "a")).toEqual(["a"]);
    expect(toggleSelected(["a", "b"], "b")).toEqual(["a"]);
  });
  it("never mutates the array it was given", () => {
    const before = ["a"];
    const after = toggleSelected(before, "b");
    expect(before).toEqual(["a"]);
    expect(after).toEqual(["a", "b"]);
  });
  it("is its own inverse", () => {
    const once = toggleSelected(toggleSelected([], "a"), "a");
    expect(once).toEqual([]);
  });
});

describe("select all visible", () => {
  it("takes exactly the rows on screen", () => {
    expect(selectAllVisible(ALL)).toEqual(["vercel/next.js", "facebook/react", "rust-lang/rust"]);
  });

  it("cannot reach a row the filter has hidden", () => {
    const selected = selectAllVisible(FILTERED);
    expect(selected).toEqual(["vercel/next.js", "rust-lang/rust"]);
    expect(selected).not.toContain("facebook/react");
  });

  it("is empty when nothing is visible", () => {
    expect(selectAllVisible([])).toEqual([]);
    expect(allVisibleSelected([], [])).toBe(false);
  });

  it("reports partial and full states for the select-all checkbox", () => {
    expect(allVisibleSelected(["vercel/next.js"], ALL)).toBe(false);
    expect(someVisibleSelected(["vercel/next.js"], ALL)).toBe(true);
    expect(allVisibleSelected(selectAllVisible(ALL), ALL)).toBe(true);
    expect(someVisibleSelected(selectAllVisible(ALL), ALL)).toBe(false);
  });
});

describe("pruneToVisible", () => {
  it("drops ids a filter change took off screen", () => {
    expect(pruneToVisible(["vercel/next.js", "facebook/react"], FILTERED)).toEqual(["vercel/next.js"]);
  });
  it("leaves a visible selection alone", () => {
    expect(pruneToVisible(["rust-lang/rust"], FILTERED)).toEqual(["rust-lang/rust"]);
  });
  it("keeps row order when the selection was made out of order", () => {
    expect(visibleSelectionIds(["rust-lang/rust", "vercel/next.js"], FILTERED))
      .toEqual(["vercel/next.js", "rust-lang/rust"]);
  });
});

describe("planRemoval", () => {
  it("names the repositories in row order", () => {
    const plan = planRemoval(["rust-lang/rust", "vercel/next.js"], ALL);
    expect(plan.ids).toEqual(["vercel/next.js", "rust-lang/rust"]);
    expect(plan.labels).toEqual(["vercel/next.js", "rust-lang/rust"]);
    expect(plan.count).toBe(2);
    expect(plan.canRemove).toBe(true);
    expect(plan.dropped).toBe(0);
  });

  it("counts a hidden selected id as dropped and keeps it out of the plan", () => {
    const plan = planRemoval(["vercel/next.js", "facebook/react"], FILTERED);
    expect(plan.ids).toEqual(["vercel/next.js"]);
    expect(plan.dropped).toBe(1);
    expect(plan.count).toBe(1);
  });

  it("guards the empty selection", () => {
    const plan = planRemoval([], ALL);
    expect(plan).toMatchObject({ ids: [], labels: [], count: 0, canRemove: false });
  });
});

describe("runRemoval", () => {
  it("does not call the store when nothing is selected", () => {
    const remove = vi.fn(() => []);
    expect(runRemoval(planRemoval([], ALL), remove)).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("passes only the planned ids to the store", () => {
    const remove = vi.fn(() => []);
    runRemoval(planRemoval(["vercel/next.js", "facebook/react"], FILTERED), remove);
    expect(remove).toHaveBeenCalledWith(["vercel/next.js"]);
  });

  it("reports a clean run as all removed", () => {
    const outcomes = runRemoval(planRemoval(["vercel/next.js", "rust-lang/rust"], ALL), () => [])!;
    expect(outcomes.every((o) => o.ok)).toBe(true);
    expect(summariseOutcomes(outcomes).text).toBe("Removed 2 repositories.");
  });
});

describe("partial failure reporting", () => {
  const plan = planRemoval(["vercel/next.js", "facebook/react"], ALL);

  it("marks only the ids the store could not drop", () => {
    const outcomes = describeOutcomes(plan, ["facebook/react"]);
    expect(outcomes.map((o) => [o.id, o.ok])).toEqual([
      ["vercel/next.js", true],
      ["facebook/react", false],
    ]);
    expect(outcomes[1]).toMatchObject({ reason: STILL_FOLLOWED });
  });

  it("names every failure in its own summary", () => {
    const sum = summariseOutcomes(describeOutcomes(plan, ["facebook/react"]));
    expect(sum).toMatchObject({ total: 2, removed: 1, tone: "warn" });
    expect(sum.failed.map((f) => f.label)).toEqual(["facebook/react"]);
    expect(sum.text).toContain("Removed 1 of 2");
  });

  it("does not claim success when nothing landed", () => {
    const sum = summariseOutcomes(describeOutcomes(plan, plan.ids));
    expect(sum.tone).toBe("error");
    expect(sum.removed).toBe(0);
    expect(sum.text).toContain("Nothing was removed");
  });

  it("retries only the failed rows and can resolve them", () => {
    const first = describeOutcomes(plan, ["facebook/react"]);
    const { plan: retry } = retryPlan(first);
    expect(retry.ids).toEqual(["facebook/react"]);

    const second = runRemoval(retry, () => [])!;
    const merged = mergeOutcomes(first, second);
    expect(merged).toHaveLength(2);
    expect(merged.every((o) => o.ok)).toBe(true);
    expect(summariseOutcomes(merged).text).toBe("Removed 2 repositories.");
  });

  it("keeps a still-failing row failed after a retry", () => {
    const first = describeOutcomes(plan, ["facebook/react"]);
    const { plan: retry } = retryPlan(first);
    const merged = mergeOutcomes(first, runRemoval(retry, () => ["facebook/react"])!);
    expect(merged.filter((o) => !o.ok)).toHaveLength(1);
    expect(summariseOutcomes(merged).failed).toHaveLength(1);
  });

  it("has nothing to say about an empty result set", () => {
    expect(summariseOutcomes([]).text).toBe("");
  });
});
