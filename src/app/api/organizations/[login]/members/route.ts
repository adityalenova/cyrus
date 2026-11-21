/* ══ /api/organizations/[login]/members — Organization Member & Role Management ═
   GET    -> List members and roles (requires manage_users or org membership)
   POST   -> Assign or update role (requires manage_users)
   DELETE -> Revoke role (requires manage_users)
   ═════════════════════════════════════════════════════════════════════════════════ */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userRoles, users } from "@/lib/db/schema";
import {
  assignUserRole, ForbiddenError, getUserRoleInOrg, isSystemRole,
  requirePermission, requireUserSession, revokeUserRole,
  UnauthorizedError, unauthorizedResponse, forbiddenResponse,
  type SystemRole,
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

  // Must have a role in the organization or be super_admin to list members
  const actorRole = await getUserRoleInOrg(user.id, orgId);
  if (!actorRole) {
    return forbiddenResponse(`You are not a member of organization "${orgId}"`);
  }

  const db = getDb();
  if (!db) return Response.json({ error: "Database offline" }, { status: 503 });

  const rows = await db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
      roleId: userRoles.roleId,
      createdAt: userRoles.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        login: users.login,
        picture: users.picture,
      },
    })
    .from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(eq(userRoles.orgId, orgId));

  return Response.json({
    members: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.roleId as SystemRole,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  if (!orgId) return Response.json({ error: "Organization required" }, { status: 400 });

  let user;
  try {
    const auth = await requirePermission("manage_users", orgId);
    user = auth.user;
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  let body: { targetUserId?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : null;
  const role = typeof body.role === "string" ? body.role.trim() : null;

  if (!targetUserId || !role || !isSystemRole(role)) {
    return Response.json({ error: "Valid targetUserId and role are required" }, { status: 400 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const userRole = await assignUserRole({
      actorId: user.id,
      targetUserId,
      role,
      orgId,
      ipAddress,
    });

    return Response.json({ ok: true, userRole });
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  if (!orgId) return Response.json({ error: "Organization required" }, { status: 400 });

  let user;
  try {
    const auth = await requirePermission("manage_users", orgId);
    user = auth.user;
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  let body: { targetUserId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : null;
  if (!targetUserId) {
    return Response.json({ error: "targetUserId is required" }, { status: 400 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const revoked = await revokeUserRole({
      actorId: user.id,
      targetUserId,
      orgId,
      ipAddress,
    });

    if (!revoked) {
      return Response.json({ error: "Role assignment not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
