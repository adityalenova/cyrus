/* ══ POST /api/auth/email/start — issue + send a sign-in code ════
   Asks for { email, turnstile? }. Returns 200 with a shaped payload so the
   client's fetch helper (which nulls out non-2xx) can still read the reason:
     { ok:true, sent:true, challenge? }           - email is on its way
     { ok:true, sent:false, demo:true, code }     - no RESEND_API_KEY: demo
     { ok:false, reason:"too_soon" }              - 30s resend lock
     { ok:false, reason:"captcha_required"|"captcha_failed" } - Turnstile gate
     { ok:false, reason:"invalid_email" | "send_failed" }
   `challenge` is the signed code envelope the verify step must echo back when
   there is no database. The code itself is never logged and lives only hashed.
   ═ */
import { dropCode, genCode, issueEnvelope, normalizeEmail, sendCodeEmail, storeCode, validEmail } from "@/lib/server/email";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; turnstile?: string };
  try { body = await req.json(); } catch { body = {}; }
  const email = normalizeEmail(body.email ?? "");
  if (!validEmail(email)) return Response.json({ ok: false, reason: "invalid_email" });

  /* human check first: an unverified request never reaches the mail sender */
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return Response.json(ts);

  const code = genCode();
  const stored = await storeCode(email, code);
  if (!stored) return Response.json({ ok: false, reason: "too_soon", retry_in_seconds: 30 });

  /* no DATABASE_URL -> the browser carries the signed envelope between steps */
  const challenge = issueEnvelope(email, code);

  const send = await sendCodeEmail(email, code);
  if (send.sent) return Response.json({ ok: true, sent: true, challenge, expires_in_seconds: 600 });
  if ("demo" in send && send.demo) return Response.json({ ok: true, sent: false, demo: true, code, challenge, expires_in_seconds: 600 });
  await dropCode(email);
  return Response.json({ ok: false, reason: "send_failed", error: "error" in send ? send.error : "send failed" });
}
