import { describe, it, expect } from "vitest";
import {
  canAssignRole, hasPermission, isSystemPermission, isSystemRole,
  roleHasPermission, ROLE_HIERARCHY, ROLE_PERMISSIONS_MAP,
  SYSTEM_PERMISSIONS, SYSTEM_ROLES, type SystemRole, type SystemPermission,
} from "../../src/lib/server/rbac";

describe("RBAC Role and Permission Logic", () => {
  it("defines the required 5 roles", () => {
    expect(SYSTEM_ROLES).toEqual([
      "super_admin",
      "org_admin",
      "maintainer",
      "contributor",
      "viewer",
    ]);
    for (const r of SYSTEM_ROLES) {
      expect(isSystemRole(r)).toBe(true);
    }
    expect(isSystemRole("hacker")).toBe(false);
  });

  it("defines the required 5 permissions", () => {
    expect(SYSTEM_PERMISSIONS).toEqual([
      "manage_users",
      "manage_org",
      "edit_projects",
      "view_analytics",
      "moderate",
    ]);
    for (const p of SYSTEM_PERMISSIONS) {
      expect(isSystemPermission(p)).toBe(true);
    }
    expect(isSystemPermission("delete_database")).toBe(false);
  });

  describe("Role-Permission Mappings (Least Privilege Defaults)", () => {
    it("super_admin has all 5 permissions", () => {
      const perms = ROLE_PERMISSIONS_MAP.super_admin;
      for (const p of SYSTEM_PERMISSIONS) {
        expect(perms.has(p)).toBe(true);
        expect(roleHasPermission("super_admin", p)).toBe(true);
        expect(hasPermission("super_admin", p)).toBe(true);
      }
    });

    it("org_admin has all 5 organization permissions", () => {
      const perms = ROLE_PERMISSIONS_MAP.org_admin;
      for (const p of SYSTEM_PERMISSIONS) {
        expect(perms.has(p)).toBe(true);
        expect(roleHasPermission("org_admin", p)).toBe(true);
        expect(hasPermission("org_admin", p)).toBe(true);
      }
    });

    it("maintainer has edit_projects, view_analytics, and moderate (least privilege)", () => {
      expect(roleHasPermission("maintainer", "edit_projects")).toBe(true);
      expect(roleHasPermission("maintainer", "view_analytics")).toBe(true);
      expect(roleHasPermission("maintainer", "moderate")).toBe(true);
      // Denied permissions
      expect(roleHasPermission("maintainer", "manage_users")).toBe(false);
      expect(roleHasPermission("maintainer", "manage_org")).toBe(false);
    });

    it("contributor has edit_projects and view_analytics (least privilege)", () => {
      expect(roleHasPermission("contributor", "edit_projects")).toBe(true);
      expect(roleHasPermission("contributor", "view_analytics")).toBe(true);
      // Denied permissions
      expect(roleHasPermission("contributor", "manage_users")).toBe(false);
      expect(roleHasPermission("contributor", "manage_org")).toBe(false);
      expect(roleHasPermission("contributor", "moderate")).toBe(false);
    });

    it("viewer has only view_analytics (least privilege)", () => {
      expect(roleHasPermission("viewer", "view_analytics")).toBe(true);
      // Denied permissions
      expect(roleHasPermission("viewer", "edit_projects")).toBe(false);
      expect(roleHasPermission("viewer", "manage_users")).toBe(false);
      expect(roleHasPermission("viewer", "manage_org")).toBe(false);
      expect(roleHasPermission("viewer", "moderate")).toBe(false);
    });

    it("returns false for invalid or unknown permissions", () => {
      expect(roleHasPermission("viewer", "unknown_perm" as SystemPermission)).toBe(false);
      expect(roleHasPermission("invalid_role" as SystemRole, "view_analytics")).toBe(false);
    });
  });

  describe("Role Hierarchy & Privilege Escalation Rules", () => {
    it("orders roles correctly by hierarchy rank", () => {
      expect(ROLE_HIERARCHY.super_admin).toBeGreaterThan(ROLE_HIERARCHY.org_admin);
      expect(ROLE_HIERARCHY.org_admin).toBeGreaterThan(ROLE_HIERARCHY.maintainer);
      expect(ROLE_HIERARCHY.maintainer).toBeGreaterThan(ROLE_HIERARCHY.contributor);
      expect(ROLE_HIERARCHY.contributor).toBeGreaterThan(ROLE_HIERARCHY.viewer);
    });

    it("allows super_admin to assign any role including super_admin", () => {
      for (const target of SYSTEM_ROLES) {
        expect(canAssignRole("super_admin", target)).toBe(true);
      }
    });

    it("allows org_admin to assign maintainer, contributor, viewer, and org_admin", () => {
      expect(canAssignRole("org_admin", "org_admin")).toBe(true);
      expect(canAssignRole("org_admin", "maintainer")).toBe(true);
      expect(canAssignRole("org_admin", "contributor")).toBe(true);
      expect(canAssignRole("org_admin", "viewer")).toBe(true);
    });

    it("prevents org_admin from assigning super_admin", () => {
      expect(canAssignRole("org_admin", "super_admin")).toBe(false);
    });

    it("prevents maintainer, contributor, and viewer from assigning any role", () => {
      const lowerRoles: SystemRole[] = ["maintainer", "contributor", "viewer"];
      for (const actor of lowerRoles) {
        for (const target of SYSTEM_ROLES) {
          expect(canAssignRole(actor, target)).toBe(false);
        }
      }
    });
  });
});
