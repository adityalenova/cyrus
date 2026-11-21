/* ══ /api/notifications/read — mark as read / mark all as read ═══════
   POST -> { all: true }               mark every unread row read
   POST -> { ids: string[] }           mark the listed rows read
   Returns the number of rows actually updated, so the client can trust the
   server's read state instead of assuming its own reducer matched.      ═ */
import { backendReady, currentUser, OFFLINE } from "@/lib/server/auth";
import { markAllNotificationsRead, markNotificationsRead } from "@/lib/server/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "signed out" }, { status: 401 });
const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

const validId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

export async function POST(req: Request) {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return unauthorized();
  let body: { all?: unknown; ids?: unknown };
  try { body = await req.json(); } catch { return bad("JSON body required"); }

  if (body.all === true) {
    return Response.json({ ok: true, updated: await markAllNotificationsRead(u.id) });
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) return bad("send ids or all:true");
  if (body.ids.length > 100) return bad("too many ids in one request");
  if (!body.ids.every(validId)) return bad("an id is not well-formed");
  return Response.json({ ok: true, updated: await markNotificationsRead(u.id, body.ids as string[]) });
}
