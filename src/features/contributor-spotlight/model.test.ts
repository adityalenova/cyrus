import { describe, it, expect } from "vitest";
import { spotlightScore, rankContributors, topN, isEligible } from "./model";

describe("contributor-spotlight/model", () => {
  const alice = { login: "alice", name: "Alice", prsLastMonth: 8, reviewsLastMonth: 12, mentoringSessions: 2, streakDays: 25, joinedDate: "2025-01-01" };
  const bob = { login: "bob", name: "Bob", prsLastMonth: 3, reviewsLastMonth: 5, mentoringSessions: 0, streakDays: 10, joinedDate: "2026-06-01" };

  it("computes spotlight score", () => {
    expect(spotlightScore(alice)).toBeGreaterThan(spotlightScore(bob));
  });

  it("ranks contributors by score", () => {
    const ranked = rankContributors([bob, alice]);
    expect(ranked[0].contributor.login).toBe("alice");
    expect(ranked[0].rank).toBe(1);
  });

  it("returns top N", () => {
    const ranked = rankContributors([bob, alice]);
    expect(topN(ranked, 1)).toHaveLength(1);
  });

  it("checks eligibility", () => {
    expect(isEligible(alice)).toBe(true);
    expect(isEligible({ login: "new", name: "New", prsLastMonth: 0, reviewsLastMonth: 0, mentoringSessions: 0, streakDays: 0, joinedDate: "2026-11-01" })).toBe(false);
  });
});
