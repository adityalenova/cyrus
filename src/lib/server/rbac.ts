/* ══ rbac.ts — Role-Based Access Control (RBAC) System ═════════════════
   Implements complete organization-scoped Role-Based Access Control:
   - 5 System Roles: super_admin, org_admin, maintainer, contributor, viewer
   - 5 System Permissions: manage_users, manage_org, edit_projects, view_analytics, moderate
   - Strict least-privilege defaults and organization scoping
   - Privilege escalation prevention (cannot self-promote or assign higher roles)
   - Persistent audit logging for role changes and invitations
   - Token-based org invitations with expiration and single-use enforcement
   - Backward-compatible types and guards for legacy tests
   ═════════════════════════════════════════════════════════════════════ */
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  invitations, roleAuditLogs,
  userRoles, users, orgs, type InvitationRow, type RoleAuditLogRow,
  type UserRoleRow, type UserRow,
} from "../db/schema";
import { currentUser } from "./auth";
import { dispatchAuditEvent, type AuditAction } from "./auditLog";

/* ── 1. Roles & Permissions Definitions ────────────────────────────── */

export const SYSTEM_ROLES = [
  "super_admin",
  "org_admin",
  "maintainer",
  "contributor",
  "viewer",
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const SYSTEM_PERMISSIONS = [
  "manage_users",
  "manage_org",
  "edit_projects",
  "view_analytics",
  "moderate",
] as const;
export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];

/* Legacy roles and permissions retained for backwards compatibility */
export type LegacyRole = "ADMIN" | "MAINTAINER" | "CONTRIBUTOR" | "VIEWER";
export type LegacyPermission =
  | "catalog:read"
  | "catalog:write"
  | "submissions:review"
  | "submissions:create"
  | "issues:manage"
  | "users:manage"
  | "settings:admin";

export type Role = SystemRole | LegacyRole;
export type Permission = SystemPermission | LegacyPermission;

export const ROLE_HIERARCHY: Record<SystemRole, number> = {
  super_admin: 100,
  org_admin: 80,
  maintainer: 60,
  contributor: 40,
  viewer: 20,
};

export const ROLE_PERMISSIONS_MAP: Record<SystemRole, ReadonlySet<SystemPermission>> = {
  super_admin: new Set(["manage_users", "manage_org", "edit_projects", "view_analytics", "moderate"]),
  org_admin: new Set(["manage_users", "manage_org", "edit_projects", "view_analytics", "moderate"]),
  maintainer: new Set(["edit_projects", "view_analytics", "moderate"]),
  contributor: new Set(["edit_projects", "view_analytics"]),
  viewer: new Set(["view_analytics"]),
};

const LEGACY_ROLE_PERMISSIONS: Record<LegacyRole, Set<LegacyPermission>> = {
  ADMIN: new Set([
    "catalog:read",
    "catalog:write",
    "submissions:review",
    "submissions:create",
    "issues:manage",
    "users:manage",
    "settings:admin",
  ]),
  MAINTAINER: new Set([
    "catalog:read",
    "catalog:write",
    "submissions:review",
    "submissions:create",
    "issues:manage",
  ]),
  CONTRIBUTOR: new Set([
    "catalog:read",
    "submissions:create",
  ]),
  VIEWER: new Set([
    "catalog:read",
  ]),
};

export const isSystemRole = (r: unknown): r is SystemRole =>
  typeof r === "string" && (SYSTEM_ROLES as readonly string[]).includes(r);

export const isSystemPermission = (p: unknown): p is SystemPermission =>
  typeof p === "string" && (SYSTEM_PERMISSIONS as readonly string[]).includes(p);

/* ── 2. Error Classes ──────────────────────────────────────────────── */

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(
    public readonly permission?: string,
    public readonly role?: string,
    message?: string,
  ) {
    super(message ?? `Permission denied: required "${permission ?? "valid permission"}"`);
    this.name = "ForbiddenError";
  }
}

export const unauthorizedResponse = (message = "Authentication required") =>
  Response.json({ error: message, code: "UNAUTHORIZED" }, { status: 401 });

export const forbiddenResponse = (message = "Permission denied") =>
  Response.json({ error: message, code: "FORBIDDEN" }, { status: 403 });

