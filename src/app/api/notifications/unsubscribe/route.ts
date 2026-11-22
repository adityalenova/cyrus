/* == /api/notifications/unsubscribe - one click, no sign-in =================
   POST ?t=<token>  switches that person's email off (the bell is untouched).
   The token is the signed link from the footer of every email. This is also
   the address in the List-Unsubscribe header: a mail client's own Unsubscribe
   button POSTs "List-Unsubscribe=One-Click" here (RFC 8058).

   It is POST-only on purpose. A link a mail scanner or preview opens with GET
   must never unsubscribe anyone; the /unsubscribe page asks first, then POSTs. == */
import { backendReady, OFFLINE } from "@/lib/server/auth";
import { unsubscribeAll } from "@/lib/server/notificationPrefs";
import { verifyUnsubscribeToken } from "@/lib/server/unsubscribeToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!backendReady()) return OFFLINE();
  let token = new URL(req.url).searchParams.get("t");
  if (!token && (req.headers.get("content-type") ?? "").includes("application/json")) {
    try { token = (await req.json())?.token ?? null; } catch { /* falls through to invalid */ }
  }
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return Response.json({ error: "this unsubscribe link is not valid" }, { status: 400 });
  if (!(await unsubscribeAll(userId))) return Response.json({ error: "no such account" }, { status: 404 });
  return Response.json({ ok: true });
}
