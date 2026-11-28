import { describe, it, expect } from "vitest";
import { letterGrade, weightedScore, commitFrequencyScore, issueResponseScore, prMergeScore, docScore, ciScore, engagementScore, computeHealth, SIGNAL_WEIGHTS } from "./model";

describe("repo-health-score/model", () => {
  it("maps scores to letter grades", () => {
    expect(letterGrade(100)).toBe("A+");
    expect(letterGrade(92)).toBe("A");
    expect(letterGrade(84)).toBe("B+");
    expect(letterGrade(76)).toBe("B");
    expect(letterGrade(68)).toBe("C+");
    expect(letterGrade(56)).toBe("C");
    expect(letterGrade(42)).toBe("D");
    expect(letterGrade(20)).toBe("F");
  });

  it("computes weighted score", () => {
    const signals = [
      { id: "a", label: "A", weight: 0.5, score: 80, detail: "" },
      { id: "b", label: "B", weight: 0.5, score: 60, detail: "" },
    ];
    expect(weightedScore(signals)).toBe(70);
  });

  it("scores commit frequency", () => {
    expect(commitFrequencyScore(20)).toBe(100);
    expect(commitFrequencyScore(0.5)).toBe(10);
  });

  it("scores issue response time", () => {
    expect(issueResponseScore(2)).toBe(100);
    expect(issueResponseScore(200)).toBe(10);
  });

  it("scores PR merge velocity", () => {
    expect(prMergeScore(0.5)).toBe(100);
    expect(prMergeScore(60)).toBe(10);
  });

  it("scores documentation completeness", () => {
    expect(docScore(true, true, true, true)).toBe(100);
    expect(docScore(true, false, false, false)).toBe(40);
    expect(docScore(false, false, false, false)).toBe(0);
  });

  it("scores CI pass rate", () => {
    expect(ciScore(1.0)).toBe(100);
    expect(ciScore(0.5)).toBe(50);
  });

  it("scores community engagement", () => {
    expect(engagementScore(1000, 50, 20)).toBe(100);
    expect(engagementScore(0, 0, 0)).toBe(15);
  });

  it("computes full health report", () => {
    const report = computeHealth("test/repo", {
      commitsPerWeek: 12, avgHoursToFirstResponse: 8,
      avgDaysToMerge: 2, hasReadme: true, hasContributing: true,
      hasLicense: true, hasCodeOfConduct: false, ciPassRate: 0.95,
      stars: 300, forks: 40, watchers: 10,
    });
    expect(report.overallScore).toBeGreaterThan(60);
    expect(report.grade).toBeTruthy();
    expect(report.signals).toHaveLength(6);
  });

  it("signal weights sum to 1.0", () => {
    const sum = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});
