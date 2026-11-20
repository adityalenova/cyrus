import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { bookmarkCollections as collections, bookmarkCollectionItems as members, savedItems } from "../db/schema";
import { bookmarkKey, collectionChange, collectionId, type BookmarkCollection } from "../bookmarks";

export class CollectionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const db = () => { const value = getDb(); if (!value) throw new CollectionError(503, "Cross-device bookmarks are unavailable on this server."); return value; };

export async function listBookmarkCollections(userId: string): Promise<BookmarkCollection[]> {
  const database = db();
  const rows = await database.select({ id: collections.id, name: collections.name, shareToken: collections.shareToken, createdAt: collections.createdAt, itemType: savedItems.itemType, itemId: savedItems.itemId })
    .from(collections).leftJoin(members, and(eq(members.collectionId, collections.id), eq(members.userId, collections.userId)))
    .leftJoin(savedItems, and(eq(members.savedItemId, savedItems.id), eq(savedItems.userId, collections.userId)))
    .where(eq(collections.userId, userId)).orderBy(asc(collections.createdAt), asc(savedItems.createdAt), asc(savedItems.id));
  const result = new Map<string, BookmarkCollection>();
  for (const row of rows) {
    let collection = result.get(row.id);
    if (!collection) { collection = { id: row.id, name: row.name, shareToken: row.shareToken, createdAt: row.createdAt.toISOString(), itemKeys: [] }; result.set(row.id, collection); }
    if (row.itemType !== null && row.itemId !== null) collection.itemKeys.push(bookmarkKey({ itemType: row.itemType, itemId: row.itemId }));
  }
  return [...result.values()];
}

export async function changeBookmarkCollection(userId: string, input: unknown) {
  const parsed = collectionChange.safeParse(input);
  if (!parsed.success) throw new CollectionError(400, "Check the collection name and selected bookmark.");
  const change = parsed.data, database = db();
  if (change.action === "create") {
    await database.insert(collections).values({ userId, name: change.name });
    return;
  }
  const owned = and(eq(collections.userId, userId), eq(collections.id, change.id));
  const [existing] = await database.select({ id: collections.id }).from(collections).where(owned).limit(1);
  if (!existing) throw new CollectionError(404, "Collection not found.");
  if (change.action === "rename") {
    if (!(await database.update(collections).set({ name: change.name }).where(owned).returning({ id: collections.id })).length) throw new CollectionError(404, "Collection not found.");
  }
  else if (change.action === "delete") await database.delete(collections).where(owned);
  else if (change.action === "share") {
    if (!(await database.update(collections).set({ shareToken: change.enabled ? randomUUID() : null }).where(owned).returning({ id: collections.id })).length) throw new CollectionError(404, "Collection not found.");
  }
  else {
    const selected = and(eq(savedItems.userId, userId), eq(savedItems.itemType, change.itemType), eq(savedItems.itemId, change.itemId));
    const [saved] = await database.select({ id: savedItems.id }).from(savedItems).where(selected).limit(1);
    if (change.enabled) {
      // Resolve the stable key at write time; duplicate memberships still return a row.
      const added = await database.insert(members).select(database.select({ userId: sql<string>`${userId}::uuid`.as("user_id"), collectionId: collections.id, savedItemId: savedItems.id })
        .from(collections).innerJoin(savedItems, eq(savedItems.userId, collections.userId))
        .where(and(owned, selected)))
        .onConflictDoUpdate({ target: [members.userId, members.collectionId, members.savedItemId], set: { savedItemId: sql`excluded.saved_item_id` } }).returning({ id: members.savedItemId });
      if (!added.length) throw new CollectionError(404, "The collection or saved bookmark no longer exists. Refresh before retrying.");
    } else if (saved) await database.delete(members).where(and(eq(members.userId, userId), eq(members.collectionId, change.id), eq(members.savedItemId, saved.id)));
  }
}

export async function publicBookmarkCollection(token: string) {
  if (!collectionId.safeParse(token).success) return null;
  const database = db();
  // Read the live token and its public projection in one statement, with no cache.
  const rows = await database.select({ name: collections.name, itemType: savedItems.itemType, itemId: savedItems.itemId, title: savedItems.title })
    .from(collections).leftJoin(members, and(eq(members.collectionId, collections.id), eq(members.userId, collections.userId)))
    .leftJoin(savedItems, and(eq(savedItems.id, members.savedItemId), eq(savedItems.userId, collections.userId)))
    .where(eq(collections.shareToken, token));
  if (!rows.length) return null;
  return { name: rows[0].name, items: rows.filter(row => row.itemType !== null && row.itemId !== null).map(row => ({ itemType: row.itemType!, itemId: row.itemId!, title: row.title })) };
}

export function collectionFailure(error: unknown) {
  if (error instanceof CollectionError) return { status: error.status, error: error.message };
  const code = error && typeof error === "object" && "cause" in error ? (error.cause as { code?: string })?.code : (error as { code?: string })?.code;
  return code === "23505" ? { status: 409, error: "A collection with that name already exists." } : { status: 503, error: "Could not confirm the change. Refresh before retrying." };
}
