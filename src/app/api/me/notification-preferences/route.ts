/* == /api/me/notification-preferences - the preferences panel's data ========
   GET -> { prefs, hasEmail, emailStatus }: the person's choices (the defaults
          until they change something), whether their account has an address
          to send to, and whether this deploy can send at all, so the panel can
          say so instead of showing switches that do nothing.
   PUT -> { prefs }: a partial update. Only the fields sent change, and every
          field sent must be valid (400 otherwise). Turning "unsubscribe from
          all" on also drops anything still waiting for a digest.
   Signed-out is a 401, no backend a 503, exactly like /api/me.            == */
import { backendReady, currentUser, OFFLINE } from "@/lib/server/auth";
import { emailStatus } from "@/lib/server/email";
import { discardPending, getPrefs, savePrefs } from "@/lib/server/notificationPrefs";
import { applyPrefsPatch } from "@/lib/notificationPrefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "signed out" }, { status: 401 });

export async function GET() {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return unauthorized();
  return Response.json({ prefs: await getPrefs(u.id), hasEmail: Boolean(u.email), emailStatus: emailStatus() });
}

export async function PUT(req: Request) {
  if (!backendReady()) return OFFLINE();
  const u = await currentUser();
  if (!u) return unauthorized();
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON body required" }, { status: 400 }); }
  const result = applyPrefsPatch(await getPrefs(u.id), body);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  const prefs = await savePrefs(u.id, result.prefs);
  if (prefs.unsubscribedAll) await discardPending(u.id);
  return Response.json({ prefs });
}
