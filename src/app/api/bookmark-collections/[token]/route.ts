import { collectionFailure, publicBookmarkCollection } from "@/lib/server/bookmarkCollections";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const collection = await publicBookmarkCollection((await params).token);
    return Response.json(collection ?? { error: "Collection not found." }, { status: collection ? 200 : 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (error) { const failure = collectionFailure(error); return Response.json(failure, { status: failure.status, headers: { "Cache-Control": "no-store" } }); }
}
