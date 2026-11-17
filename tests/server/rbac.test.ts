import { describe, it, expect } from "vitest";
import { hasPermission, assertPermission, ForbiddenError } from "../../src/lib/server/rbac";

describe("RBAC Permission Guard", () => {
  it("grants full permissions to ADMIN", () => {
    expect(hasPermission("ADMIN", "catalog:read")).toBe(true);
    expect(hasPermission("ADMIN", "catalog:write")).toBe(true);
    expect(hasPermission("ADMIN", "settings:admin")).toBe(true);
  });

  it("restricts VIEWER to read-only permissions", () => {
    expect(hasPermission("VIEWER", "catalog:read")).toBe(true);
    expect(hasPermission("VIEWER", "catalog:write")).toBe(false);
    expect(hasPermission("VIEWER", "settings:admin")).toBe(false);
  });

  it("throws ForbiddenError on permission violation", () => {
    expect(() => assertPermission("CONTRIBUTOR", "settings:admin")).toThrow(ForbiddenError);
  });
});
