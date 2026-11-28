/* ══ contributor-spotlight/model.ts — contributor spotlight scoring + rotation ══ */

export interface ContributorStats {
  login: string;
  name: string;
  prsLastMonth: number;
  reviewsLastMonth: number;
  mentoringSessions: number;
  streakDays: number;
  joinedDate: string;
}

export interface SpotlightEntry {
  contributor: ContributorStats;
  score: number;
  rank: number;
  weekOf: string;
  nominated: boolean;
}

export function spotlightScore(stats: ContributorStats): number {
  return (
    stats.prsLastMonth * 10 +
    stats.reviewsLastMonth * 8 +
    stats.mentoringSessions * 15 +
    Math.min(stats.streakDays, 30) * 2
  );
}

export function rankContributors(contributors: ContributorStats[]): SpotlightEntry[] {
  const scored = contributors.map((c) => ({ contributor: c, score: spotlightScore(c), rank: 0, weekOf: currentWeek(), nominated: false }));
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((e, i) => { e.rank = i + 1; });
  return scored;
}

export function currentWeek(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

export function topN(entries: SpotlightEntry[], n: number): SpotlightEntry[] {
  return entries.slice(0, n);
}

export function isEligible(stats: ContributorStats): boolean {
  return stats.prsLastMonth >= 1 || stats.reviewsLastMonth >= 2 || stats.mentoringSessions >= 1;
}
