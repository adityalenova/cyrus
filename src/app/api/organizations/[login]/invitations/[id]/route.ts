/* ══ /api/organizations/[login]/invitations/[id] — Revoke Invitation ═══════
   DELETE -> Revoke pending invitation (requires manage_users)
   ═════════════════════════════════════════════════════════════════════════ */
import {
  ForbiddenError, requirePermission, revokeOrgInvitation,
  UnauthorizedError, unauthorizedResponse, forbiddenResponse,
} from "@/lib/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ login: string; id: string }> },
) {
  const { login, id } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  const invitationId = decodeURIComponent(id ?? "").trim();

  if (!orgId || !invitationId) {
    return Response.json({ error: "Missing organization or invitation id" }, { status: 400 });
  }

  let user;
  try {
    const auth = await requirePermission("manage_users", orgId);
    user = auth.user;
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const revoked = await revokeOrgInvitation({
      actorId: user.id,
      invitationId,
      orgId,
      ipAddress,
    });

    if (!revoked) {
      return Response.json({ error: "Invitation not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