/* ── 3. Role Hierarchy & Privilege Escalation Checks ───────────────── */

/**
 * Checks whether an actor with actorRole can manage or assign targetRole.
 * Rule:
 * - super_admin can assign any role.
 * - org_admin can assign org_admin, maintainer, contributor, viewer (org-scoped).
 * - org_admin CANNOT assign super_admin.
 * - Roles below org_admin cannot assign any role.
 */
export function canAssignRole(actorRole: SystemRole, targetRole: SystemRole): boolean {
  if (actorRole === "super_admin") return true;
  if (targetRole === "super_admin") return false; // Non-super_admin can never assign super_admin
  if (actorRole === "org_admin") {
    return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[targetRole];
  }
  return false;
}

/**
 * Checks if a role has a given permission directly.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  if (isSystemRole(role) && isSystemPermission(permission)) {
    return Boolean(ROLE_PERMISSIONS_MAP[role]?.has(permission));
  }
  const legacySet = LEGACY_ROLE_PERMISSIONS[role as LegacyRole];
  if (legacySet) {
    return legacySet.has(permission as LegacyPermission);
  }
  return false;
}

/* ── 4. Overloaded Permission & Role Checkers ──────────────────────── */

/**
 * Synchronous permission check for a given role (backwards compatible with legacy tests).
 */
export function hasPermission(role: Role, permission: Permission): boolean;
/**
 * Asynchronous permission check for a user in an optional organization context.
 */
export function hasPermission(
  userId: string,
  permission: Permission,
  orgId?: string | null,
): Promise<boolean>;
export function hasPermission(
  roleOrUserId: string,
  permission: Permission,
  orgId?: string | null,
): boolean | Promise<boolean> {
  // If roleOrUserId is a known role name, evaluate synchronously
  if (isSystemRole(roleOrUserId) || roleOrUserId in LEGACY_ROLE_PERMISSIONS) {
    return roleHasPermission(roleOrUserId as Role, permission);
  }

  // Otherwise, treat as userId and query database asynchronously
  return (async () => {
    const role = await getUserRoleInOrg(roleOrUserId, orgId);
    if (!role) return false;
    return roleHasPermission(role, permission);
  })();
}

/**
 * Synchronous assert for legacy compatibility.
 */
export function assertPermission(role: Role, permission: Permission): void {
  if (!roleHasPermission(role, permission)) {
    throw new ForbiddenError(permission, role);
  }
}

/**
 * Checks whether a user possesses a specific role in an organization context.
 * A super_admin satisfies any role check globally.
 */
export async function hasRole(
  userId: string,
  role: Role,
  orgId?: string | null,
): Promise<boolean> {
  const currentRole = await getUserRoleInOrg(userId, orgId);
  if (!currentRole) return false;
  if (currentRole === "super_admin") return true;
  return currentRole === role;
}

/* ── 5. Database Role & Permission Retrieval ───────────────────────── */

/**
 * Resolves a user's effective role in an organization context:
 * 1. Checks if the user is a platform-wide super_admin (org_id is NULL).
 * 2. If orgId is specified, checks for an organization-scoped role.
 */
export async function getUserRoleInOrg(
  userId: string,
  orgId?: string | null,
): Promise<SystemRole | null> {
  const db = getDb();
  if (!db) return null;

  // Check global super_admin first
  const globalSuper = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, "super_admin"), isNull(userRoles.orgId)))
    .limit(1);

  if (globalSuper.length > 0 && isSystemRole(globalSuper[0].roleId)) {
    return "super_admin";
  }

  if (!orgId) return null;

  // Check org-specific role
  const orgRole = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.orgId, orgId)))
    .limit(1);

  if (orgRole.length > 0 && isSystemRole(orgRole[0].roleId)) {
    return orgRole[0].roleId;
  }

  return null;
}

/**
 * Retrieves all permissions a user has in an organization context.
 */
export async function getUserPermissions(
  userId: string,
  orgId?: string | null,
): Promise<SystemPermission[]> {
  const role = await getUserRoleInOrg(userId, orgId);
  if (!role) return [];
  const perms = ROLE_PERMISSIONS_MAP[role];
  return Array.from(perms);
}

