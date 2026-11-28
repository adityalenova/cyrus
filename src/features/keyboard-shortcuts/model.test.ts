import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHORTCUTS, parseKeys, normalizeKey, detectConflicts,
  findById, toggleShortcut, rebind, groupBySection, matchEvent,
} from "./model";

describe("keyboard-shortcuts/model", () => {
  it("parses composite key strings", () => {
    expect(parseKeys("meta+shift+d")).toEqual(["meta", "shift", "d"]);
  });

  it("normalizes key ordering", () => {
    expect(normalizeKey("shift+meta+k")).toBe(normalizeKey("meta+shift+k"));
  });

  it("detects no conflicts in defaults", () => {
    expect(detectConflicts(DEFAULT_SHORTCUTS)).toEqual([]);
  });

  it("detects conflicts when two share the same binding", () => {
    const dups = [...DEFAULT_SHORTCUTS, { ...DEFAULT_SHORTCUTS[0], id: "dupe" }];
    const conflicts = detectConflicts(dups);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toContain("dupe");
  });

  it("finds shortcut by id", () => {
    expect(findById("search", DEFAULT_SHORTCUTS)?.keys).toBe("meta+k");
  });

  it("toggles shortcut enabled state", () => {
    const toggled = toggleShortcut("search", DEFAULT_SHORTCUTS);
    expect(toggled.find((s) => s.id === "search")?.enabled).toBe(false);
  });

  it("rebinds a shortcut", () => {
    const rebound = rebind("search", "meta+p", DEFAULT_SHORTCUTS);
    expect(rebound.find((s) => s.id === "search")?.keys).toBe("meta+p");
  });

  it("groups by section", () => {
    const groups = groupBySection(DEFAULT_SHORTCUTS);
    expect(Object.keys(groups)).toContain("navigation");
    expect(Object.keys(groups)).toContain("actions");
  });

  it("matches a keyboard event", () => {
    const evt = { key: "k", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    expect(matchEvent(evt, "meta+k")).toBe(true);
    expect(matchEvent(evt, "meta+j")).toBe(false);
  });

  it("DEFAULT_SHORTCUTS has 12 entries", () => {
    expect(DEFAULT_SHORTCUTS).toHaveLength(12);
  });

  it("every shortcut has a non-empty label", () => {
    for (const s of DEFAULT_SHORTCUTS) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
