/* ══ src/lib/mentorship/matching.ts — automated mentorship matching algorithm ══
   Weighted scoring engine evaluating:
   - Skill overlap (45%): exact, alias/normalized, and fuzzy substring/similarity matches
   - Interest overlap (20%): domain and open-source topic alignment
   - Availability & capacity (20%): weekly hours compatibility and mentee seat availability
   - Timezone proximity (15%): hour offset difference for real-time collaboration ease
   ═════════════════════════════════════════════════════════════════════════════════ */

import type { Mentor, Mentee, CompatibilityDetails, MentorMatch, MenteeMatch } from "./types";

export const WEIGHTS = {
  SKILLS: 0.45,
  INTERESTS: 0.20,
  AVAILABILITY: 0.20,
  TIMEZONE: 0.15,
} as const;

/** Canonical alias dictionary for tech skills */
const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  golang: "go",
  k8s: "kubernetes",
  tf: "terraform",
  reactjs: "react",
  react: "react",
  vuejs: "vue",
  angularjs: "angular",
  next: "nextjs",
  "next.js": "nextjs",
  node: "nodejs",
  "node.js": "nodejs",
  postgres: "postgresql",
  pgsql: "postgresql",
  mongo: "mongodb",
  csharp: "c#",
  cpp: "c++",
};

/** Normalize string token for comparison */
export function normalizeToken(token: string): string {
  const clean = token.toLowerCase().trim().replace(/[._-]/g, "");
  return SKILL_ALIASES[clean] ?? clean;
}

/** Check if two skill strings match (exact, normalized, alias, or substring) */
export function isSkillMatch(skillA: string, skillB: string): boolean {
  const normA = normalizeToken(skillA);
  const normB = normalizeToken(skillB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  return false;
}

/**
 * Calculate skill overlap between mentor expertise and mentee desired / current skills.
 * Desired skills have primary weight; current skills have a small reinforcement bonus.
 */
export function calculateSkillOverlap(
  mentorSkills: string[],
  desiredSkills: string[],
  currentSkills: string[] = []
): { score: number; matchedSkills: string[] } {
  if (!desiredSkills.length && !currentSkills.length) {
    return { score: 50, matchedSkills: [] };
  }
  if (!mentorSkills.length) {
    return { score: 0, matchedSkills: [] };
  }

  const matched = new Set<string>();
  let desiredMatches = 0;

  for (const ds of desiredSkills) {
    for (const ms of mentorSkills) {
      if (isSkillMatch(ms, ds)) {
        matched.add(ms);
        desiredMatches++;
        break;
      }
    }
  }

  let currentBonus = 0;
  for (const cs of currentSkills) {
    for (const ms of mentorSkills) {
      if (isSkillMatch(ms, cs)) {
        matched.add(ms);
        currentBonus += 0.5;
        break;
      }
    }
  }

  const baseFraction = desiredSkills.length > 0 ? desiredMatches / desiredSkills.length : 0;
  const bonusFraction = currentSkills.length > 0 ? (currentBonus / currentSkills.length) * 0.2 : 0;
  const rawScore = Math.min(100, Math.round((baseFraction * 0.85 + bonusFraction * 0.15 + (desiredMatches > 0 ? 0.05 : 0)) * 100));

  return {
    score: Math.max(0, Math.min(100, rawScore)),
    matchedSkills: Array.from(matched),
  };
}

/**
 * Calculate interest overlap between mentor and mentee
 */
export function calculateInterestOverlap(
  mentorInterests: string[],
  menteeInterests: string[]
): { score: number; matchedInterests: string[] } {
  if (!menteeInterests.length || !mentorInterests.length) {
    return { score: 40, matchedInterests: [] };
  }

  const matched: string[] = [];
  for (const mi of mentorInterests) {
    for (const ei of menteeInterests) {
      if (normalizeToken(mi) === normalizeToken(ei) || mi.toLowerCase().includes(ei.toLowerCase()) || ei.toLowerCase().includes(mi.toLowerCase())) {
        if (!matched.includes(mi)) matched.push(mi);
        break;
      }
    }
  }

  const score = Math.round((matched.length / Math.max(1, menteeInterests.length)) * 100);
  return {
    score: Math.min(100, score),
    matchedInterests: matched,
  };
}

/**
 * Parse timezone string into UTC offset in hours.
 * Supports formats: "UTC", "UTC+5:30", "UTC-4", "GMT+2", "+05:30", "-04:00",
 * or standard IANA names like "America/New_York", "Asia/Kolkata", "Europe/London".
 */
export function parseTimezoneOffset(tz: string): number {
  if (!tz) return 0;
  const clean = tz.trim();

  // Try direct regex on UTC/GMT offsets
  const match = clean.match(/(?:UTC|GMT)?\s*([+-])(\d{1,2})(?::(\d{2}))?/i);
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) / 60 : 0;
    return sign * (hours + mins);
  }

  if (clean.toUpperCase() === "UTC" || clean.toUpperCase() === "GMT" || clean.toUpperCase() === "Z") {
    return 0;
  }

  // Try Intl timezone offset resolution if available
  try {
    const now = new Date();
    const invDate = new Date(now.toLocaleString("en-US", { timeZone: clean }));
    const diff = (invDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return Math.round(diff * 2) / 2;
  } catch {
    return 0;
  }
}

/**
 * Calculate timezone compatibility score based on hour difference.
 * 0-2 hours diff: 95-100%
 * 3-4 hours diff: 85-90%
 * 5-7 hours diff: 65-75%
 * 8-10 hours diff: 45-55%
 * 11-12 hours diff: 25-35%
 * >12 hours diff: 15-20%
 */
