/* ══ POST /api/auth/email/verify — check the code, start a session ══
   Asks for { email, code, name?, challenge? }. A correct code is single-use
   (burned on success). With SESSION_SECRET the address gets the httpOnly
   cyrus.session cookie, and becomes a real users row when DATABASE_URL also
   exists; without a table the signed `challenge` from /start carries the code
   hash instead, and a miss comes back with a re-signed one holding the new
   try count. With neither, the code verifies against this instance's memory
   and the client signs in locally (offline:true).                        ═ */
import { issueSession, sessionsReady } from "@/lib/server/auth";
import { checkCode, normalizeEmail, validEmail } from "@/lib/server/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; code?: string; name?: string; challenge?: string };
  try { body = await req.json(); } catch { body = {}; }
  const email = normalizeEmail(body.email ?? "");
  const code = (body.code ?? "").trim();
  if (!validEmail(email) || !/^\d{6}$/.test(code)) {
    return Response.json({ ok: false, reason: "wrong" });
  }

  const res = await checkCode(email, code, (body.challenge ?? "").trim() || undefined);
  const { challenge, ...rest } = res;
  if (!rest.ok) return Response.json({ ...rest, ...(challenge ? { challenge } : {}) });

  const display = body.name?.trim() || email.split("@")[0];
  if (sessionsReady()) {
    return Response.json({
      ok: true,
      user: await issueSession({ provider: "email", providerId: email, name: display, email }),
    });
  }
  return Response.json({
    ok: true, offline: true,
    user: { id: `email:${email}`, name: display, login: null, email, picture: null, provider: "email" },
  });
}
