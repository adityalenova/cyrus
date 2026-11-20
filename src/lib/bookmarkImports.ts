import { bookmarkKey, type Bookmark } from "./bookmarks";

export type BookmarkImport = { itemType: "repo" | "org" | "program"; itemId: string; title?: string };
export type ImportLedger = Record<string, BookmarkImport[]>;

// Each completion has its own monotonic bit. A stale tab can replace the retry
// list, but cannot reverse another tab's successful import (or local removal).
export function createImportCheckpoints(storage: () => Pick<Storage, "getItem" | "setItem">) {
  const done = new Set<string>();
  const key = (owner: string, item: Pick<BookmarkImport, "itemType" | "itemId">) => `agenthub.bookmarkimport.done.${JSON.stringify([owner, item.itemType, item.itemId])}`;
  return {
    has(owner: string, item: Pick<BookmarkImport, "itemType" | "itemId">) {
      const id = key(owner, item);
      if (done.has(id)) return true;
      try { return storage().getItem(id) === "1"; } catch { return false; }
    },
    finish(owner: string, item: Pick<BookmarkImport, "itemType" | "itemId">) {
      const id = key(owner, item); done.add(id);
      try { storage().setItem(id, "1"); return true; } catch { return false; }
    },
  };
}

export function pendingImports(value: unknown, owner: string): BookmarkImport[] {
  if (!value || typeof value !== "object" || !Object.hasOwn(value, owner)) return [];
  const items = (value as Record<string, unknown>)[owner];
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is BookmarkImport => item && ["repo", "org", "program"].includes(item.itemType) && typeof item.itemId === "string" && item.itemId.length > 0)
    .map(item => ({ itemType: item.itemType, itemId: item.itemId, ...(typeof item.title === "string" ? { title: item.title } : {}) }));
}

// Once an import succeeds, only the unresolved keys may be retried. Cached
// server items must never become new imports after another device removes them.
export function planImports(local: BookmarkImport[], remote: Bookmark[], pending: BookmarkImport[], firstImport: boolean, completed: (item: BookmarkImport) => boolean = () => false) {
  const server = new Set(remote.map(bookmarkKey)), todo = new Map<string, BookmarkImport>();
  for (const item of [...pending, ...(firstImport ? local : [])]) if (!server.has(bookmarkKey(item)) && !completed(item)) todo.set(bookmarkKey(item), item);
  return { pending: [...todo.values()], items: [...remote, ...todo.values()] };
}
