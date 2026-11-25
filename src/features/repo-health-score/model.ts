/* ══ repo-health-score/model.ts — multi-signal health grading ══ */

export type Grade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

export interface Signal {
  id: string;
  label: string;
  weight: number;
  score: number;   // 0-100
  detail: string;
}

export interface HealthReport {
  repoName: string;
  overallScore: number;
  grade: Grade;
  signals: Signal[];
  computedAt: number;
}

export const SIGNAL_WEIGHTS = {
  commitFrequency: 0.20,
  issueResponseTime: 0.15,
  prMergeVelocity: 0.20,
  documentation: 0.15,
  ciStatus: 0.15,
  communityEngagement: 0.15,
} as const;

export function letterGrade(score: number): Grade {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 83) return "B+";
  if (score >= 75) return "B";
  if (score >= 67) return "C+";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function weightedScore(signals: Signal[]): number {
  let totalWeight = 0;
  let weighted = 0;
  for (const s of signals) {
    weighted += s.score * s.weight;
    totalWeight += s.weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weighted / totalWeight);
}

export function commitFrequencyScore(commitsPerWeek: number): number {
  if (commitsPerWeek >= 15) return 100;
  if (commitsPerWeek >= 10) return 90;
  if (commitsPerWeek >= 5) return 75;
  if (commitsPerWeek >= 2) return 55;
  if (commitsPerWeek >= 1) return 35;
  return 10;
}

export function issueResponseScore(avgHoursToFirstResponse: number): number {
  if (avgHoursToFirstResponse <= 4) return 100;
  if (avgHoursToFirstResponse <= 12) return 90;
  if (avgHoursToFirstResponse <= 24) return 75;
  if (avgHoursToFirstResponse <= 72) return 55;
  if (avgHoursToFirstResponse <= 168) return 30;
  return 10;
}

export function prMergeScore(avgDaysToMerge: number): number {
  if (avgDaysToMerge <= 1) return 100;
  if (avgDaysToMerge <= 3) return 85;
  if (avgDaysToMerge <= 7) return 70;
  if (avgDaysToMerge <= 14) return 50;
  if (avgDaysToMerge <= 30) return 30;
  return 10;
}

export function docScore(hasReadme: boolean, hasContributing: boolean, hasLicense: boolean, hasCodeOfConduct: boolean): number {
  let s = 0;
  if (hasReadme) s += 40;
  if (hasContributing) s += 25;
  if (hasLicense) s += 20;
  if (hasCodeOfConduct) s += 15;
  return s;
}

export function ciScore(passRate: number): number {
  return Math.round(passRate * 100);
}

export function engagementScore(stars: number, forks: number, watchers: number): number {
  const total = stars + forks * 2 + watchers * 3;
  if (total >= 500) return 100;
  if (total >= 200) return 85;
  if (total >= 50) return 65;
  if (total >= 10) return 40;
  return 15;
}

export function computeHealth(repoName: string, params: {
  commitsPerWeek: number;
  avgHoursToFirstResponse: number;
  avgDaysToMerge: number;
  hasReadme: boolean; hasContributing: boolean; hasLicense: boolean; hasCodeOfConduct: boolean;
  ciPassRate: number;
  stars: number; forks: number; watchers: number;
}): HealthReport {
  const signals: Signal[] = [
    { id: "commitFrequency", label: "Commit frequency", weight: SIGNAL_WEIGHTS.commitFrequency, score: commitFrequencyScore(params.commitsPerWeek), detail: params.commitsPerWeek + " commits/week" },
    { id: "issueResponseTime", label: "Issue response time", weight: SIGNAL_WEIGHTS.issueResponseTime, score: issueResponseScore(params.avgHoursToFirstResponse), detail: params.avgHoursToFirstResponse + "h avg first response" },
    { id: "prMergeVelocity", label: "PR merge velocity", weight: SIGNAL_WEIGHTS.prMergeVelocity, score: prMergeScore(params.avgDaysToMerge), detail: params.avgDaysToMerge + "d avg merge time" },
    { id: "documentation", label: "Documentation", weight: SIGNAL_WEIGHTS.documentation, score: docScore(params.hasReadme, params.hasContributing, params.hasLicense, params.hasCodeOfConduct), detail: [params.hasReadme && "README", params.hasContributing && "CONTRIBUTING", params.hasLicense && "LICENSE", params.hasCodeOfConduct && "CODE_OF_CONDUCT"].filter(Boolean).join(", ") || "none" },
    { id: "ciStatus", label: "CI health", weight: SIGNAL_WEIGHTS.ciStatus, score: ciScore(params.ciPassRate), detail: Math.round(params.ciPassRate * 100) + "% pass rate" },
    { id: "communityEngagement", label: "Community", weight: SIGNAL_WEIGHTS.communityEngagement, score: engagementScore(params.stars, params.forks, params.watchers), detail: params.stars + " stars, " + params.forks + " forks" },
  ];
  const overall = weightedScore(signals);
  return { repoName, overallScore: overall, grade: letterGrade(overall), signals, computedAt: Date.now() };
}
