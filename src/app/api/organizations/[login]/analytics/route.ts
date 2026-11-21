/* ══ /api/organizations/[login]/analytics — Organization Private Analytics ══
   GET -> Protected analytics access for organization members
   Requires view_analytics permission in the organization.
   ═════════════════════════════════════════════════════════════════════════ */
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRepos, orgs, userRoles } from "@/lib/db/schema";
import {
  ForbiddenError, requirePermission, UnauthorizedError,
  unauthorizedResponse, forbiddenResponse,
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
    await requirePermission("view_analytics", orgId);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    if (err instanceof ForbiddenError) return forbiddenResponse(err.message);
    return Response.json({ error: "Authorization error" }, { status: 500 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "Database offline" }, { status: 503 });

  // Organization summary
  const orgData = await db.select().from(orgs).where(eq(orgs.login, orgId)).limit(1);

  // Members role breakdown
  const roleBreakdown = await db
    .select({
      role: userRoles.roleId,
      count: sql<number>`count(*)::int`,
    })
    .from(userRoles)
    .where(eq(userRoles.orgId, orgId))
    .groupBy(userRoles.roleId);

  // Organization repositories
  const repos = await db
    .select()
    .from(orgRepos)
    .where(eq(orgRepos.orgLogin, orgId));

  const totalMembers = roleBreakdown.reduce((acc, curr) => acc + curr.count, 0);

  return Response.json({
    orgId,
    org: orgData[0] ?? null,
    totalMembers,
    rolesDistribution: Object.fromEntries(roleBreakdown.map((r) => [r.role, r.count])),
    repositoriesCount: repos.length,
    repositories: repos.map((r) => ({
      repo: r.repo,
      stars: r.stars,
      issues: r.issues,
      forks: r.forks,
      lang: r.lang,
    })),
  });
}
