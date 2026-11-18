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
});
