import { describe, expect, it } from "vitest";
import { REPOS } from "@/data/repos";
import { PROGRAMS } from "@/data/orgs";
import { activityReport, catalogReport, reportRequest, reportText } from "./reports";
import type { Activity } from "./activity";

describe("report requests and source data", () => {
  it("requires known shapes, bounds batch size and refuses client-controlled identity or HTML", () => {
    for (const value of [null, {}, { kind: "activity", login: "someone-else" }, { kind: "activity", html: "<h1>fake</h1>" },
      { kind: "projects", ids: [] }, { kind: "projects", ids: Array(11).fill(REPOS[0].repo) },
      { kind: "projects", ids: [REPOS[0].repo], size: "A3" }, { kind: "programs", ids: [] }, { kind: "programs", status: "open" }]) {
      expect(reportRequest.safeParse(value).success).toBe(false);
    }
    expect(reportRequest.parse({ kind: "activity" })).toEqual({ kind: "activity", size: "A4" });
  });
  it("resolves project snapshots, deduplicates without mutation and never adds synthetic metrics", () => {
    const r = REPOS[0], before = JSON.stringify(r);
    const request = reportRequest.parse({ kind: "projects", ids: [r.repo, r.repo.toUpperCase(), REPOS[1].repo], size: "LETTER" });
    if (request.kind === "activity") throw Error("fixture");
    const result = catalogReport(request);
    expect(result.size).toBe("LETTER"); expect(result.sections).toHaveLength(2);
    expect(result.sections[0].chart?.rows).toEqual([{ label: "Stars", value: r.stars }, { label: "Forks", value: r.forks }, { label: "Open issues", value: r.issues }]);
    expect(JSON.stringify(result)).not.toMatch(/watchers|dev1|language breakdown percentages/);
    expect(JSON.stringify(r)).toBe(before);
    expect(() => catalogReport({ kind: "projects", ids: ["https://127.0.0.1/private"], size: "A4" })).toThrow(/not in the current catalog/);
  });
  it("exports exactly the current program filter or explicit selection", () => {
    for (const status of ["all", "live", "upcoming", "closed"] as const) {
      const r = catalogReport({ kind: "programs", status, size: "A4" });
      const expected = PROGRAMS.filter((p) => status === "all" || p.status === status);
      expect(r.sections.slice(1).map((s) => s.title)).toEqual(expected.map((p) => p.name));
      expect(r.sections[0].chart?.rows.reduce((n, row) => n + row.value, 0)).toBe(expected.length);
    }
    expect(catalogReport({ kind: "programs", ids: ["gsoc"], status: "all", size: "A4" }).sections).toHaveLength(2);
    expect(() => catalogReport({ kind: "programs", ids: ["missing"], status: "all", size: "A4" })).toThrow(/not in the current catalog/);
    expect(() => catalogReport({ kind: "programs", ids: ["gsoc"], status: "live", size: "A4" })).toThrow(/No programs match/);
  });
  it("bounds recent activity to 100 events with honest event counts and pagination", () => {
    const events: Activity[] = Array.from({ length: 101 }, (_, i) => ({ id: String(i), kind: i % 2 ? "pr" : "push", repo: "demo/project",
      title: "An event", url: "https://github.com/demo/project", time: "2026-11-20T12:00:00.000Z" }));
    const r = activityReport("demo", { events, fetchedAt: 1_000 }, "A4");
    expect(r.sections).toHaveLength(8);
    expect(r.sections.slice(1).flatMap((s) => s.entries || [])).toHaveLength(100);
    expect(r.sections[0].chart?.rows.reduce((n, row) => n + row.value, 0)).toBe(100);
    expect(r.sections[0].notes.join(" ")).toMatch(/not all-time history/);
    expect(activityReport("demo", { events: [], fetchedAt: 1_000 }, "LETTER").sections).toHaveLength(1);
  });
  it("preserves Latin Unicode, removes controls and explicitly marks bounded text", () => {
    expect(reportText("Café naïve München Tiếng Việt")).toBe("Café naïve München Tiếng Việt");
    expect(reportText("a\u0000b")).toBe("a b");
    expect(reportText("x".repeat(2000))).toHaveLength(1612);
    expect(reportText("x".repeat(2000))).toMatch(/\[truncated\]$/);
  });
});
