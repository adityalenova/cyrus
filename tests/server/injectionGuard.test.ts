import { describe, it, expect } from "vitest";
import { hasSqlInjectionPattern, assertSafeQueryParam } from "../../src/lib/server/injectionGuard";

describe("SQL Injection Guard", () => {
  it("identifies malicious SQL patterns", () => {
    expect(hasSqlInjectionPattern("admin' OR 1=1--")).toBe(true);
    expect(hasSqlInjectionPattern("1; DROP TABLE users;")).toBe(true);
    expect(hasSqlInjectionPattern("test UNION SELECT 1, 2")).toBe(true);
  });

  it("permits safe natural queries", () => {
    expect(hasSqlInjectionPattern("react open source projects")).toBe(false);
    expect(() => assertSafeQueryParam("q", "good first issues")).not.toThrow();
  });
});
