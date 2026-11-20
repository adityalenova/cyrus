import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/db";
import { collectionFailure, listBookmarkCollections } from "@/lib/server/bookmarkCollections";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!getDb()) return Response.json({ error: "Cross-device bookmarks are unavailable on this server." }, { status: 503 });
    const user = await currentUser();
    if (!user) return Response.json({ error: "signed out" }, { status: 401 });
    return Response.json({ collections: await listBookmarkCollections(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const failure = collectionFailure(error); return Response.json(failure, { status: failure.status }); }
}
