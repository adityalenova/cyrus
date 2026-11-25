import { describe, it, expect } from "vitest";
import { generateTemplate, baseSections, toMarkdown, CHANGE_LABELS, CHANGE_EMOJI } from "./model";

describe("pr-template-generator/model", () => {
  it("generates bugfix template with root cause section", () => {
    const t = generateTemplate("bugfix", "Fix login crash");
    expect(t.sections.some((s) => s.heading === "Root Cause")).toBe(true);
  });

  it("generates feature template with design section", () => {
    const t = generateTemplate("feature", "Add dark mode");
    expect(t.sections.some((s) => s.heading === "Design")).toBe(true);
  });

  it("includes testing checklist in all types", () => {
    for (const type of ["bugfix", "feature", "refactor", "docs", "chore", "perf"] as const) {
      const t = generateTemplate(type, "test");
      expect(t.sections.some((s) => s.heading === "Checklist")).toBe(true);
    }
  });

  it("generates valid markdown", () => {
    const t = generateTemplate("feature", "Test");
    expect(t.markdown).toContain("## ✨");
    expect(t.markdown).toContain("### Summary");
  });

  it("has labels for all change types", () => {
    expect(Object.keys(CHANGE_LABELS)).toHaveLength(6);
    expect(Object.keys(CHANGE_EMOJI)).toHaveLength(6);
  });

  it("baseSections returns at least 3 sections", () => {
    expect(baseSections("docs").length).toBeGreaterThanOrEqual(3);
  });
});
