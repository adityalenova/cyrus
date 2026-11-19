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
  const rows = await database.select().from(collections).where(eq(collections.userId, userId)).orderBy(asc(collections.createdAt));
  const items = await database.select({ collectionId: members.collectionId, itemType: savedItems.itemType, itemId: savedItems.itemId }).from(members)
    .innerJoin(savedItems, and(eq(members.savedItemId, savedItems.id), eq(members.userId, savedItems.userId))).where(eq(members.userId, userId));
  return rows.map(row => ({ id: row.id, name: row.name, shareToken: row.shareToken, createdAt: row.createdAt.toISOString(), itemKeys: items.filter(item => item.collectionId === row.id).map(bookmarkKey) }));
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
  if (change.action === "rename") await database.update(collections).set({ name: change.name }).where(owned);
  else if (change.action === "delete") await database.delete(collections).where(owned);
  else if (change.action === "share") await database.update(collections).set({ shareToken: change.enabled ? randomUUID() : null }).where(owned);
  else {
    const selected = and(eq(savedItems.userId, userId), eq(savedItems.itemType, change.itemType), eq(savedItems.itemId, change.itemId));
    const [saved] = await database.select({ id: savedItems.id }).from(savedItems).where(selected).limit(1);
    if (!saved) throw new CollectionError(404, "Save this bookmark before adding it to a collection.");
    if (change.enabled) {
      // One statement rechecks ownership; concurrent deletion cannot orphan a row.
      await database.execute(sql`insert into bookmark_collection_items (user_id, collection_id, saved_item_id)
        select ${userId}::uuid, c.id, s.id from bookmark_collections c join saved_items s on s.user_id = c.user_id
        where c.id = ${change.id}::uuid and c.user_id = ${userId}::uuid and s.id = ${saved.id}::uuid
        on conflict do nothing`);
    } else await database.delete(members).where(and(eq(members.userId, userId), eq(members.collectionId, change.id), eq(members.savedItemId, saved.id)));
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
