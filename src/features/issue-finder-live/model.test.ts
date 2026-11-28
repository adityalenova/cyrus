import { describe, expect, it } from "vitest";
import {
  ERROR_TEXT,
  LOADING_TEXT,
  describeResultStatus,
  queryLabel,
  queryPhrase,
  type ResultStatusInput,
} from "./model";

const at = (over: Partial<ResultStatusInput> = {}): ResultStatusInput => ({
  phase: "ready",
  count: 0,
  previousCount: null,
  query: "",
  ...over,
});

describe("describeResultStatus — loading", () => {
  it("announces the first read", () => {
    expect(describeResultStatus(at({ phase: "loading" }))).toBe(LOADING_TEXT);
  });

  it("stays silent when results are already on screen", () => {
    expect(describeResultStatus(at({ phase: "loading", count: 12, previousCount: 12 }))).toBeNull();
    expect(describeResultStatus(at({ phase: "loading", count: null, previousCount: 4 }))).toBeNull();
  });
});

describe("describeResultStatus — error", () => {
  it("has its own sentence, distinct from loading and from zero results", () => {
    const text = describeResultStatus(at({ phase: "error", count: null }));
    expect(text).toBe(ERROR_TEXT);
    expect(text).not.toBe(LOADING_TEXT);
    expect(text).not.toMatch(/^No issues match/);
  });

  it("reports the failure even when a stale count is still around", () => {
    expect(describeResultStatus(at({ phase: "error", count: 9, previousCount: 9 }))).toBe(ERROR_TEXT);
  });
});

describe("describeResultStatus — zero results", () => {
  it("names the search it found nothing for", () => {
    expect(describeResultStatus(at({ count: 0, query: "memory leak" })))
      .toBe("No issues match for “memory leak”.");
  });

  it("still speaks once when there is no query phrase", () => {
    expect(describeResultStatus(at({ count: 0 }))).toBe("No issues match.");
  });

  it("is distinct from the failure sentence", () => {
    expect(describeResultStatus(at({ count: 0 }))).not.toBe(ERROR_TEXT);
  });

  it("does not repeat an unchanged zero", () => {
    expect(describeResultStatus(at({ count: 0, previousCount: 0 }))).toBeNull();
  });
});

describe("describeResultStatus — N issues", () => {
  it("counts one issue in the singular", () => {
    expect(describeResultStatus(at({ count: 1, query: "rust" })))
      .toBe("1 issue matches for “rust”.");
  });

  it("counts many in the plural", () => {
    expect(describeResultStatus(at({ count: 42 }))).toBe("42 issues match.");
  });

  it("does not repeat an unchanged count", () => {
    expect(describeResultStatus(at({ count: 42, previousCount: 42 }))).toBeNull();
    expect(describeResultStatus(at({ count: 42, previousCount: 42, query: "rust" }))).toBeNull();
  });

  it("speaks again when the count moves", () => {
    expect(describeResultStatus(at({ count: 43, previousCount: 42 }))).toBe("43 issues match.");
    expect(describeResultStatus(at({ count: 41, previousCount: 42 }))).toBe("41 issues match.");
  });

  it("speaks again when a count comes back after zero", () => {
    expect(describeResultStatus(at({ count: 3, previousCount: 0 }))).toBe("3 issues match.");
  });

  it("says nothing when the count is unknown or unusable", () => {
    expect(describeResultStatus(at({ count: null }))).toBeNull();
    expect(describeResultStatus(at({ count: Number.NaN }))).toBeNull();
    expect(describeResultStatus(at({ count: Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it("treats a negative count as no results rather than speaking a negative", () => {
    expect(describeResultStatus(at({ count: -5 }))).toBe("No issues match.");
  });
});

describe("describeResultStatus — the settled-filter sequence", () => {
  it("speaks loading, then the count, then nothing for a repeated count", () => {
    expect(describeResultStatus(at({ phase: "loading" }))).toBe(LOADING_TEXT);
    expect(describeResultStatus(at({ count: 18, previousCount: null }))).toBe("18 issues match.");
    expect(describeResultStatus(at({ count: 18, previousCount: 18 }))).toBeNull();
    expect(describeResultStatus(at({ count: 0, previousCount: 18 }))).toBe("No issues match.");
  });
});

describe("queryPhrase", () => {
  it("is empty without a query", () => {
    expect(queryPhrase()).toBe("");
    expect(queryPhrase("   ")).toBe("");
  });
  it("quotes the query it was given", () => {
    expect(queryPhrase("rust, org:vercel")).toBe(" for “rust, org:vercel”");
  });
});

describe("queryLabel", () => {
  it("lists the filters in the panel's order", () => {
    expect(queryLabel({ term: " flaky ", org: "vercel", label: "docs", beginner: true, unassigned: true }))
      .toBe("flaky, vercel, docs, beginner-labelled, nobody assigned");
  });

  it("drops the filters that are off", () => {
    expect(queryLabel({ term: "docs", beginner: false, unassigned: false })).toBe("docs");
    expect(queryLabel({})).toBe("");
  });

  it("clips a long search term so the sentence stays short", () => {
    const label = queryLabel({ term: "a".repeat(200) });
    expect(label.length).toBeLessThanOrEqual(61);
    expect(label.endsWith("…")).toBe(true);
  });
});
