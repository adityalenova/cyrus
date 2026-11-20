import { bookmarkKey, type Bookmark } from "./bookmarks";

export type BookmarkImport = { itemType: "repo" | "org" | "program"; itemId: string; title?: string };
export type ImportLedger = Record<string, BookmarkImport[]>;

export function pendingImports(value: unknown, owner: string): BookmarkImport[] {
  if (!value || typeof value !== "object" || !Object.hasOwn(value, owner)) return [];
  const items = (value as Record<string, unknown>)[owner];
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is BookmarkImport => item && ["repo", "org", "program"].includes(item.itemType) && typeof item.itemId === "string" && item.itemId.length > 0)
    .map(item => ({ itemType: item.itemType, itemId: item.itemId, ...(typeof item.title === "string" ? { title: item.title } : {}) }));
}

// Once an import succeeds, only the unresolved keys may be retried. Cached
// server items must never become new imports after another device removes them.
export function planImports(local: BookmarkImport[], remote: Bookmark[], pending: BookmarkImport[], firstImport: boolean) {
  const server = new Set(remote.map(bookmarkKey)), todo = new Map<string, BookmarkImport>();
  for (const item of [...pending, ...(firstImport ? local : [])]) if (!server.has(bookmarkKey(item))) todo.set(bookmarkKey(item), item);
  return { pending: [...todo.values()], items: [...remote, ...todo.values()] };
}
