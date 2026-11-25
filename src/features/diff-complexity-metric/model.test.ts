import { describe, it, expect } from "vitest";
import {
  createDiffComplexityMetricEntry,
  filterActive,
  sortByScore,
  archiveEntry,
  summarizeDiffComplexityMetric,
  searchDiffComplexityMetric,
} from "./model";

describe("diff-complexity-metric/model", () => {
  const sample = [
    createDiffComplexityMetricEntry("1", "Alpha", 88, ["ts", "oss"], 100),
    createDiffComplexityMetricEntry("2", "Beta", 42, ["oss"], 200),
    createDiffComplexityMetricEntry("3", "Gamma", 95, ["rust", "cli"], 300),
  ];

  it("clamps score between 0 and 100", () => {
    expect(createDiffComplexityMetricEntry("x", "K", 150).score).toBe(100);
    expect(createDiffComplexityMetricEntry("y", "K", -10).score).toBe(0);
  });

  it("deduplicates and normalizes tags", () => {
    const e = createDiffComplexityMetricEntry("x", "Test", 50, ["TS", "ts", "  oss  "]);
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
    const s = summarizeDiffComplexityMetric(sample);
    expect(s.total).toBe(3);
    expect(s.active).toBe(3);
    expect(s.avgScore).toBe(75);
    expect(s.topTag).toBe("oss");
  });

  it("searches by key or tag", () => {
    expect(searchDiffComplexityMetric(sample, "rust")).toHaveLength(1);
    expect(searchDiffComplexityMetric(sample, "alpha")).toHaveLength(1);
    expect(searchDiffComplexityMetric(sample, "")).toHaveLength(3);
  });
});
