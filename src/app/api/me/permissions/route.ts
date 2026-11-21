/* ══ GET /api/me/permissions — current user's roles & permissions ══ */
import { currentUser } from "@/lib/server/auth";
import {
  getUserRoleAssignments, ROLE_PERMISSIONS_MAP,
  type SystemPermission,
} from "@/lib/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return Response.json({
      authenticated: false,
      roles: [],
      permissionsByOrg: {},
      globalPermissions: [],
    });
  }

  const assignments = await getUserRoleAssignments(user.id);
  const isSuperAdmin = assignments.some((a) => a.role === "super_admin");

  const permissionsByOrg: Record<string, SystemPermission[]> = {};
  for (const a of assignments) {
    if (a.orgId) {
      const perms = Array.from(ROLE_PERMISSIONS_MAP[a.role] ?? []);
      permissionsByOrg[a.orgId] = perms;
    }
  }

  const globalPermissions = isSuperAdmin
    ? Array.from(ROLE_PERMISSIONS_MAP.super_admin)
    : [];

  return Response.json({
    authenticated: true,
    userId: user.id,
    roles: assignments,
    permissionsByOrg,
    globalPermissions,
  });
}
