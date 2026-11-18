import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("Mentorship Catalog & Data", () => {
  const catalogPath = join(process.cwd(), "public/data/mentors-catalog.json");

  it("verifies mentors-catalog.json exists and contains over 5,000 verified mentors", () => {
    expect(existsSync(catalogPath)).toBe(true);
    const raw = readFileSync(catalogPath, "utf-8");
    const mentors = JSON.parse(raw);

    expect(Array.isArray(mentors)).toBe(true);
    expect(mentors.length).toBeGreaterThan(5000);
  });

  it("verifies mentor records have necessary fields for UI rendering and filtering", () => {
    const raw = readFileSync(catalogPath, "utf-8");
    const mentors = JSON.parse(raw);

    const first = mentors[0];
    expect(first.name).toBeDefined();
    expect(typeof first.name).toBe("string");
    expect(first.projects).toBeGreaterThan(0);
    expect(Array.isArray(first.orgs)).toBe(true);
    expect(Array.isArray(first.progs)).toBe(true);
    expect(Array.isArray(first.techs)).toBe(true);
    expect(Array.isArray(first.years)).toBe(true);
  });

  it("verifies tech stack filtering on mentor records", () => {
    const raw = readFileSync(catalogPath, "utf-8");
    const mentors = JSON.parse(raw);

    const pythonMentors = mentors.filter((m: { techs: string[] }) =>
      m.techs.some((t: string) => t.toLowerCase() === "python")
    );
    expect(pythonMentors.length).toBeGreaterThan(100);

    const cppMentors = mentors.filter((m: { techs: string[] }) =>
      m.techs.some((t: string) => t.toLowerCase() === "c++")
    );
    expect(cppMentors.length).toBeGreaterThan(50);
  });

  it("verifies matching calculation on catalog mentors", async () => {
    const raw = readFileSync(catalogPath, "utf-8");
    const mentors = JSON.parse(raw);
    const { rankMentorsForMentee, computeCompatibility } = await import("./mentorship/matching");

    const sampleCandidate = {
      id: "test-mentee",
      name: "Test Mentee",
      email: "test@example.com",
      goals: "Learn TypeScript and contribute to cloud projects",
      skillLevel: "beginner" as const,
      interests: ["Open Source", "Cloud Architecture"],
      currentSkills: ["JavaScript", "Git"],
      desiredSkills: ["TypeScript", "Go", "Docker"],
      timezone: "UTC-5",
      availabilityHours: 5,
      status: "seeking" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mappedMentors = mentors.slice(0, 100).map((m: any, idx: number) => ({
      id: `mentor-${idx}`,
      name: m.name,
      email: "mentor@example.com",
      bio: `Mentor for ${m.orgs.join(", ")}`,
      expertise: m.techs,
      interests: [...m.progs, "Open Source"],
      timezone: "UTC-5",
      availabilityHours: 5,
      maxMentees: 3,
      currentMentees: 1,
      status: "active" as const,
      rating: 48,
      reviewCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const matches = rankMentorsForMentee(mappedMentors, sampleCandidate);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[matches.length - 1].score);
    expect(matches[0].details.skillScore).toBeDefined();
    expect(matches[0].details.availabilityScore).toBeDefined();
    expect(matches[0].details.timezoneScore).toBeDefined();

    const directCompat = computeCompatibility(mappedMentors[0], sampleCandidate);
    expect(directCompat.overallScore).toBeGreaterThanOrEqual(0);
    expect(directCompat.overallScore).toBeLessThanOrEqual(100);
  });
});
