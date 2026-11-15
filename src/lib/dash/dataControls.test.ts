import { describe, expect, it } from "vitest";
import { listByKind, OWNERSHIP_COPY, removalNotice, type TrackedEntry } from "./dataControls";

const entries: TrackedEntry[] = [
  { kind: "issue", key: "https://github.com/a/b/issues/1", label: "a/b #1" },
  { kind: "repository", key: "a/b", label: "a/b" },
  { kind: "organization", key: "acme", label: "acme" },
  { kind: "issue", key: "https://github.com/c/d/issues/2", label: "c/d #2" },
];

describe("removalNotice", () => {
  it("names every selected item", () => {
    const text = removalNotice(entries);
    for (const e of entries) expect(text).toContain(e.label);
    expect(text).toContain("these 4 selections");
  });
  it("says GitHub issues are unaffected", () => {
    expect(removalNotice(entries.slice(0, 1))).toMatch(/GitHub issues and repositories stay exactly as they are/);
    expect(removalNotice(entries.slice(0, 1))).toContain("this selection");
  });
  it("handles an empty selection", () => {
    expect(removalNotice([])).toBe("Nothing selected.");
  });
});

describe("listByKind", () => {
  it("groups by kind in a stable order and skips empty kinds", () => {
    expect(listByKind(entries)).toEqual([
      "Issues: a/b #1, c/d #2",
      "Repositories: a/b",
      "Organizations: acme",
    ]);
    expect(listByKind([entries[1]])).toEqual(["Repositories: a/b"]);
  });
});

describe("OWNERSHIP_COPY", () => {
  it("separates account-owned data from public crawl data", () => {
    expect(OWNERSHIP_COPY.account).toMatch(/Only your account/);
    expect(OWNERSHIP_COPY.crawl).toMatch(/not tied to your account/);
  });
});
