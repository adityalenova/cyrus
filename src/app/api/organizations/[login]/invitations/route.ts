/* ══ /api/organizations/[login]/invitations — Organization Invitations ═════
   GET  -> List pending invitations (requires manage_users)
   POST -> Create new invitation with assigned role (requires manage_users)
   ═════════════════════════════════════════════════════════════════════════ */
import {
  createOrgInvitation, ForbiddenError, isSystemRole, listOrgInvitations,
  requirePermission, UnauthorizedError, unauthorizedResponse, forbiddenResponse,
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

  try {
    await requirePermission("manage_users", orgId);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  const items = await listOrgInvitations(orgId);
  return Response.json({
    invitations: items.map((inv) => ({
      id: inv.id,
      orgId: inv.orgId,
      email: inv.email,
      role: inv.roleId,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
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

  let body: { email?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const role = typeof body.role === "string" ? body.role.trim() : null;

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email is required" }, { status: 400 });
  }

  if (!role || !isSystemRole(role)) {
    return Response.json({ error: "A valid role is required" }, { status: 400 });
  }

  if (role === "super_admin") {
    return forbiddenResponse("Cannot invite users to super_admin through organization invites");
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const invitation = await createOrgInvitation({
      actorId: user.id,
      orgId,
      email,
      role,
      ipAddress,
    });

    return Response.json({
      ok: true,
      invitation: {
        id: invitation.id,
        orgId: invitation.orgId,
        email: invitation.email,
        role: invitation.roleId,
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
