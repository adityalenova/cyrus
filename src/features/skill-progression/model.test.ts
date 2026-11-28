import { describe, it, expect } from "vitest";
import { levelFromXp, titleForLevel, nextThreshold, progressToNext, buildNode, buildProfile, xpForAction } from "./model";

describe("skill-progression/model", () => {
  it("computes level from XP", () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(150)).toBe(1);
    expect(levelFromXp(1000)).toBe(4);
    expect(levelFromXp(10000)).toBe(10);
  });

  it("returns title for level", () => {
    expect(titleForLevel(0)).toBe("Novice");
    expect(titleForLevel(5)).toBe("Expert");
  });

  it("computes next threshold", () => {
    expect(nextThreshold(0)).toBe(100);
    expect(nextThreshold(3)).toBe(1000);
  });

  it("computes progress to next level", () => {
    expect(progressToNext(50, 0)).toBeCloseTo(0.5, 1);
    expect(progressToNext(100, 1)).toBe(0);
  });

  it("builds a skill node", () => {
    const node = buildNode("frontend", 450);
    expect(node.level).toBe(2);
    expect(node.title).toBe("Journeyman");
  });

  it("builds a full profile", () => {
    const profile = buildProfile({ frontend: 500, backend: 300, devops: 100, security: 50, docs: 200, testing: 150 });
    expect(profile.nodes).toHaveLength(6);
    expect(profile.dominantDomain).toBe("frontend");
    expect(profile.totalXp).toBe(1300);
  });

  it("assigns XP for actions", () => {
    expect(xpForAction("pr-merged")).toBe(50);
    expect(xpForAction("commit")).toBe(10);
  });
});
