import { describe, it, expect } from "vitest";
import { density, isoDate, daysBetween, buildGrid, monthLabels, DENSITY_COLORS } from "./model";

describe("contribution-heatmap/model", () => {
  it("classifies density tiers", () => {
    expect(density(0)).toBe("none");
    expect(density(1)).toBe("low");
    expect(density(3)).toBe("medium");
    expect(density(8)).toBe("high");
  });

  it("formats ISO dates", () => {
    expect(isoDate(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03-15");
  });

  it("computes days between two dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-08", "2026-01-01")).toBe(-7);
  });

  it("builds a 52-week grid with correct cell count", () => {
    const grid = buildGrid({}, "2026-11-25", 52);
    expect(grid.cells).toHaveLength(364);
    expect(grid.totalContributions).toBe(0);
  });

  it("counts contributions and streaks", () => {
    const counts: Record<string, number> = {
      "2026-11-23": 3, "2026-11-24": 1, "2026-11-25": 5,
    };
    const grid = buildGrid(counts, "2026-11-25", 1);
    expect(grid.totalContributions).toBe(9);
    expect(grid.currentStreak).toBe(3);
  });

  it("tracks longest streak separately from current", () => {
    const counts: Record<string, number> = {
      "2026-11-19": 1, "2026-11-20": 2, "2026-11-21": 1, "2026-11-22": 1,
      // gap on 23
      "2026-11-24": 1, "2026-11-25": 1,
    };
    const grid = buildGrid(counts, "2026-11-25", 1);
    expect(grid.longestStreak).toBe(4);
    expect(grid.currentStreak).toBe(2);
  });

  it("generates month labels", () => {
    const grid = buildGrid({}, "2026-11-25", 52);
    const labels = monthLabels(grid.cells);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0].label).toBeTruthy();
  });

  it("density colors has four entries", () => {
    expect(Object.keys(DENSITY_COLORS)).toHaveLength(4);
  });

  it("every cell has valid weekday 0-6", () => {
    const grid = buildGrid({}, "2026-11-25", 4);
    for (const c of grid.cells) {
      expect(c.weekday).toBeGreaterThanOrEqual(0);
      expect(c.weekday).toBeLessThanOrEqual(6);
    }
  });
});
