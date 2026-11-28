/* ══ /api/discussions — the threads a project page carries ═══════════
   GET  ?kind=repo&project=owner/name -> { threads: ThreadHead[] }   anyone
   POST { projectKind, projectId, title, body } -> 201 { id }        signed in

   Reading is public and never 404s on an empty project: no threads yet is a
   list, not a missing page. Writing needs a session and gives each account a
   handful of openings per window - the thread title is the only part of a
   project page a signed-in stranger can add to.                       ═ */
import { validProjectId, validProjectKind, type ProjectKind } from "@/lib/discussions";
import { OFFLINE, backendReady, currentUser } from "@/lib/server/auth";
import { createThread, listThreads } from "@/lib/server/discussions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

/* in-process rate limit: 8 openings per account per 10 minutes */
const WINDOW = 600_000;
const LIMIT = 8;
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [k, e] of hits) if (now - e.t > WINDOW) hits.delete(k);
  }
  const e = hits.get(key);
  if (!e || now - e.t > WINDOW) { hits.set(key, { n: 1, t: now }); return false; }
  if (e.n >= LIMIT) return true;
  e.n++;
  return false;
}

export async function GET(req: Request) {
  if (!backendReady()) return OFFLINE();
  const p = new URL(req.url).searchParams;
  const kind = p.get("kind") ?? "repo";
  const project = p.get("project") ?? "";
  if (!validProjectKind(kind) || !validProjectId(project)) return bad("kind or project is invalid");
  return Response.json({ threads: await listThreads(kind as ProjectKind, project) });
}

export async function POST(req: Request) {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return Response.json({ error: "signed out" }, { status: 401 });
  let body: { projectKind?: unknown; projectId?: unknown; title?: unknown; body?: unknown };
  try { body = await req.json(); } catch { return bad("JSON body required"); }
  if (!validProjectKind(body.projectKind) || !validProjectId(body.projectId)) return bad("project is invalid");
  if (rateLimited(u.id)) return Response.json({ error: "too many discussions - try again in a few minutes" }, { status: 429 });
  const res = await createThread({
    projectKind: body.projectKind, projectId: body.projectId,
    title: String(body.title ?? ""), body: String(body.body ?? ""), user: u,
  });
  if ("error" in res) return Response.json({ error: res.error }, { status: res.status });
  return Response.json({ ok: true, id: res.id }, { status: 201 });
}
