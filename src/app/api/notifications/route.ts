/* ══ /api/notifications — the bell's initial page ════════════════════
   GET -> { notifications, unread }: the recent window plus the count the
   badge shows, so the dropdown renders before the stream ever delivers a
   frame. It is also the polling fallback the client uses when SSE is not
   available. Signed-out is a 401, no backend a 503, exactly like /api/me. ═ */
import { backendReady, currentUser, OFFLINE } from "@/lib/server/auth";
import { countUnread, listNotifications } from "@/lib/server/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "signed out" }, { status: 401 });

export async function GET() {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return unauthorized();
  const [notifications, unread] = await Promise.all([listNotifications(u.id, 50), countUnread(u.id)]);
  return Response.json({ notifications, unread });
}
