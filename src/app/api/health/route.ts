/* ══ GET /api/health — liveness + backend capability probe ═════
   Booleans only: never a key, a name, or anything that identifies an
   account. The client uses these to decide which sign-in buttons can
   actually complete on this deploy.                                  ═ */
import { dbReady } from "@/lib/db";
import { emailStatus } from "@/lib/server/email";
import { githubReady, googleReady, sessionsReady } from "@/lib/server/auth";
import { turnstileActive } from "@/lib/server/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    db: dbReady(),
    auth: sessionsReady(),
    google: googleReady(),
    github: githubReady(),
    email: emailStatus(),
    captcha: turnstileActive(),
    time: new Date().toISOString(),
  });
}
