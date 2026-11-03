/* ══ POST /api/submissions — public inbox (nominations, fixes, feedback) ══
   No sign-in needed. Basic guards only: known kind, sane payload size,
   soft per-IP rate limit. Emails stay optional so feedback can be anonymous. */
import { getDb } from "@/lib/db";
import { OFFLINE, backendReady } from "@/lib/server/auth";
import { addSubmission, smallJson, validEmail, validId, validSubmissionKind } from "@/lib/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* in-process rate limit: 6 submissions per IP per 10 minutes */
const WINDOW = 600_000;
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [key, e] of hits) if (now - e.t > WINDOW) hits.delete(key);
  }
  const e = hits.get(ip);
  if (!e || now - e.t > WINDOW) { hits.set(ip, { n: 1, t: now }); return false; }
  if (e.n >= 6) return true;
  e.n++;
  return false;
}

export async function POST(req: Request) {
  if (!backendReady()) return OFFLINE();
  let body: { kind?: unknown; name?: unknown; email?: unknown; payload?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "JSON body required" }, { status: 400 }); }
  if (!validSubmissionKind(body.kind)) return Response.json({ error: "kind is not accepted" }, { status: 400 });
  if (!smallJson(body.payload) || body.payload == null || typeof body.payload !== "object") {
    return Response.json({ error: "payload must be a small JSON object" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : null;
  const email = body.email === undefined || body.email === null || body.email === "" ? null : body.email;
  if (email !== null && !validEmail(email)) return Response.json({ error: "email doesn't look right" }, { status: 400 });
  if (body.kind === "org_nomination" && (!email || !validId((body.payload as { repo?: unknown }).repo))) {
    return Response.json({ error: "org nominations need a contact email and a repo URL" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!getDb() || rateLimited(ip)) {
    return Response.json({ error: "too many submissions - try again in a few minutes" }, { status: 429 });
  }
  const row = await addSubmission({ kind: body.kind, name, email, payload: body.payload });
  return Response.json({ ok: true, id: row.id, createdAt: row.createdAt });
}
