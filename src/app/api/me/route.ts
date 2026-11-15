/* ══ GET /api/me — who does this session cookie belong to? ══════ */
import { currentPublicUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentPublicUser();
  /* "Who am I?" has an honest answer even when nobody is signed in. A 401
     here is correct HTTP for a protected resource, but this endpoint is a
     probe the client runs on every load, so it only ever shows up as two
     red console errors for a first-time visitor. The write endpoints
     (/api/me/saved, /api/me/applications) keep their 401s. */
  if (!user) return Response.json({ user: null });
  return Response.json({ user });
}
