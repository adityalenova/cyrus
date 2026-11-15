import { describe, expect, it } from "vitest";
import {
  formatSnapshotDate,
  getSnapshotFreshness,
  SNAPSHOT_STALE_DAYS,
} from "./snapshotFreshness";

describe("formatSnapshotDate", () => {
  it("formats standard YYYY-MM-DD date strings in UTC", () => {
    expect(formatSnapshotDate("2026-10-21")).toBe("Oct 21, 2026");
    expect(formatSnapshotDate("2026-01-05")).toBe("Jan 5, 2026");
  });

  it("formats full ISO timestamp strings", () => {
    expect(formatSnapshotDate("2026-10-21T14:32:00.000Z")).toBe("Oct 21, 2026");
  });

  it("handles missing or null metadata without crashing", () => {
    expect(formatSnapshotDate(undefined)).toBe("Date unavailable");
    expect(formatSnapshotDate(null)).toBe("Date unavailable");
  });

  it("handles empty or whitespace-only strings without crashing", () => {
    expect(formatSnapshotDate("")).toBe("Date unavailable");
    expect(formatSnapshotDate("   ")).toBe("Date unavailable");
  });

  it("handles invalid or malformed dates without crashing", () => {
    expect(formatSnapshotDate("not-a-date")).toBe("Date unavailable");
    expect(formatSnapshotDate("2026-99-99")).toBe("Date unavailable");
    expect(formatSnapshotDate(12345)).toBe("Date unavailable");
    expect(formatSnapshotDate({})).toBe("Date unavailable");
  });
});

describe("getSnapshotFreshness", () => {
  const CRAWL_DATE = "2026-10-21";

  it("exports default SNAPSHOT_STALE_DAYS of 14", () => {
    expect(SNAPSHOT_STALE_DAYS).toBe(14);
  });

  it("uses server-supplied timestamp and server-supplied serverTime to determine age", () => {
    // 5 days later according to serverTime
    const serverTime = "2026-10-26T12:00:00.000Z";
    const freshness = getSnapshotFreshness(CRAWL_DATE, serverTime);

    expect(freshness.status).toBe("recent");
    expect(freshness.isRecent).toBe(true);
    expect(freshness.isStale).toBe(false);
    expect(freshness.ageInDays).toBe(5);
    expect(freshness.formattedDate).toBe("Oct 21, 2026");
    expect(freshness.badgeText).toContain("Index snapshot: Refreshed Oct 21, 2026");
    expect(freshness.clarificationText).toContain("Reflects crawled index snapshot");
  });

  it("distinguishes a stale snapshot from a recent one based on server-supplied time", () => {
    // 25 days later according to serverTime (> SNAPSHOT_STALE_DAYS of 14)
    const serverTime = "2026-11-15T12:00:00.000Z";
    const freshness = getSnapshotFreshness(CRAWL_DATE, serverTime);

    expect(freshness.status).toBe("stale");
    expect(freshness.isStale).toBe(true);
    expect(freshness.isRecent).toBe(false);
    expect(freshness.ageInDays).toBe(25);
    expect(freshness.formattedDate).toBe("Oct 21, 2026");
    expect(freshness.badgeText).toContain("Stale index snapshot (Oct 21, 2026)");
    expect(freshness.clarificationText).toContain("Index snapshot is 25d old");
    expect(freshness.clarificationText).toContain("live GitHub thread state may differ");
    expect(freshness.label).toContain("Stale index snapshot · Refreshed Oct 21, 2026");
  });

  it("handles the exact threshold boundary", () => {
    // Exactly 14 days later
    const day14 = "2026-11-04T00:00:00.000Z";
    const f14 = getSnapshotFreshness(CRAWL_DATE, day14, { staleDays: 14 });
    expect(f14.ageInDays).toBe(14);
    expect(f14.isStale).toBe(false);
    expect(f14.status).toBe("recent");

    // 15 days later (1 day past threshold)
    const day15 = "2026-11-05T00:00:00.000Z";
    const f15 = getSnapshotFreshness(CRAWL_DATE, day15, { staleDays: 14 });
    expect(f15.ageInDays).toBe(15);
    expect(f15.isStale).toBe(true);
    expect(f15.status).toBe("stale");
  });

  it("supports custom staleDays threshold option", () => {
    const serverTime = "2026-10-25T00:00:00.000Z"; // 4 days later
    const recent = getSnapshotFreshness(CRAWL_DATE, serverTime, { staleDays: 7 });
    expect(recent.isStale).toBe(false);

    const stale = getSnapshotFreshness(CRAWL_DATE, serverTime, { staleDays: 3 });
    expect(stale.isStale).toBe(true);
    expect(stale.status).toBe("stale");
  });

  it("handles missing metadata without crashing", () => {
    const f1 = getSnapshotFreshness(undefined, undefined);
    expect(f1.status).toBe("unknown");
    expect(f1.isStale).toBe(false);
    expect(f1.isRecent).toBe(false);
    expect(f1.ageInDays).toBeNull();
    expect(f1.formattedDate).toBe("Date unavailable");
    expect(f1.badgeText).toBe("Index snapshot date unavailable");
    expect(f1.clarificationText).toContain("Reflects crawled index snapshot, not live GitHub state.");

    const f2 = getSnapshotFreshness(null, "2026-11-15T00:00:00Z");
    expect(f2.status).toBe("unknown");
    expect(f2.formattedDate).toBe("Date unavailable");
  });

  it("handles invalid or malformed timestamps without crashing", () => {
    const f1 = getSnapshotFreshness("invalid-date-string", "2026-11-15T00:00:00Z");
    expect(f1.status).toBe("unknown");
    expect(f1.isStale).toBe(false);
    expect(f1.ageInDays).toBeNull();
    expect(f1.formattedDate).toBe("Date unavailable");
    expect(f1.badgeText).toBe("Index snapshot date unavailable");

    const f2 = getSnapshotFreshness("", "");
    expect(f2.status).toBe("unknown");
    expect(f2.formattedDate).toBe("Date unavailable");
  });

  it("handles invalid serverTime gracefully without crashing", () => {
    const freshness = getSnapshotFreshness(CRAWL_DATE, "garbage-server-time");
    expect(freshness.formattedDate).toBe("Oct 21, 2026");
    expect(typeof freshness.isStale).toBe("boolean");
  });

  it("ensures copy clearly clarifies that timestamps refer to the index snapshot", () => {
    const recent = getSnapshotFreshness("2026-10-21", "2026-10-22T00:00:00Z");
    expect(recent.badgeText).toMatch(/index snapshot/i);
    expect(recent.clarificationText).toMatch(/index snapshot/i);

    const stale = getSnapshotFreshness("2026-10-21", "2026-11-25T00:00:00Z");
    expect(stale.badgeText).toMatch(/index snapshot/i);
    expect(stale.clarificationText).toMatch(/index snapshot/i);

    const unknown = getSnapshotFreshness(null);
    expect(unknown.badgeText).toMatch(/index snapshot/i);
    expect(unknown.clarificationText).toMatch(/index snapshot/i);
  });
});
