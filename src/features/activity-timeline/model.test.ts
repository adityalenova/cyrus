import { describe, it, expect } from "vitest";
import { groupByDate, filterByType, searchEvents, paginate, eventIcon, countByType } from "./model";

describe("activity-timeline/model", () => {
  const events = [
    { id: "1", type: "commit" as const, title: "Fix typo", detail: "README fix", timestamp: Date.UTC(2026, 10, 25, 10), repoName: "cyrus" },
    { id: "2", type: "pr-merged" as const, title: "Add feature", detail: "New widget", timestamp: Date.UTC(2026, 10, 25, 14) },
    { id: "3", type: "badge-earned" as const, title: "First Blood", detail: "Earned badge", timestamp: Date.UTC(2026, 10, 24, 8) },
  ];

  it("groups events by date", () => {
    const groups = groupByDate(events);
    expect(groups.length).toBe(2);
    expect(groups[0].events.length).toBe(2); // Nov 25
  });

  it("filters by type", () => {
    expect(filterByType(events, ["commit"]).length).toBe(1);
  });

  it("searches events", () => {
    expect(searchEvents(events, "typo").length).toBe(1);
  });

  it("paginates results", () => {
    const page = paginate(events, 1, 2);
    expect(page.items.length).toBe(2);
    expect(page.pages).toBe(2);
  });

  it("returns event icons", () => {
    expect(eventIcon("commit")).toBeTruthy();
  });

  it("counts events by type", () => {
    const counts = countByType(events);
    expect(counts["commit"]).toBe(1);
  });
});