/**
 * Retrieves all role assignments for a user across all organizations.
 */
export async function getUserRoleAssignments(
  userId: string,
): Promise<Array<{ role: SystemRole; orgId: string | null }>> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select({ roleId: userRoles.roleId, orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return rows
    .filter((r) => isSystemRole(r.roleId))
    .map((r) => ({ role: r.roleId as SystemRole, orgId: r.orgId }));
}

/* ── 6. Enforcing Guard Functions ──────────────────────────────────── */

/**
 * Ensures the request is authenticated with a valid user session.
 * Throws UnauthorizedError (401) if not logged in.
 */
export async function requireUserSession(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) {
    throw new UnauthorizedError("You must be signed in to perform this action");
  }
  return user;
}

/**
 * Server guard requiring a specific permission in an organization context.
 * Throws UnauthorizedError (401) or ForbiddenError (403).
 */
export async function requirePermission(
  permission: SystemPermission,
  orgId?: string | null,
): Promise<{ user: UserRow; role: SystemRole }> {
  const user = await requireUserSession();
  const role = await getUserRoleInOrg(user.id, orgId);

  if (!role || !roleHasPermission(role, permission)) {
    throw new ForbiddenError(
      permission,
      role ?? "none",
      `Requires "${permission}" permission in organization "${orgId ?? "global"}"`,
    );
  }

  return { user, role };
}

/**
 * Server guard requiring a specific role in an organization context.
 * Throws UnauthorizedError (401) or ForbiddenError (403).
 */
export async function requireRole(
  role: SystemRole,
  orgId?: string | null,
): Promise<{ user: UserRow; role: SystemRole }> {
  const user = await requireUserSession();
  const currentRole = await getUserRoleInOrg(user.id, orgId);

  if (!currentRole || (currentRole !== "super_admin" && currentRole !== role)) {
    throw new ForbiddenError(
      undefined,
      currentRole ?? "none",
      `Requires "${role}" role in organization "${orgId ?? "global"}"`,
    );
  }

  return { user, role: currentRole };
}

/* ── 7. Role Assignment & Revocation Operations ────────────────────── */

export async function assignUserRole(params: {
  actorId: string;
  targetUserId: string;
  role: SystemRole;
  orgId?: string | null;
  ipAddress?: string | null;
}): Promise<UserRoleRow> {
  const db = getDb();
  if (!db) throw new Error("Database offline");

  // Validate actor authority
  const actorRole = await getUserRoleInOrg(params.actorId, params.orgId);
  if (!actorRole) {
    throw new ForbiddenError(undefined, undefined, "Actor has no role in this organization");
  }

  // Prevent unauthorized assignment of super_admin
  if (params.role === "super_admin" && actorRole !== "super_admin") {
    throw new ForbiddenError(
      "manage_users",
      actorRole,
      "Only existing super_admins can assign the super_admin role",
    );
  }

  // Prevent privilege escalation: actor must be able to assign the target role
  if (!canAssignRole(actorRole, params.role)) {
    throw new ForbiddenError(
      "manage_users",
      actorRole,
      `Cannot assign role "${params.role}" exceeding or equal to your authority`,
    );
  }

  // Prevent users from escalating their own privileges
  if (params.actorId === params.targetUserId && actorRole !== "super_admin") {
    throw new ForbiddenError(undefined, actorRole, "Self-privilege modification is prohibited");
  }

  // Verify target user exists
  const targetUser = await db.select().from(users).where(eq(users.id, params.targetUserId)).limit(1);
  if (targetUser.length === 0) {
    throw new Error("Target user not found");
  }

  // If orgId is provided, verify organization exists
  if (params.orgId) {
    const targetOrg = await db.select().from(orgs).where(eq(orgs.login, params.orgId)).limit(1);
    if (targetOrg.length === 0) {
      throw new Error(`Organization "${params.orgId}" not found`);
    }
  }

  // Find previous role
  const existing = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, params.targetUserId),
        params.orgId ? eq(userRoles.orgId, params.orgId) : isNull(userRoles.orgId),
      ),
    )
    .limit(1);

  const previousRole = existing[0]?.roleId ?? null;

  let assignedRow: UserRoleRow;
  if (existing.length > 0) {
    const updated = await db
      .update(userRoles)
      .set({ roleId: params.role, updatedAt: new Date() })
      .where(eq(userRoles.id, existing[0].id))
      .returning();
    assignedRow = updated[0];
  } else {
    const inserted = await db
      .insert(userRoles)
      .values({
        userId: params.targetUserId,
        roleId: params.role,
        orgId: params.orgId ?? null,
      })
      .returning();
    assignedRow = inserted[0];
  }

  // Audit logging
  await recordAuditLog({
    actorId: params.actorId,
    targetUserId: params.targetUserId,
    orgId: params.orgId ?? null,
    previousRole,
    newRole: params.role,
    action: previousRole ? "UPDATE_ROLE" : "ASSIGN_ROLE",
    ipAddress: params.ipAddress ?? null,
  });

  return assignedRow;
}

