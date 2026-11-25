import { describe, it, expect } from "vitest";
import {
  createTimezoneOverlapGridEntry,
  filterActive,
  sortByScore,
  archiveEntry,
  summarizeTimezoneOverlapGrid,
  searchTimezoneOverlapGrid,
} from "./model";

describe("timezone-overlap-grid/model", () => {
  const sample = [
    createTimezoneOverlapGridEntry("1", "Alpha", 88, ["ts", "oss"], 100),
    createTimezoneOverlapGridEntry("2", "Beta", 42, ["oss"], 200),
    createTimezoneOverlapGridEntry("3", "Gamma", 95, ["rust", "cli"], 300),
  ];

  it("clamps score between 0 and 100", () => {
    expect(createTimezoneOverlapGridEntry("x", "K", 150).score).toBe(100);
    expect(createTimezoneOverlapGridEntry("y", "K", -10).score).toBe(0);
  });

  it("deduplicates and normalizes tags", () => {
    const e = createTimezoneOverlapGridEntry("x", "Test", 50, ["TS", "ts", "  oss  "]);
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
    const s = summarizeTimezoneOverlapGrid(sample);
    expect(s.total).toBe(3);
    expect(s.active).toBe(3);
    expect(s.avgScore).toBe(75);
    expect(s.topTag).toBe("oss");
  });

  it("searches by key or tag", () => {
    expect(searchTimezoneOverlapGrid(sample, "rust")).toHaveLength(1);
    expect(searchTimezoneOverlapGrid(sample, "alpha")).toHaveLength(1);
    expect(searchTimezoneOverlapGrid(sample, "")).toHaveLength(3);
  });
});
