/* ══ src/lib/mentorship/matching.test.ts — unit tests for matching algorithm ══ */

import { describe, expect, it } from "vitest";
import {
  calculateAvailabilityScore,
  calculateInterestOverlap,
  calculateSkillOverlap,
  calculateTimezoneScore,
  computeCompatibility,
  isSkillMatch,
  normalizeToken,
  parseTimezoneOffset,
  rankMenteesForMentor,
  rankMentorsForMentee,
  WEIGHTS,
} from "./matching";
import type { Mentor, Mentee } from "./types";

const mockMentor: Mentor = {
  id: "mentor-1",
  userId: "user-m1",
  name: "Sarah Chen",
  email: "sarah@example.com",
  bio: "Senior Full Stack Dev",
  expertise: ["TypeScript", "React", "PostgreSQL", "Next.js", "Docker"],
  interests: ["Open Source", "Web Development", "DevOps"],
  timezone: "UTC-5",
  availabilityHours: 5,
  maxMentees: 2,
  currentMentees: 0,
  status: "active",
  rating: 48,
  reviewCount: 12,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockMentee: Mentee = {
  id: "mentee-1",
  userId: "user-e1",
  name: "Alex Rivera",
  email: "alex@example.com",
  bio: "Aspiring open source contributor",
  goals: "Contribute to Next.js projects and master TypeScript",
  skillLevel: "beginner",
  interests: ["Open Source", "Web Development"],
  currentSkills: ["JavaScript", "HTML", "CSS"],
  desiredSkills: ["TypeScript", "React", "Next.js"],
  timezone: "UTC-5",
  availabilityHours: 5,
  status: "seeking",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("Mentorship Matching Engine", () => {
  describe("Token normalization and skill aliases", () => {
    it("normalizes skill aliases correctly", () => {
      expect(normalizeToken("ts")).toBe("typescript");
      expect(normalizeToken("reactjs")).toBe("react");
      expect(normalizeToken("postgres")).toBe("postgresql");
      expect(normalizeToken("k8s")).toBe("kubernetes");
      expect(normalizeToken("golang")).toBe("go");
    });

    it("matches skills via exact and alias equivalents", () => {
      expect(isSkillMatch("TypeScript", "ts")).toBe(true);
      expect(isSkillMatch("React.js", "react")).toBe(true);
      expect(isSkillMatch("Postgres", "PostgreSQL")).toBe(true);
      expect(isSkillMatch("Python", "Java")).toBe(false);
    });
  });

  describe("Skill overlap calculation", () => {
    it("returns high score when desired skills are fully covered", () => {
      const res = calculateSkillOverlap(
        ["TypeScript", "React", "Next.js"],
        ["TypeScript", "React", "Next.js"],
        ["JavaScript"]
      );
      expect(res.score).toBeGreaterThanOrEqual(90);
      expect(res.matchedSkills).toContain("TypeScript");
      expect(res.matchedSkills).toContain("React");
    });

    it("returns 0 when there is zero overlap", () => {
      const res = calculateSkillOverlap(["Rust", "Solidity"], ["Python", "Django"]);
      expect(res.score).toBe(0);
      expect(res.matchedSkills).toHaveLength(0);
    });

    it("handles empty skills gracefully", () => {
      const res = calculateSkillOverlap([], []);
      expect(res.score).toBe(50);
      expect(res.matchedSkills).toHaveLength(0);
    });
  });

  describe("Interest overlap calculation", () => {
    it("calculates percentage overlap of interests", () => {
      const res = calculateInterestOverlap(
        ["Open Source", "Web Development", "AI/ML"],
        ["Open Source", "Web Development"]
      );
      expect(res.score).toBe(100);
      expect(res.matchedInterests).toEqual(["Open Source", "Web Development"]);
    });

    it("handles partial interest overlap", () => {
      const res = calculateInterestOverlap(
        ["Open Source", "Robotics"],
        ["Open Source", "AI/ML"]
      );
      expect(res.score).toBe(50);
      expect(res.matchedInterests).toEqual(["Open Source"]);
    });
  });

  describe("Timezone parsing and proximity", () => {
    it("parses numeric and offset timezones", () => {
      expect(parseTimezoneOffset("UTC")).toBe(0);
      expect(parseTimezoneOffset("UTC+5:30")).toBe(5.5);
      expect(parseTimezoneOffset("UTC-4")).toBe(-4);
      expect(parseTimezoneOffset("GMT+2")).toBe(2);
    });

    it("awards high score for identical timezones", () => {
      const res = calculateTimezoneScore("UTC-5", "UTC-5");
      expect(res.diffHours).toBe(0);
      expect(res.score).toBe(100);
    });

    it("decays score appropriately for large timezone gaps", () => {
      const close = calculateTimezoneScore("UTC", "UTC+2");
      const far = calculateTimezoneScore("UTC-8", "UTC+5:30");
      expect(close.score).toBeGreaterThan(far.score);
    });

    it("handles cyclic date line wrapping", () => {
      const res = calculateTimezoneScore("UTC+11", "UTC-11");
      // 22 hours raw diff wraps to 2 hours
      expect(res.diffHours).toBe(2);
      expect(res.score).toBeGreaterThanOrEqual(90);
    });
  });

  describe("Availability calculation", () => {
    it("rewards mentors with open capacity and matching hours", () => {
      const res = calculateAvailabilityScore(5, 5, 0, 2, "active");
      expect(res.score).toBeGreaterThanOrEqual(90);
      expect(res.overlapHours).toBe(5);
    });

    it("drastically penalizes mentors at max capacity", () => {
      const res = calculateAvailabilityScore(5, 5, 2, 2, "active");
      expect(res.score).toBe(10);
      expect(res.overlapHours).toBe(0);
    });

    it("penalizes inactive mentors", () => {
      const res = calculateAvailabilityScore(10, 5, 0, 3, "inactive");
      expect(res.score).toBe(10);
    });
  });

  describe("Compatibility and Ranking", () => {
    it("computes overall score adhering to defined weights", () => {
      const details = computeCompatibility(mockMentor, mockMentee);
      expect(details.overallScore).toBeGreaterThanOrEqual(80);
      expect(details.skillScore).toBeGreaterThanOrEqual(85);
      expect(details.timezoneScore).toBe(100);
      expect(WEIGHTS.SKILLS + WEIGHTS.INTERESTS + WEIGHTS.AVAILABILITY + WEIGHTS.TIMEZONE).toBeCloseTo(1.0);
    });

    it("ranks mentors in descending score order", () => {
      const mentor2: Mentor = {
        ...mockMentor,
        id: "mentor-2",
        name: "Dave Miller",
        expertise: ["Rust", "C++"],
        interests: ["Hardware"],
        timezone: "UTC+8",
      };

      const matches = rankMentorsForMentee([mentor2, mockMentor], mockMentee);
      expect(matches).toHaveLength(2);
      expect(matches[0].mentor.id).toBe("mentor-1");
      expect(matches[0].score).toBeGreaterThan(matches[1].score);
    });

    it("filters out unavailable mentors when onlyAvailable is set", () => {
      const fullMentor: Mentor = {
        ...mockMentor,
        id: "mentor-full",
        currentMentees: 2,
        maxMentees: 2,
      };

      const matches = rankMentorsForMentee([fullMentor], mockMentee, { onlyAvailable: true });
      expect(matches).toHaveLength(0);
    });

    it("ranks mentees for a mentor", () => {
      const mentee2: Mentee = {
        ...mockMentee,
        id: "mentee-2",
        desiredSkills: ["Rust", "Embedded"],
        interests: ["Hardware"],
      };

      const matches = rankMenteesForMentor([mockMentee, mentee2], mockMentor);
      expect(matches).toHaveLength(2);
      expect(matches[0].mentee.id).toBe("mentee-1");
    });
  });
});
