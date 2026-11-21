/* ══ /api/notifications/stream — Server-Sent Events tail ═════════════
   One long-lived GET per open bell. On connect it pushes a snapshot (the
   recent page + unread count), then tails the table for rows newer than a
   createdAt cursor and emits each, with a heartbeat in between so an idle
   proxy keeps the socket. Neon's HTTP driver has no LISTEN/NOTIFY, so the
   tail is a short poll - correct, bounded, and the client still treats it
   as a real stream. cancel() and the request's abort signal both stop the
   timer, so a closed tab does not leave a poll running on the server.   ═ */
import { backendReady, currentUser, OFFLINE } from "@/lib/server/auth";
import { countUnread, listNotifications, notificationsSince } from "@/lib/server/notifications";
import { encodeSse, heartbeat } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "signed out" }, { status: 401 });

/** how often the server re-reads the cursor; well under the client's poll. */
const TAIL_MS = 4000;

export async function GET(req: Request) {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return unauthorized();

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => { if (!stopped) controller.enqueue(encoder.encode(chunk)); };

      let cursor = new Date().toISOString();
      try {
        const rows = await listNotifications(u.id, 50);
        if (rows.length) cursor = rows[rows.length - 1].createdAt;
        send(encodeSse("snapshot", { notifications: rows, unread: await countUnread(u.id) }));
      } catch {
        send(encodeSse("error", { message: "could not load notifications" }));
      }

      const tick = async () => {
        if (stopped) return;
        try {
          const fresh = await notificationsSince(u.id, cursor);
          if (fresh.length) {
            cursor = fresh[fresh.length - 1].createdAt;
            for (const n of fresh) send(encodeSse("notify", n));
            send(encodeSse("unread", { unread: await countUnread(u.id) }));
          } else {
            send(heartbeat());
          }
        } catch {
          send(heartbeat()); // keep the socket warm; the next tick retries
        }
      };
      timer = setInterval(() => void tick(), TAIL_MS);
    },
    cancel() {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  });

  req.signal.addEventListener("abort", () => {
    stopped = true;
    if (timer) clearInterval(timer);
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
