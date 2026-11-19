"use server";
import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/db";
import { changeBookmarkCollection, collectionFailure, listBookmarkCollections } from "@/lib/server/bookmarkCollections";
import type { BookmarkCollection } from "@/lib/bookmarks";

export async function updateBookmarkCollection(input: unknown): Promise<{ error: string; status: number } | { collections: BookmarkCollection[] } | { committed: true; warning: string }> {
  let userId: string;
  try {
    if (!getDb()) return { error: "Cross-device bookmarks are unavailable on this server.", status: 503 };
    const user = await currentUser();
    if (!user) return { error: "Sign in to organize your bookmarks.", status: 401 };
    await changeBookmarkCollection(user.id, input);
    userId = user.id;
  } catch (error) { return collectionFailure(error); }
  try { return { collections: await listBookmarkCollections(userId) }; }
  catch { return { committed: true as const, warning: "Your change was saved, but the updated collection list could not be loaded. Refresh bookmarks to try again." }; }
}
