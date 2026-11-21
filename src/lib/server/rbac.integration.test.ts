import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import * as schema from "../db/schema";
import { seedRbac } from "../db/seed";
import { setSession } from "./auth";
import {
  acceptOrgInvitation, assignUserRole, canAssignRole, createOrgInvitation,
  ForbiddenError, getUserPermissions, getUserRoleInOrg, hasPermission,
  hasRole, listOrgAuditLogs, requirePermission, requireRole,
  requireUserSession, revokeOrgInvitation, revokeUserRole,
  UnauthorizedError,
} from "./rbac";
import { GET as getMembers, POST as postMember, DELETE as deleteMember } from "@/app/api/organizations/[login]/members/route";
import { GET as getInvitations, POST as postInvitation } from "@/app/api/organizations/[login]/invitations/route";
import { DELETE as deleteInvitation } from "@/app/api/organizations/[login]/invitations/[id]/route";
import { POST as acceptInviteRoute } from "@/app/api/invitations/[token]/accept/route";
import { GET as getOrgAnalytics } from "@/app/api/organizations/[login]/analytics/route";
import { PATCH as patchOrg } from "@/app/api/organizations/[login]/route";
import { POST as postRepo, DELETE as deleteRepo } from "@/app/api/organizations/[login]/repos/route";
import { GET as getSubmissions, POST as postSubmission } from "@/app/api/submissions/route";
import { GET as getMyPermissions } from "@/app/api/me/permissions/route";

const state = vi.hoisted(() => ({ db: null as Db | null, cookie: "" }));
vi.mock("../db", () => ({
  getDb: () => state.db,
  dbReady: () => Boolean(state.db),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    set: (_name: string, value: string) => { state.cookie = value; },
    delete: () => { state.cookie = ""; },
  }),
}));

let client: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;

let superUserId: string;
let alphaAdminId: string;
let alphaMaintainerId: string;
let alphaContributorId: string;
let alphaViewerId: string;
let betaAdminId: string;
let outsideUserId: string;

beforeAll(async () => {
  client = new PGlite();
  await client.waitReady;

  for (const file of [
    "0000_volatile_forge.sql",
    "0001_rare_reaper.sql",
    "0003_bookmark_collections.sql",
    "0004_wooden_shockwave.sql",
  ]) {
    await client.exec(await readFile(new URL(`../../../drizzle/${file}`, import.meta.url), "utf8"));
  }

  database = drizzle(client, { schema });
  state.db = database as unknown as Db;
  vi.stubEnv("SESSION_SECRET", "local-rbac-integration-test-secret-189");
  vi.stubEnv("DATABASE_URL", "postgresql://in-memory-pglite");

  await seedRbac(state.db);
});

afterAll(async () => {
  state.db = null;
  await client?.close();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  state.cookie = "";
  await client.exec('TRUNCATE "role_audit_logs", "invitations", "user_roles", "org_repos", "orgs", "users", "submissions" CASCADE');

  // Insert test organizations
  await database.insert(schema.orgs).values([
    { login: "org-alpha", name: "Alpha Foundation", snapshot: "2026-11-21" },
    { login: "org-beta", name: "Beta Consortium", snapshot: "2026-11-21" },
  ]);

  // Insert test users
  const userRows = await database.insert(schema.users).values([
    { provider: "email", providerId: "super", name: "Super User", email: "super@cyrus.test" },
    { provider: "email", providerId: "admin-a", name: "Alpha Admin", email: "admin@alpha.test" },
    { provider: "email", providerId: "maint-a", name: "Alpha Maintainer", email: "maint@alpha.test" },
    { provider: "email", providerId: "contrib-a", name: "Alpha Contributor", email: "contrib@alpha.test" },
    { provider: "email", providerId: "view-a", name: "Alpha Viewer", email: "view@alpha.test" },
    { provider: "email", providerId: "admin-b", name: "Beta Admin", email: "admin@beta.test" },
    { provider: "email", providerId: "outside", name: "Outside User", email: "outside@example.test" },
  ]).returning();

  superUserId = userRows[0].id;
  alphaAdminId = userRows[1].id;
  alphaMaintainerId = userRows[2].id;
  alphaContributorId = userRows[3].id;
  alphaViewerId = userRows[4].id;
  betaAdminId = userRows[5].id;
  outsideUserId = userRows[6].id;

  // Assign roles in user_roles
  await database.insert(schema.userRoles).values([
    // Global super_admin (orgId is null)
    { userId: superUserId, roleId: "super_admin", orgId: null },
    // Alpha organization roles
    { userId: alphaAdminId, roleId: "org_admin", orgId: "org-alpha" },
    { userId: alphaMaintainerId, roleId: "maintainer", orgId: "org-alpha" },
    { userId: alphaContributorId, roleId: "contributor", orgId: "org-alpha" },
    { userId: alphaViewerId, roleId: "viewer", orgId: "org-alpha" },
    // Beta organization roles
    { userId: betaAdminId, roleId: "org_admin", orgId: "org-beta" },
  ]);
});

