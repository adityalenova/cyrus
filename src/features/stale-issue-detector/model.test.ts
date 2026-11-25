import { describe, it, expect } from "vitest";
import {
  createStaleIssueDetectorEntry,
  filterActive,
  sortByScore,
  archiveEntry,
  summarizeStaleIssueDetector,
  searchStaleIssueDetector,
} from "./model";

describe("stale-issue-detector/model", () => {
  const sample = [
    createStaleIssueDetectorEntry("1", "Alpha", 88, ["ts", "oss"], 100),
    createStaleIssueDetectorEntry("2", "Beta", 42, ["oss"], 200),
    createStaleIssueDetectorEntry("3", "Gamma", 95, ["rust", "cli"], 300),
  ];

  it("clamps score between 0 and 100", () => {
    expect(createStaleIssueDetectorEntry("x", "K", 150).score).toBe(100);
    expect(createStaleIssueDetectorEntry("y", "K", -10).score).toBe(0);
  });

  it("deduplicates and normalizes tags", () => {
    const e = createStaleIssueDetectorEntry("x", "Test", 50, ["TS", "ts", "  oss  "]);
    expect(e.tags).toEqual(["ts", "oss"]);
  });

  it("sorts entries by score descending", () => {
    const sorted = sortByScore(sample);
    expect(sorted[0].id).toBe("3");
    expect(sorted[2].id).toBe("2");
  });

  it("archives an entry and excludes it from active", () => {
    const updated = archiveEntry(sample, "2");
    expect(filterActive(updated)).toHaveLength(2);
  });

  it("summarizes totals, average score, and top tag", () => {
    const s = summarizeStaleIssueDetector(sample);
    expect(s.total).toBe(3);
    expect(s.active).toBe(3);
    expect(s.avgScore).toBe(75);
    expect(s.topTag).toBe("oss");
  });

  it("searches by key or tag", () => {
    expect(searchStaleIssueDetector(sample, "rust")).toHaveLength(1);
    expect(searchStaleIssueDetector(sample, "alpha")).toHaveLength(1);
    expect(searchStaleIssueDetector(sample, "")).toHaveLength(3);
  });
});
