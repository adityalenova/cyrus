import { describe, it, expect } from "vitest";
import {
  createDocumentationCoverageEntry,
  filterActive,
  sortByScore,
  archiveEntry,
  summarizeDocumentationCoverage,
  searchDocumentationCoverage,
} from "./model";

describe("documentation-coverage/model", () => {
  const sample = [
    createDocumentationCoverageEntry("1", "Alpha", 88, ["ts", "oss"], 100),
    createDocumentationCoverageEntry("2", "Beta", 42, ["oss"], 200),
    createDocumentationCoverageEntry("3", "Gamma", 95, ["rust", "cli"], 300),
  ];

  it("clamps score between 0 and 100", () => {
    expect(createDocumentationCoverageEntry("x", "K", 150).score).toBe(100);
    expect(createDocumentationCoverageEntry("y", "K", -10).score).toBe(0);
  });

  it("deduplicates and normalizes tags", () => {
    const e = createDocumentationCoverageEntry("x", "Test", 50, ["TS", "ts", "  oss  "]);
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
    const s = summarizeDocumentationCoverage(sample);
    expect(s.total).toBe(3);
    expect(s.active).toBe(3);
    expect(s.avgScore).toBe(75);
    expect(s.topTag).toBe("oss");
  });

  it("searches by key or tag", () => {
    expect(searchDocumentationCoverage(sample, "rust")).toHaveLength(1);
    expect(searchDocumentationCoverage(sample, "alpha")).toHaveLength(1);
    expect(searchDocumentationCoverage(sample, "")).toHaveLength(3);
  });
});
