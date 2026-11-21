/* ══ /api/organizations/[login]/repos — Organization Project Modification ═══
   POST   -> Add organization repository/project (requires edit_projects)
   DELETE -> Remove organization repository/project (requires edit_projects)
   ═════════════════════════════════════════════════════════════════════════ */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRepos } from "@/lib/db/schema";
import {
  ForbiddenError, requirePermission, UnauthorizedError,
  unauthorizedResponse, forbiddenResponse,
} from "@/lib/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  if (!orgId) return Response.json({ error: "Organization required" }, { status: 400 });

  try {
    await requirePermission("edit_projects", orgId);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "Database offline" }, { status: 503 });

  let body: { repo?: unknown; description?: unknown; lang?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repo = typeof body.repo === "string" ? body.repo.trim() : null;
  const url = typeof body.url === "string" ? body.url.trim() : null;
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const lang = typeof body.lang === "string" ? body.lang.trim() : null;

  if (!repo || !url) {
    return Response.json({ error: "repo name and url are required" }, { status: 400 });
  }

  const inserted = await db
    .insert(orgRepos)
    .values({
      orgLogin: orgId,
      repo,
      url,
      description,
      lang,
    })
    .returning();

  return Response.json({ ok: true, repo: inserted[0] });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const { login } = await params;
  const orgId = decodeURIComponent(login ?? "").trim();
  if (!orgId) return Response.json({ error: "Organization required" }, { status: 400 });

  try {
    await requirePermission("edit_projects", orgId);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "Database offline" }, { status: 503 });

  let body: { repo?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repo = typeof body.repo === "string" ? body.repo.trim() : null;
  if (!repo) {
    return Response.json({ error: "repo name is required" }, { status: 400 });
  }

  const deleted = await db
    .delete(orgRepos)
    .where(and(eq(orgRepos.orgLogin, orgId), eq(orgRepos.repo, repo)))
    .returning();

  if (deleted.length === 0) {
    return Response.json({ error: "Repository not found in organization" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
