"use server";
import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/db";
import { changeBookmarkCollection, collectionFailure, listBookmarkCollections } from "@/lib/server/bookmarkCollections";

export async function updateBookmarkCollection(input: unknown) {
  try {
    if (!getDb()) return { error: "Cross-device bookmarks are unavailable on this server.", status: 503 };
    const user = await currentUser();
    if (!user) return { error: "Sign in to organize your bookmarks.", status: 401 };
    await changeBookmarkCollection(user.id, input);
    return { collections: await listBookmarkCollections(user.id) };
  } catch (error) { return collectionFailure(error); }
}
