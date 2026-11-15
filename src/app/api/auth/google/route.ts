/* ══ POST /api/auth/google — verify the implicit id_token ═══════
   The client completes the redirect flow and posts the raw id_token here.
   Verification goes through Google's tokeninfo endpoint (no extra
   dependency); we check issuer + audience before trusting the claims.
   A database is optional - SESSION_SECRET is what has to exist.       ═ */
import { OFFLINE, googleReady, issueSession } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export async function POST(req: Request) {
  /* googleReady is sessionsReady + a client id, so there is nothing left to
     check for configuration here - the audience below is the only secret part
     of a Google token this server trusts. */
  if (!googleReady()) return OFFLINE();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  let body: { idToken?: string };
  try { body = await req.json(); } catch { body = {}; }
  if (!body.idToken) return Response.json({ error: "idToken is required" }, { status: 400 });

  const claims = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.idToken)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!claims || !ISSUERS.includes(claims.iss) || claims.aud !== clientId || !claims.sub) {
    return Response.json({ error: "Google token failed verification - try again" }, { status: 401 });
  }

  const user = await issueSession({
    provider: "google", providerId: String(claims.sub),
    login: null, name: claims.name || claims.email || "you",
    email: claims.email ?? null, picture: claims.picture ?? null,
  });
  return Response.json({ ok: true, user });
}
