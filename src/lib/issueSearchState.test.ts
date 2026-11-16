import { describe, expect, it } from "vitest";
import { describeSearch, emptyAnnouncement, resultsView, type ActiveSearch } from "./issueSearchState";

const none: ActiveSearch = { term: "", langs: [], org: "", label: "", beginner: false, unassigned: false };

describe("resultsView", () => {
  it("shows zero matches only for a completed search", () => {
    expect(resultsView("ready", true, 0)).toBe("empty");
  });
  it("never reads loading as empty", () => {
    expect(resultsView("loading", false, 0)).toBe("skeleton");
    expect(resultsView("loading", true, 0)).toBe("skeleton");
  });
  it("never reads an error as empty", () => {
    expect(resultsView("error", true, 0)).toBe("error");
    expect(resultsView("error", false, 0)).toBe("error");
  });
  it("keeps results on screen while a new search loads", () => {
    expect(resultsView("loading", true, 5)).toBe("refreshing");
    expect(resultsView("ready", true, 5)).toBe("results");
  });
  it("waits for a body before judging", () => {
    expect(resultsView("ready", false, 0)).toBe("skeleton");
  });
});

describe("describeSearch", () => {
  it("is empty with no filters", () => {
    expect(describeSearch(none)).toEqual([]);
  });
  it("lists the phrase and every active filter in order", () => {
    expect(describeSearch({ term: " leak ", langs: ["Go", "Rust"], org: "acme", label: "bug", beginner: true, unassigned: true }))
      .toEqual(['search "leak"', "language Go or Rust", "organization acme", "label bug", "beginner-labelled only", "nobody assigned"]);
  });
  it("shortens a very long phrase", () => {
    const out = describeSearch({ ...none, term: "x".repeat(100) })[0];
    expect(out.length).toBeLessThan(80);
    expect(out.endsWith('..."')).toBe(true);
  });
});

describe("emptyAnnouncement", () => {
  it("names the active query and filters and the way out", () => {
    const text = emptyAnnouncement({ ...none, term: "zzz", beginner: true });
    expect(text).toContain('search "zzz"');
    expect(text).toContain("beginner-labelled only");
    expect(text).toContain("Clear filters");
  });
  it("does not offer to clear when nothing is active", () => {
    expect(emptyAnnouncement(none)).toBe("No issues in the index.");
  });
});
