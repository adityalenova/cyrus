import { describe, it, expect } from "vitest";
import { checksFor, toggleCheck, summarize, toReviewMarkdown } from "./model";

describe("code-review-checklist/model", () => {
  it("returns checks for typescript", () => {
    const checks = checksFor("typescript");
    expect(checks.length).toBeGreaterThan(5);
    expect(checks.some((c) => c.id === "strict-types")).toBe(true);
  });

  it("filters language-specific checks", () => {
    const tsChecks = checksFor("typescript");
    const goChecks = checksFor("go");
    expect(tsChecks.some((c) => c.id === "no-console")).toBe(true);
    expect(goChecks.some((c) => c.id === "go-errors")).toBe(true);
    expect(goChecks.some((c) => c.id === "no-console")).toBe(false);
  });

  it("toggles check state", () => {
    const checks = checksFor("python");
    const toggled = toggleCheck(checks[0].id, checks);
    expect(toggled[0].checked).toBe(true);
  });

  it("summarizes completion", () => {
    let checks = checksFor("typescript");
    checks = toggleCheck(checks[0].id, checks);
    checks = toggleCheck(checks[1].id, checks);
    const summary = summarize(checks);
    expect(summary.completed).toBe(2);
    expect(summary.percentage).toBeGreaterThan(0);
  });

  it("generates review markdown", () => {
    const checks = checksFor("go");
    const md = toReviewMarkdown(checks, "go");
    expect(md).toContain("## Code Review");
    expect(md).toContain("- [ ]");
  });

  it("all checks start unchecked", () => {
    const checks = checksFor("rust");
    expect(checks.every((c) => !c.checked)).toBe(true);
  });
});
