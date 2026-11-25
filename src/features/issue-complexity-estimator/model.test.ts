import { describe, it, expect } from "vitest";
import { labelScore, descriptionScore, codeBlockScore, linkScore, commentScore, computeComplexity, toDifficulty, timeEstimate } from "./model";

describe("issue-complexity-estimator/model", () => {
  it("scores labels by complexity", () => {
    expect(labelScore(["good first issue"])).toBe(0.1);
    expect(labelScore(["security"])).toBe(0.7);
    expect(labelScore(["unknown"])).toBe(0);
  });

  it("scores description length", () => {
    expect(descriptionScore(50)).toBe(10);
    expect(descriptionScore(500)).toBe(45);
    expect(descriptionScore(3000)).toBe(85);
  });

  it("scores code blocks", () => {
    expect(codeBlockScore(0)).toBe(0);
    expect(codeBlockScore(5)).toBe(60);
    expect(codeBlockScore(10)).toBe(60); // capped
  });

  it("computes full complexity estimate", () => {
    const result = computeComplexity({
      descriptionLength: 1200, codeBlockCount: 4, linkCount: 3,
      labelComplexity: 0.5, commentCount: 8, hasReproSteps: true, filesMentioned: 2,
    });
    expect(result.score).toBeGreaterThan(30);
    expect(result.difficulty).toBeTruthy();
    expect(result.estimatedHours.min).toBeLessThan(result.estimatedHours.max);
  });

  it("trivial issues get short time estimates", () => {
    expect(timeEstimate("trivial").max).toBeLessThanOrEqual(1);
  });

  it("expert issues get long time estimates", () => {
    expect(timeEstimate("expert").min).toBeGreaterThanOrEqual(24);
  });

  it("maps scores to difficulty tiers", () => {
    expect(toDifficulty(5)).toBe("trivial");
    expect(toDifficulty(25)).toBe("easy");
    expect(toDifficulty(45)).toBe("medium");
    expect(toDifficulty(70)).toBe("hard");
    expect(toDifficulty(90)).toBe("expert");
  });

  it("produces reasoning for complex issues", () => {
    const result = computeComplexity({
      descriptionLength: 2000, codeBlockCount: 5, linkCount: 10,
      labelComplexity: 0.8, commentCount: 15, hasReproSteps: false, filesMentioned: 8,
    });
    expect(result.reasoning.length).toBeGreaterThan(2);
  });
});