export async function revokeUserRole(params: {
  actorId: string;
  targetUserId: string;
  orgId?: string | null;
  ipAddress?: string | null;
}): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database offline");

  const actorRole = await getUserRoleInOrg(params.actorId, params.orgId);
  if (!actorRole) {
    throw new ForbiddenError(undefined, undefined, "Actor has no role in this organization");
  }

  const existing = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, params.targetUserId),
        params.orgId ? eq(userRoles.orgId, params.orgId) : isNull(userRoles.orgId),
      ),
    )
    .limit(1);

  if (existing.length === 0) return false;
  const targetRole = existing[0].roleId as SystemRole;

  // Cannot revoke someone with higher authority unless actor is super_admin
  if (actorRole !== "super_admin" && ROLE_HIERARCHY[actorRole] < ROLE_HIERARCHY[targetRole]) {
    throw new ForbiddenError(undefined, actorRole, "Cannot revoke a role higher than your own");
  }

  await db.delete(userRoles).where(eq(userRoles.id, existing[0].id));

  await recordAuditLog({
    actorId: params.actorId,
    targetUserId: params.targetUserId,
    orgId: params.orgId ?? null,
    previousRole: targetRole,
    newRole: null,
    action: "REVOKE_ROLE",
    ipAddress: params.ipAddress ?? null,
  });

  return true;
}

/* ── 8. Organization Invitations ───────────────────────────────────── */

export async function createOrgInvitation(params: {
  actorId: string;
  orgId: string;
  email: string;
  role: SystemRole;
  ipAddress?: string | null;
}): Promise<InvitationRow> {
  const db = getDb();
  if (!db) throw new Error("Database offline");

  const actorRole = await getUserRoleInOrg(params.actorId, params.orgId);
  if (!actorRole || !roleHasPermission(actorRole, "manage_users")) {
    throw new ForbiddenError("manage_users", actorRole ?? "none", "Actor cannot invite users to this org");
  }

  if (params.role === "super_admin") {
    throw new ForbiddenError("manage_users", actorRole, "Organization invitations cannot grant super_admin");
  }

  if (!canAssignRole(actorRole, params.role)) {
    throw new ForbiddenError("manage_users", actorRole, `Cannot invite user to role "${params.role}"`);
  }

  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000); // 7 days

  const inserted = await db
    .insert(invitations)
    .values({
      orgId: params.orgId,
      email: params.email.toLowerCase().trim(),
      roleId: params.role,
      invitedBy: params.actorId,
      expiresAt,
    })
    .returning();

  await recordAuditLog({
    actorId: params.actorId,
    orgId: params.orgId,
    previousRole: null,
    newRole: params.role,
    action: "CREATE_INVITATION",
    ipAddress: params.ipAddress ?? null,
    details: { invitedEmail: params.email.toLowerCase().trim() },
  });

  return inserted[0];
}