const sign = (id: string, name = "Test User") => setSession({ uid: id, name, provider: "email" });

describe("Database RBAC Integration", () => {
  describe("Role & Organization Scoping", () => {
    it("resolves roles correctly with organization boundaries", async () => {
      // Global super_admin resolves in any org context and globally
      expect(await getUserRoleInOrg(superUserId, null)).toBe("super_admin");
      expect(await getUserRoleInOrg(superUserId, "org-alpha")).toBe("super_admin");
      expect(await getUserRoleInOrg(superUserId, "org-beta")).toBe("super_admin");

      // Alpha admin only has org_admin in org-alpha
      expect(await getUserRoleInOrg(alphaAdminId, "org-alpha")).toBe("org_admin");
      expect(await getUserRoleInOrg(alphaAdminId, "org-beta")).toBeNull();
      expect(await getUserRoleInOrg(alphaAdminId, null)).toBeNull();

      // Outside user has no role anywhere
      expect(await getUserRoleInOrg(outsideUserId, "org-alpha")).toBeNull();
      expect(await getUserRoleInOrg(outsideUserId, "org-beta")).toBeNull();
    });

    it("evaluates hasRole properly across organization boundaries", async () => {
      expect(await hasRole(alphaAdminId, "org_admin", "org-alpha")).toBe(true);
      expect(await hasRole(alphaAdminId, "org_admin", "org-beta")).toBe(false);
      expect(await hasRole(alphaMaintainerId, "maintainer", "org-alpha")).toBe(true);
      expect(await hasRole(alphaMaintainerId, "org_admin", "org-alpha")).toBe(false);
      // super_admin satisfies any role check
      expect(await hasRole(superUserId, "org_admin", "org-alpha")).toBe(true);
    });

    it("evaluates hasPermission with organization scoping and least privilege", async () => {
      // org_admin has all 5 permissions in org-alpha
      expect(await hasPermission(alphaAdminId, "manage_users", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaAdminId, "manage_org", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaAdminId, "edit_projects", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaAdminId, "view_analytics", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaAdminId, "moderate", "org-alpha")).toBe(true);

      // cross-org: org_admin of Alpha has NO permissions in Beta
      expect(await hasPermission(alphaAdminId, "manage_users", "org-beta")).toBe(false);
      expect(await hasPermission(alphaAdminId, "view_analytics", "org-beta")).toBe(false);

      // maintainer permissions
      expect(await hasPermission(alphaMaintainerId, "edit_projects", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaMaintainerId, "view_analytics", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaMaintainerId, "moderate", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaMaintainerId, "manage_users", "org-alpha")).toBe(false);
      expect(await hasPermission(alphaMaintainerId, "manage_org", "org-alpha")).toBe(false);

      // contributor permissions
      expect(await hasPermission(alphaContributorId, "edit_projects", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaContributorId, "view_analytics", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaContributorId, "moderate", "org-alpha")).toBe(false);
      expect(await hasPermission(alphaContributorId, "manage_users", "org-alpha")).toBe(false);

      // viewer permissions
      expect(await hasPermission(alphaViewerId, "view_analytics", "org-alpha")).toBe(true);
      expect(await hasPermission(alphaViewerId, "edit_projects", "org-alpha")).toBe(false);
      expect(await hasPermission(alphaViewerId, "moderate", "org-alpha")).toBe(false);

      // non-member has no permissions
      expect(await hasPermission(outsideUserId, "view_analytics", "org-alpha")).toBe(false);
    });

    it("returns correct permission lists from getUserPermissions", async () => {
      const perms = await getUserPermissions(alphaMaintainerId, "org-alpha");
      expect(perms).toContain("edit_projects");
      expect(perms).toContain("view_analytics");
      expect(perms).toContain("moderate");
      expect(perms).not.toContain("manage_users");
    });
  });

  describe("Security & Privilege Escalation Prevention", () => {
    it("allows org_admin to assign maintainer to another user", async () => {
      const result = await assignUserRole({
        actorId: alphaAdminId,
        targetUserId: outsideUserId,
        role: "maintainer",
        orgId: "org-alpha",
      });
      expect(result.roleId).toBe("maintainer");
      expect(await hasRole(outsideUserId, "maintainer", "org-alpha")).toBe(true);
    });

    it("prevents org_admin from assigning super_admin (escalation prevention)", async () => {
      await expect(
        assignUserRole({
          actorId: alphaAdminId,
          targetUserId: outsideUserId,
          role: "super_admin",
          orgId: "org-alpha",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("prevents cross-organization role assignment", async () => {
      // Alpha admin cannot assign roles in Beta
      await expect(
        assignUserRole({
          actorId: alphaAdminId,
          targetUserId: outsideUserId,
          role: "contributor",
          orgId: "org-beta",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("prevents maintainer or contributor from assigning roles", async () => {
      await expect(
        assignUserRole({
          actorId: alphaMaintainerId,
          targetUserId: outsideUserId,
          role: "viewer",
          orgId: "org-alpha",
        }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        assignUserRole({
          actorId: alphaContributorId,
          targetUserId: outsideUserId,
          role: "viewer",
          orgId: "org-alpha",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("prevents self-privilege escalation", async () => {
      await expect(
        assignUserRole({
          actorId: alphaMaintainerId,
          targetUserId: alphaMaintainerId,
          role: "org_admin",
          orgId: "org-alpha",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("allows revoking role and prevents unauthorized revocation", async () => {
      // Admin revoking contributor
      expect(
        await revokeUserRole({
          actorId: alphaAdminId,
          targetUserId: alphaContributorId,
          orgId: "org-alpha",
        }),
      ).toBe(true);
      expect(await hasRole(alphaContributorId, "contributor", "org-alpha")).toBe(false);

      // Contributor cannot revoke maintainer or admin
      await expect(
        revokeUserRole({
          actorId: alphaViewerId,
          targetUserId: alphaAdminId,
          orgId: "org-alpha",
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Organization Invitations", () => {
    it("creates, accepts, and binds invitations to the organization", async () => {
      const inv = await createOrgInvitation({
        actorId: alphaAdminId,
        orgId: "org-alpha",
        email: "invited@test.com",
        role: "maintainer",
      });

      expect(inv.token).toBeDefined();
      expect(inv.orgId).toBe("org-alpha");
      expect(inv.roleId).toBe("maintainer");

      // User accepts invitation
      const accepted = await acceptOrgInvitation({
        token: inv.token,
        userId: outsideUserId,
      });

      expect(accepted.orgId).toBe("org-alpha");
      expect(accepted.role).toBe("maintainer");
      expect(await hasRole(outsideUserId, "maintainer", "org-alpha")).toBe(true);
    });

    it("rejects invitation creation for super_admin through organization invites", async () => {
      await expect(
        createOrgInvitation({
          actorId: alphaAdminId,
          orgId: "org-alpha",
          email: "superinvite@test.com",
          role: "super_admin",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("prevents reuse of an already accepted invitation token", async () => {
      const inv = await createOrgInvitation({
        actorId: alphaAdminId,
        orgId: "org-alpha",
        email: "singleuse@test.com",
        role: "viewer",
      });

      await acceptOrgInvitation({ token: inv.token, userId: outsideUserId });

      // Second attempt must fail
      await expect(
        acceptOrgInvitation({ token: inv.token, userId: outsideUserId }),
      ).rejects.toThrow(/already been accepted/);
    });

    it("rejects expired invitations", async () => {
      const inv = await createOrgInvitation({
        actorId: alphaAdminId,
        orgId: "org-alpha",
        email: "expired@test.com",
        role: "viewer",
      });

      // Force expiration in DB
      await database
        .update(schema.invitations)
        .set({ expiresAt: new Date(Date.now() - 10000) })
        .where(eq(schema.invitations.id, inv.id));

      await expect(
        acceptOrgInvitation({ token: inv.token, userId: outsideUserId }),
      ).rejects.toThrow(/expired/);
    });

    it("allows revoking an invitation", async () => {
      const inv = await createOrgInvitation({
        actorId: alphaAdminId,
        orgId: "org-alpha",
        email: "revoke@test.com",
        role: "contributor",
      });

      const revoked = await revokeOrgInvitation({
        actorId: alphaAdminId,
        invitationId: inv.id,
        orgId: "org-alpha",
      });
      expect(revoked).toBe(true);

      // Subsequent accept must fail
      await expect(
        acceptOrgInvitation({ token: inv.token, userId: outsideUserId }),
      ).rejects.toThrow(/not found/);
    });
  });

  describe("Persistent Audit Logging", () => {
    it("records persistent audit logs for role modifications", async () => {
      await assignUserRole({
        actorId: alphaAdminId,
        targetUserId: outsideUserId,
        role: "maintainer",
        orgId: "org-alpha",
        ipAddress: "192.168.1.10",
      });

      const logs = await listOrgAuditLogs("org-alpha");
      expect(logs.length).toBeGreaterThan(0);
      const log = logs[0];
      expect(log.actorId).toBe(alphaAdminId);
      expect(log.targetUserId).toBe(outsideUserId);
      expect(log.orgId).toBe("org-alpha");
      expect(log.newRole).toBe("maintainer");
      expect(log.action).toBe("ASSIGN_ROLE");
      expect(log.ipAddress).toBe("192.168.1.10");
    });
  });

  describe("API Route Integration", () => {
    it("enforces authentication (401) on members endpoints", async () => {
      // Signed out
      const res = await getMembers(new Request("http://x"), { params: Promise.resolve({ login: "org-alpha" }) });
      expect(res.status).toBe(401);

      const postRes = await postMember(
        new Request("http://x", { method: "POST", body: JSON.stringify({ targetUserId: outsideUserId, role: "viewer" }) }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(postRes.status).toBe(401);
    });

    it("enforces authorization (403) on members endpoints for unauthorized users", async () => {
      // Outside user trying to view or assign
      await sign(outsideUserId);
      const res = await getMembers(new Request("http://x"), { params: Promise.resolve({ login: "org-alpha" }) });
      expect(res.status).toBe(403);

      const postRes = await postMember(
        new Request("http://x", { method: "POST", body: JSON.stringify({ targetUserId: outsideUserId, role: "viewer" }) }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(postRes.status).toBe(403);
    });

    it("allows authorized org_admin to list, assign, and revoke members", async () => {
      await sign(alphaAdminId);

      // List members
      const listRes = await getMembers(new Request("http://x"), { params: Promise.resolve({ login: "org-alpha" }) });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.members.length).toBeGreaterThanOrEqual(4);

      // Assign role
      const postRes = await postMember(
        new Request("http://x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetUserId: outsideUserId, role: "maintainer" }),
        }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(postRes.status).toBe(200);

      // Revoke role
      const delRes = await deleteMember(
        new Request("http://x", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetUserId: outsideUserId }),
        }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(delRes.status).toBe(200);
    });

    it("protects organization analytics with view_analytics permission", async () => {
      // Signed out -> 401
      const res401 = await getOrgAnalytics(new Request("http://x"), { params: Promise.resolve({ login: "org-alpha" }) });
      expect(res401.status).toBe(401);

      // Outside user -> 403
      await sign(outsideUserId);
      const res403 = await getOrgAnalytics(new Request("http://x"), { params: Promise.resolve({ login: "org-alpha" }) });
      expect(res403.status).toBe(403);

      // Viewer in org-alpha -> 200
      await sign(alphaViewerId);
      const res200 = await getOrgAnalytics(new Request("http://x"), { params: Promise.resolve({ login: "org-alpha" }) });
      expect(res200.status).toBe(200);
      const data = await res200.json();
      expect(data.orgId).toBe("org-alpha");
      expect(data.totalMembers).toBeGreaterThan(0);
    });

    it("protects organization profile patching with manage_org permission", async () => {
      // Contributor -> 403
      await sign(alphaContributorId);
      const res403 = await patchOrg(
        new Request("http://x", { method: "PATCH", body: JSON.stringify({ tagline: "New tagline" }) }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(res403.status).toBe(403);

      // Admin -> 200
      await sign(alphaAdminId);
      const res200 = await patchOrg(
        new Request("http://x", { method: "PATCH", body: JSON.stringify({ tagline: "Updated tagline" }) }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(res200.status).toBe(200);
      const data = await res200.json();
      expect(data.org.tagline).toBe("Updated tagline");
    });

    it("protects project/repo modifications with edit_projects permission", async () => {
      // Viewer -> 403
      await sign(alphaViewerId);
      const res403 = await postRepo(
        new Request("http://x", { method: "POST", body: JSON.stringify({ repo: "test-repo", url: "https://github.com/org-alpha/test-repo" }) }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(res403.status).toBe(403);

      // Contributor -> 200
      await sign(alphaContributorId);
      const res200 = await postRepo(
        new Request("http://x", { method: "POST", body: JSON.stringify({ repo: "test-repo", url: "https://github.com/org-alpha/test-repo" }) }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(res200.status).toBe(200);
    });

    it("protects submissions moderation while leaving public POST open", async () => {
      // Public POST remains open without session
      const postRes = await postSubmission(
        new Request("http://x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "feedback", payload: { note: "Great platform" } }),
        }),
      );
      expect(postRes.status).toBe(200);

      // GET submissions (moderation inbox) requires moderate permission
      // Outside user -> 403
      await sign(outsideUserId);
      const getRes403 = await getSubmissions();
      expect(getRes403.status).toBe(403);

      // Super admin -> 200
      await sign(superUserId);
      const getRes200 = await getSubmissions();
      expect(getRes200.status).toBe(200);
    });

    it("accepts invitations through the accept API route", async () => {
      const inv = await createOrgInvitation({
        actorId: alphaAdminId,
        orgId: "org-alpha",
        email: "route-accept@test.com",
        role: "contributor",
      });

      // Unauthenticated -> 401
      const res401 = await acceptInviteRoute(new Request("http://x", { method: "POST" }), {
        params: Promise.resolve({ token: inv.token }),
      });
      expect(res401.status).toBe(401);

      // Authenticated -> 200
      await sign(outsideUserId);
      const res200 = await acceptInviteRoute(new Request("http://x", { method: "POST" }), {
        params: Promise.resolve({ token: inv.token }),
      });
      expect(res200.status).toBe(200);
      const data = await res200.json();
      expect(data.role).toBe("contributor");
      expect(data.orgId).toBe("org-alpha");
    });

    it("returns user permissions through GET /api/me/permissions", async () => {
      await sign(alphaAdminId);
      const res = await getMyPermissions();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.userId).toBe(alphaAdminId);
      expect(data.permissionsByOrg["org-alpha"]).toContain("manage_users");
      expect(data.permissionsByOrg["org-alpha"]).toContain("manage_org");
    });

    it("manages invitations through the invitations API routes", async () => {
      await sign(alphaAdminId);

      // Create invite
      const postRes = await postInvitation(
        new Request("http://x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "invite-api@test.com", role: "maintainer" }),
        }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.invitation.email).toBe("invite-api@test.com");

      // List invites
      const listRes = await getInvitations(new Request("http://x"), {
        params: Promise.resolve({ login: "org-alpha" }),
      });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.invitations.length).toBeGreaterThanOrEqual(1);

      // Revoke invite
      const delRes = await deleteInvitation(new Request("http://x", { method: "DELETE" }), {
        params: Promise.resolve({ login: "org-alpha", id: postData.invitation.id }),
      });
      expect(delRes.status).toBe(200);
    });

    it("allows removing organization repos through the repos API route", async () => {
      await sign(alphaContributorId);
      await postRepo(
        new Request("http://x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repo: "del-repo", url: "https://github.com/org-alpha/del-repo" }),
        }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );

      const delRes = await deleteRepo(
        new Request("http://x", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repo: "del-repo" }),
        }),
        { params: Promise.resolve({ login: "org-alpha" }) },
      );
      expect(delRes.status).toBe(200);
    });

    it("evaluates server guards requireUserSession, requirePermission, and requireRole", async () => {
      // Unauthenticated guard check
      await expect(requireUserSession()).rejects.toThrow(UnauthorizedError);

      await sign(alphaAdminId);
      const user = await requireUserSession();
      expect(user.id).toBe(alphaAdminId);

      const permRes = await requirePermission("manage_users", "org-alpha");
      expect(permRes.role).toBe("org_admin");

      const roleRes = await requireRole("org_admin", "org-alpha");
      expect(roleRes.role).toBe("org_admin");

      expect(canAssignRole("org_admin", "viewer")).toBe(true);
    });
  });
});
