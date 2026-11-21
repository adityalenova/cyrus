/* ══ /api/organizations/[login] — Organization Management & Profile Updates ═
   PATCH -> Update organization profile and metadata
   Requires manage_org permission.
   ═════════════════════════════════════════════════════════════════════════ */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import {
  ForbiddenError, requirePermission, UnauthorizedError,
  unauthorizedResponse, forbiddenResponse,
} from "@/lib/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  if (!orgId) return Response.json({ error: "Organization required" }, { status: 400 });

  try {
    await requirePermission("manage_org", orgId);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "Database offline" }, { status: 503 });

  let body: { tagline?: unknown; domain?: unknown; level?: unknown; location?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updateSet: Record<string, unknown> = {};
  if (typeof body.tagline === "string") updateSet.tagline = body.tagline.slice(0, 300);
  if (typeof body.domain === "string") updateSet.domain = body.domain.slice(0, 100);
  if (typeof body.location === "string") updateSet.location = body.location.slice(0, 100);
  if (typeof body.level === "string" && ["beginner", "intermediate", "advanced"].includes(body.level)) {
    updateSet.level = body.level;
  }

  if (Object.keys(updateSet).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await db
    .update(orgs)
    .set(updateSet)
    .where(eq(orgs.login, orgId))
    .returning();

  if (updated.length === 0) {
    return Response.json({ error: `Organization "${orgId}" not found in database` }, { status: 404 });
  }

  return Response.json({ ok: true, org: updated[0] });
}