export async function acceptOrgInvitation(params: {
  token: string;
  userId: string;
  ipAddress?: string | null;
}): Promise<{ invitation: InvitationRow; role: SystemRole; orgId: string }> {
  const db = getDb();
  if (!db) throw new Error("Database offline");

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, params.token))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Invitation not found or invalid token");
  }

  const inv = rows[0];

  if (inv.acceptedAt) {
    throw new Error("Invitation has already been accepted and cannot be reused");
  }

  if (new Date() > inv.expiresAt) {
    throw new Error("Invitation has expired");
  }

  const targetRole = inv.roleId as SystemRole;

  // Find previous role in org
  const existingRole = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, params.userId), eq(userRoles.orgId, inv.orgId)))
    .limit(1);

  const previousRole = existingRole[0]?.roleId ?? null;

  if (existingRole.length > 0) {
    await db
      .update(userRoles)
      .set({ roleId: targetRole, updatedAt: new Date() })
      .where(eq(userRoles.id, existingRole[0].id));
  } else {
    await db.insert(userRoles).values({
      userId: params.userId,
      roleId: targetRole,
      orgId: inv.orgId,
    });
  }

  // Mark invitation accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, inv.id));

  await recordAuditLog({
    actorId: params.userId,
    targetUserId: params.userId,
    orgId: inv.orgId,
    previousRole,
    newRole: targetRole,
    action: "ACCEPT_INVITATION",
    ipAddress: params.ipAddress ?? null,
  });

  return { invitation: inv, role: targetRole, orgId: inv.orgId };
}

export async function revokeOrgInvitation(params: {
  actorId: string;
  invitationId: string;
  orgId: string;
  ipAddress?: string | null;
}): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database offline");

  const actorRole = await getUserRoleInOrg(params.actorId, params.orgId);
  if (!actorRole || !roleHasPermission(actorRole, "manage_users")) {
    throw new ForbiddenError("manage_users", actorRole ?? "none", "Actor cannot revoke invitations");
  }

  const rows = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, params.invitationId), eq(invitations.orgId, params.orgId)))
    .limit(1);

  if (rows.length === 0) return false;

  await db.delete(invitations).where(eq(invitations.id, params.invitationId));

  await recordAuditLog({
    actorId: params.actorId,
    orgId: params.orgId,
    previousRole: rows[0].roleId,
    newRole: null,
    action: "REVOKE_INVITATION",
    ipAddress: params.ipAddress ?? null,
  });

  return true;
}

export async function listOrgInvitations(orgId: string): Promise<InvitationRow[]> {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(invitations)
    .where(and(eq(invitations.orgId, orgId), isNull(invitations.acceptedAt)))
    .orderBy(desc(invitations.createdAt));
}

/* ── 9. Persistent Audit Logging ───────────────────────────────────── */

export async function recordAuditLog(params: {
  actorId: string | null;
  targetUserId?: string | null;
  orgId?: string | null;
  previousRole?: string | null;
  newRole?: string | null;
  action: string;
  ipAddress?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  if (db) {
    try {
      await db.insert(roleAuditLogs).values({
        actorId: params.actorId ?? null,
        targetUserId: params.targetUserId ?? null,
        orgId: params.orgId ?? null,
        previousRole: params.previousRole ?? null,
        newRole: params.newRole ?? null,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
        details: params.details ?? null,
      });
    } catch (err) {
      console.error("[RBAC AUDIT ERROR] Failed to write audit record:", err);
    }
  }

  // Also dispatch to security event logger
  await dispatchAuditEvent({
    actorId: params.actorId ?? "system",
    ipAddress: params.ipAddress ?? "internal",
    action: "ROLE_CHANGE" as AuditAction,
    targetId: params.targetUserId ?? params.orgId ?? undefined,
    targetType: params.orgId ? "organization" : "user",
    details: {
      action: params.action,
      previousRole: params.previousRole,
      newRole: params.newRole,
      orgId: params.orgId,
      ...params.details,
    },
    timestamp: new Date().toISOString(),
  });
}

export async function listOrgAuditLogs(
  orgId?: string | null,
  limit = 50,
): Promise<RoleAuditLogRow[]> {
  const db = getDb();
  if (!db) return [];

  const query = db.select().from(roleAuditLogs);
  if (orgId) {
    return query
      .where(eq(roleAuditLogs.orgId, orgId))
      .orderBy(desc(roleAuditLogs.createdAt))
      .limit(limit);
  }

  return query.orderBy(desc(roleAuditLogs.createdAt)).limit(limit);
}