export function calculateTimezoneScore(
  mentorTz: string,
  menteeTz: string
): { score: number; diffHours: number } {
  const offM = parseTimezoneOffset(mentorTz);
  const offE = parseTimezoneOffset(menteeTz);
  let rawDiff = Math.abs(offM - offE);
  // Cyclic modulo 24 wrap (e.g. +11 vs -11 is 2 hours difference across date line)
  if (rawDiff > 12) {
    rawDiff = 24 - rawDiff;
  }
  const diffHours = Math.round(rawDiff * 10) / 10;

  let score = 100;
  if (diffHours <= 2) {
    score = 100 - diffHours * 2.5;
  } else if (diffHours <= 4) {
    score = 90 - (diffHours - 2) * 5;
  } else if (diffHours <= 7) {
    score = 80 - (diffHours - 4) * 5;
  } else if (diffHours <= 10) {
    score = 65 - (diffHours - 7) * 6.5;
  } else {
    score = Math.max(15, 45 - (diffHours - 10) * 10);
  }

  return {
    score: Math.round(score),
    diffHours,
  };
}

/**
 * Calculate availability score based on weekly hours and mentor capacity
 */
export function calculateAvailabilityScore(
  mentorHours: number,
  menteeHours: number,
  currentMentees: number,
  maxMentees: number,
  status: string
): { score: number; overlapHours: number } {
  if (status === "inactive" || (maxMentees > 0 && currentMentees >= maxMentees)) {
    return { score: 10, overlapHours: 0 };
  }

  const safeMentorHours = Math.max(1, mentorHours);
  const safeMenteeHours = Math.max(1, menteeHours);

  // Remaining capacity factor
  const remainingSlots = Math.max(0, maxMentees - currentMentees);
  const capacityFactor = maxMentees > 0 ? remainingSlots / maxMentees : 1;

  // Overlap ratio: how well mentor's hours cover mentee's needs
  const overlapRatio = Math.min(1.2, safeMentorHours / safeMenteeHours);
  const overlapHours = Math.min(safeMentorHours, safeMenteeHours);

  let raw = 0;
  if (overlapRatio >= 0.8) {
    raw = 90 + Math.min(10, (overlapRatio - 0.8) * 25);
  } else {
    raw = 50 + (overlapRatio / 0.8) * 40;
  }

  // Weight capacity availability
  const finalScore = Math.round(raw * 0.7 + (capacityFactor > 0 ? 30 : 0));
  return {
    score: Math.max(10, Math.min(100, finalScore)),
    overlapHours,
  };
}

/**
 * Compute full compatibility details and weighted overall score
 */
export function computeCompatibility(mentor: Mentor, mentee: Mentee): CompatibilityDetails {
  const skill = calculateSkillOverlap(mentor.expertise, mentee.desiredSkills, mentee.currentSkills);
  const interest = calculateInterestOverlap(mentor.interests, mentee.interests);
  const tz = calculateTimezoneScore(mentor.timezone, mentee.timezone);
  const avail = calculateAvailabilityScore(
    mentor.availabilityHours,
    mentee.availabilityHours,
    mentor.currentMentees,
    mentor.maxMentees,
    mentor.status
  );

  const overallScore = Math.round(
    skill.score * WEIGHTS.SKILLS +
    interest.score * WEIGHTS.INTERESTS +
    avail.score * WEIGHTS.AVAILABILITY +
    tz.score * WEIGHTS.TIMEZONE
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    skillScore: skill.score,
    matchedSkills: skill.matchedSkills,
    interestScore: interest.score,
    matchedInterests: interest.matchedInterests,
    availabilityScore: avail.score,
    timezoneScore: tz.score,
    timezoneDiffHours: tz.diffHours,
    overlapHours: avail.overlapHours,
  };
}

/**
 * Rank and filter mentors for a given mentee
 */
export function rankMentorsForMentee(
  mentors: Mentor[],
  mentee: Mentee,
  options?: { minScore?: number; onlyAvailable?: boolean; limit?: number }
): MentorMatch[] {
  const minScore = options?.minScore ?? 0;
  const onlyAvailable = options?.onlyAvailable ?? false;
  const limit = options?.limit ?? 50;

  const matches: MentorMatch[] = [];

  for (const mentor of mentors) {
    const isAvailable = mentor.status === "active" && mentor.currentMentees < mentor.maxMentees;
    if (onlyAvailable && !isAvailable) continue;

    const details = computeCompatibility(mentor, mentee);
    if (details.overallScore < minScore) continue;

    matches.push({
      mentor,
      score: details.overallScore,
      details,
      available: isAvailable,
    });
  }

  // Sort descending by score; if tied, sort by availability then rating
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.available !== a.available) return b.available ? 1 : -1;
    return b.mentor.rating - a.mentor.rating;
  });

  return matches.slice(0, limit);
}

/**
 * Rank mentees for a mentor
 */
export function rankMenteesForMentor(
  mentees: Mentee[],
  mentor: Mentor,
  options?: { minScore?: number; limit?: number }
): MenteeMatch[] {
  const minScore = options?.minScore ?? 0;
  const limit = options?.limit ?? 50;

  const matches: MenteeMatch[] = [];

  for (const mentee of mentees) {
    if (mentee.status === "inactive") continue;
    const details = computeCompatibility(mentor, mentee);
    if (details.overallScore < minScore) continue;

    matches.push({
      mentee,
      score: details.overallScore,
      details,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
