import { z } from "zod";
export const collectionId = z.uuid();

export const collectionChange = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("rename"), id: collectionId, name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("delete"), id: collectionId }).strict(),
  z.object({ action: z.literal("share"), id: collectionId, enabled: z.boolean() }).strict(),
  z.object({ action: z.literal("member"), id: collectionId, itemType: z.enum(["repo", "org", "program", "issue"]), itemId: z.string().min(1).max(200), enabled: z.boolean() }).strict(),
]);
export type CollectionChange = z.infer<typeof collectionChange>;
export type Bookmark = { itemType: string; itemId: string; title?: string | null; createdAt?: string };
export type BookmarkCollection = { id: string; name: string; shareToken: string | null; createdAt: string; itemKeys: string[] };
export const bookmarkKey = (item: Pick<Bookmark, "itemType" | "itemId">) => JSON.stringify([item.itemType, item.itemId]);

export function bookmarkHref(item: Bookmark): string | null {
  if (item.itemType === "repo" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(item.itemId)) return `/repo/${encodeURIComponent(item.itemId)}`;
  // The existing project archive saves its public project URL as the repo ID.
  if (item.itemType === "repo") {
    try { const url = new URL(item.itemId); if (url.protocol === "https:" && !url.username && !url.password) return url.href; } catch { /* not a project URL */ }
  }
  if (item.itemType === "org" && /^[A-Za-z0-9_.-]+$/.test(item.itemId)) return `/organizations/${encodeURIComponent(item.itemId)}`;
  if (item.itemType === "program" && /^[A-Za-z0-9_-]+$/.test(item.itemId)) return `/programs/${encodeURIComponent(item.itemId)}`;
  if (item.itemType === "issue" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/\d+$/.test(item.itemId)) return item.itemId;
  return null;
}

export function filterBookmarks(items: Bookmark[], query: string, type: string, sort: string, collection?: BookmarkCollection) {
  const q = query.trim().toLocaleLowerCase();
  return items.filter(item => (type === "all" || item.itemType === type)
    && (!collection || collection.itemKeys.includes(bookmarkKey(item)))
    && `${item.title ?? ""} ${item.itemId}`.toLocaleLowerCase().includes(q))
    .sort((a, b) => sort === "name" ? (a.title || a.itemId).localeCompare(b.title || b.itemId) : (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
