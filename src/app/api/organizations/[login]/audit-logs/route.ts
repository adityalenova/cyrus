/* ══ /api/organizations/[login]/audit-logs — Organization Permission Audit Logs ═
   GET -> List persistent audit logs for role & permission changes
   Requires manage_org or manage_users permission.
   ═════════════════════════════════════════════════════════════════════════ */
import {
  getUserRoleInOrg, listOrgAuditLogs, requireUserSession,
  roleHasPermission, UnauthorizedError, unauthorizedResponse, forbiddenResponse,
} from "@/lib/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  if (!orgId) return Response.json({ error: "Organization required" }, { status: 400 });

  let user;
  try {
    user = await requireUserSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    return Response.json({ error: "Failed to authenticate" }, { status: 500 });
  }

  const role = await getUserRoleInOrg(user.id, orgId);
  const authorized = role && (
    role === "super_admin" ||
    roleHasPermission(role, "manage_org") ||
    roleHasPermission(role, "manage_users")
  );

  if (!authorized) {
    return forbiddenResponse("Requires manage_org or manage_users permission to view audit logs");
  }

  const logs = await listOrgAuditLogs(orgId, 100);

  return Response.json({
    logs: logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      targetUserId: l.targetUserId,
      orgId: l.orgId,
      previousRole: l.previousRole,
      newRole: l.newRole,
      action: l.action,
      ipAddress: l.ipAddress,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
