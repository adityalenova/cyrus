/* ══ siteStats.test.ts — the chrome cannot drift from the data ════════ */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPOS } from "@/data/repos";
import { ARCHIVE_PROJECTS, ALL_HACKS, STATS, fmt, openHacks, statsLine } from "./siteStats";

const archiveLength = (file: string): number => {
  const json = JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), "utf8"));
  return (json.projects ?? []).length;
};

describe("stats the footer and metadata quote", () => {
  it("counts the catalog from the data module, not a literal", () => {
    expect(STATS.repos).toBe(REPOS.length);
    expect(STATS.catalog).toBeGreaterThan(STATS.repos);
  });

  it("keeps the archive literal equal to the two JSON files", () => {
    const total = archiveLength("gsoc-projects.json") + archiveLength("otherProjects.json");
    expect(ARCHIVE_PROJECTS).toBe(total);
  });

  it("lists every hackathon exactly once", () => {
    const ids = ALL_HACKS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STATS.hacks).toBe(ids.length);
  });
});

describe("openHacks", () => {
  it("derives openness from the deadline, not the stored status", () => {
    // far future: nothing can still be open
    expect(openHacks(new Date("2099-01-01"))).toBe(0);
    // far past: everything is open relative to that date
    expect(openHacks(new Date("2000-01-01"))).toBe(ALL_HACKS.length);
  });

  it("counts an event on the day its deadline passes as open", () => {
    const withDeadline = ALL_HACKS.find((h) => h.deadline && !Number.isNaN(Date.parse(h.deadline)));
    expect(withDeadline).toBeTruthy();
    expect(openHacks(new Date(withDeadline!.deadline))).toBeGreaterThan(0);
  });

  it("is lower than the total, because some listings have closed", () => {
    expect(openHacks()).toBeLessThan(ALL_HACKS.length);
  });
});

describe("copy helpers", () => {
  it("formats with thousands separators", () => {
    expect(fmt(1528)).toBe("1,528");
  });

  it("writes a summary line with no placeholder numbers", () => {
    const line = statsLine(new Date("2026-10-20"));
    expect(line).toContain("1,528 AI-agent repos");
    expect(line).toMatch(/hackathons open now$/);
    expect(line).not.toMatch(/NaN|undefined/);
  });
});
