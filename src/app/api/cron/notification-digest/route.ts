/* == /api/cron/notification-digest - send the digests that are owed =========
   GET with  Authorization: Bearer <CRON_SECRET>  runs one pass and returns
   { checked, sent, skipped, failed }. Vercel Cron sends that header on its own
   when the project has a CRON_SECRET variable.

   The pass is safe at any frequency: whether a person's digest is owed is
   decided from THEIR timezone and their last digest (see digestDue), not from
   when this ran. Hourly gives the most punctual delivery; once a day still
   delivers everything, a little late. Without CRON_SECRET the route is off. == */
import { timingSafeEqual } from "node:crypto";
import { backendReady, OFFLINE } from "@/lib/server/auth";
import { runDigests } from "@/lib/server/notificationDigest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16) return Response.json({ error: "cron is not configured" }, { status: 503 });
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!backendReady()) return OFFLINE();
  return Response.json(await runDigests());
}
