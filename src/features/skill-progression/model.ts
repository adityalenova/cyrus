/* ══ skill-progression/model.ts — XP-based skill tree leveling system ══ */

export type Domain = "frontend" | "backend" | "devops" | "security" | "docs" | "testing";

export interface SkillNode {
  domain: Domain;
  xp: number;
  level: number;
  title: string;
  nextLevelXp: number;
  progress: number; // 0-1
}

export interface SkillProfile {
  nodes: SkillNode[];
  totalXp: number;
  dominantDomain: Domain;
  overallLevel: number;
}

const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500];
const LEVEL_TITLES = ["Novice", "Apprentice", "Journeyman", "Craftsman", "Artisan", "Expert", "Master", "Grandmaster", "Legend", "Mythic", "Transcendent"];

export function levelFromXp(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i;
  }
  return 0;
}

export function titleForLevel(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)];
}

export function nextThreshold(level: number): number {
  if (level + 1 >= XP_THRESHOLDS.length) return Infinity;
  return XP_THRESHOLDS[level + 1];
}

export function progressToNext(xp: number, level: number): number {
  const current = XP_THRESHOLDS[level] ?? 0;
  const next = nextThreshold(level);
  if (next === Infinity) return 1;
  const range = next - current;
  return range > 0 ? Math.min(1, (xp - current) / range) : 1;
}

export function buildNode(domain: Domain, xp: number): SkillNode {
  const level = levelFromXp(xp);
  return { domain, xp, level, title: titleForLevel(level), nextLevelXp: nextThreshold(level), progress: progressToNext(xp, level) };
}

export function buildProfile(xpByDomain: Record<Domain, number>): SkillProfile {
  const nodes = (Object.entries(xpByDomain) as [Domain, number][]).map(([d, xp]) => buildNode(d, xp));
  const totalXp = nodes.reduce((sum, n) => sum + n.xp, 0);
  const dominant = nodes.reduce((best, n) => n.xp > best.xp ? n : best, nodes[0]);
  const overallLevel = levelFromXp(Math.round(totalXp / nodes.length));
  return { nodes, totalXp, dominantDomain: dominant.domain, overallLevel };
}

export function xpForAction(action: "commit" | "pr-merged" | "review" | "issue-filed" | "docs-update" | "mentor-session"): number {
  const map: Record<string, number> = { "commit": 10, "pr-merged": 50, "review": 30, "issue-filed": 15, "docs-update": 25, "mentor-session": 40 };
  return map[action] ?? 0;
}
