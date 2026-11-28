/* ══ /api/discussions/[id] — one thread, and the three things you can do ══
   GET  -> { head, url, comments }   the flat rows; the tree is built by the
                                      reader (src/lib/discussions.ts), so the
                                      wire format stays one shape for any sort
   POST -> { action: "reply", parentId?, body }
           { action: "vote", commentId, value: 1 | -1 | 0 }
           { action: "flag", commentId, reason }

   Only the id in the path decides which thread is read or bumped, and every
   write re-reads its target, so a body cannot point a reply at a comment that
   lives in somebody else's discussion.                                 ═ */
import { validCommentId, validFlagReason, validThreadId, validVote } from "@/lib/discussions";
import { OFFLINE, backendReady, currentUser } from "@/lib/server/auth";
import { addReply, readThread, setFlag, setVote } from "@/lib/server/discussions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW = 600_000;
/* replies are the noisy action, a flag is nearly never used, a vote is a click */
const LIMITS = { reply: 20, flag: 10, vote: 60 } as const;

const hits = new Map<string, { n: number; t: number }>();
function rateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [k, e] of hits) if (now - e.t > WINDOW) hits.delete(k);
  }
  const e = hits.get(key);
  if (!e || now - e.t > WINDOW) { hits.set(key, { n: 1, t: now }); return false; }
  if (e.n >= limit) return true;
  e.n++;
  return false;
}

const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });
const SIGN_OUT = () => Response.json({ error: "signed out" }, { status: 401 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!backendReady()) return OFFLINE();
  const { id } = await params;
  if (!validThreadId(id)) return bad("no such discussion");
  const page = await readThread(id, (await currentUser())?.id ?? null);
  if (!page) return Response.json({ error: "no such discussion" }, { status: 404 });
  return Response.json(page);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return SIGN_OUT();
  const { id } = await params;
  if (!validThreadId(id)) return bad("no such discussion");
  let body: { action?: unknown; parentId?: unknown; body?: unknown; commentId?: unknown; value?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { return bad("JSON body required"); }

  const action = body.action;
  if (action !== "reply" && action !== "vote" && action !== "flag") return bad("action must be reply, vote or flag");
  if (rateLimited(`${u.id}:${action}`, LIMITS[action])) {
    return Response.json({ error: "slow down - that is plenty for now" }, { status: 429 });
  }

  if (action === "reply") {
    const parentId = body.parentId == null ? null : String(body.parentId);
    if (parentId !== null && !validCommentId(parentId)) return bad("no comment to reply to");
    const res = await addReply({ discussionId: id, parentId, body: String(body.body ?? ""), user: u });
    if ("error" in res) return Response.json({ error: res.error }, { status: res.status });
    return Response.json({ ok: true, id: res.id }, { status: 201 });
  }

  const commentId = String(body.commentId ?? "");
  if (!validCommentId(commentId)) return bad("no such comment");
  if (action === "vote") {
    if (!validVote(body.value)) return bad("value must be 1, -1 or 0");
    const res = await setVote({ commentId, value: body.value, user: u });
    return "error" in res ? Response.json({ error: res.error }, { status: res.status }) : Response.json(res);
  }
  if (!validFlagReason(body.reason)) return bad("reason must be one of the listed ones");
  const res = await setFlag({ commentId, reason: body.reason });
  return "error" in res ? Response.json({ error: res.error }, { status: res.status }) : Response.json(res);
}
