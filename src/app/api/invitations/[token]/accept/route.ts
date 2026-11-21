/* ══ /api/invitations/[token]/accept — Accept Organization Invitation ══════
   POST -> Accept invitation and receive assigned role in organization
   ═════════════════════════════════════════════════════════════════════════ */
import {
  acceptOrgInvitation, requireUserSession, UnauthorizedError, unauthorizedResponse,
} from "@/lib/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return Response.json({ error: "Missing invitation token" }, { status: 400 });

  let user;
  try {
    user = await requireUserSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    return Response.json({ error: "Failed to authenticate" }, { status: 500 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const result = await acceptOrgInvitation({
      token,
      userId: user.id,
      ipAddress,
    });

    return Response.json({
      ok: true,
      orgId: result.orgId,
      role: result.role,
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("expired")) {
      return Response.json({ error: message, code: "INVITATION_EXPIRED" }, { status: 410 });
    }
    if (message.includes("already been accepted")) {
      return Response.json({ error: message, code: "INVITATION_ALREADY_ACCEPTED" }, { status: 400 });
    }
    if (message.includes("not found")) {
      return Response.json({ error: message, code: "INVITATION_NOT_FOUND" }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
