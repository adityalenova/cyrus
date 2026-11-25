import { describe, it, expect } from "vitest";
import { createProjectRoadmap, sortByPriority, filterByCategory, searchItems, countByCategory, validateConfig, merge, stats } from "./model";

describe("project-roadmap/model", () => {
  const items = [
    { id: "1", label: "Alpha", value: "First item", category: "core", priority: 3, metadata: {} },
    { id: "2", label: "Beta", value: "Second item", category: "extra", priority: 7, metadata: {} },
    { id: "3", label: "Gamma", value: "Third item", category: "core", priority: 5, metadata: {} },
  ];

  it("creates a valid config", () => {
    const cfg = createProjectRoadmap("Test Config", 1000);
    expect(cfg.name).toBe("Test Config");
    expect(cfg.enabled).toBe(true);
    expect(cfg.createdAt).toBe(1000);
  });

  it("sorts items by priority descending", () => {
    const sorted = sortByPriority(items);
    expect(sorted[0].id).toBe("2");
    expect(sorted[2].id).toBe("1");
  });

  it("filters by category", () => {
    const core = filterByCategory(items, "core");
    expect(core).toHaveLength(2);
  });

  it("searches items by label", () => {
    expect(searchItems(items, "alpha")).toHaveLength(1);
  });

  it("searches items by value", () => {
    expect(searchItems(items, "third")).toHaveLength(1);
  });

  it("counts by category", () => {
    const counts = countByCategory(items);
    expect(counts["core"]).toBe(2);
    expect(counts["extra"]).toBe(1);
  });

  it("validates config — rejects empty name", () => {
    const cfg = createProjectRoadmap("", 1000);
    expect(validateConfig(cfg)).toContain("Name is required");
  });

  it("validates config — rejects future createdAt", () => {
    const cfg = { ...createProjectRoadmap("ok", 2000), updatedAt: 1000 };
    expect(validateConfig(cfg)).toContain("updatedAt must be >= createdAt");
  });

  it("merges two item lists by id", () => {
    const extra = [{ id: "2", label: "Beta Updated", value: "Changed", category: "extra", priority: 9, metadata: {} }];
    const merged = merge(items, extra);
    expect(merged.find((i) => i.id === "2")?.label).toBe("Beta Updated");
    expect(merged).toHaveLength(3);
  });

  it("computes stats", () => {
    const s = stats(items);
    expect(s.total).toBe(3);
    expect(s.categories).toBe(2);
    expect(s.avgPriority).toBe(5);
  });
});
