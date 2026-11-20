"use client";
import { useEffect, useState } from "react";
import { bookmarkKey, type Bookmark } from "@/lib/bookmarks";
import { BookmarkLink } from "@/components/BookmarkLink";

export default function SharedBookmarkCollection({ token }: { token: string }) {
  const [value, setValue] = useState<{ name: string; items: Bookmark[] } | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setValue(null); setError(false);
    void fetch(`/api/bookmark-collections/${encodeURIComponent(token)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ name: string; items: Bookmark[] }>; })
      .then(result => { if (!controller.signal.aborted) setValue(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [token, retry]);
  return <main className="max-w-[900px] mx-auto px-6 py-14 space-y-5">
    <p className="eyebrow">Shared bookmarks</p><h1 className="panel-h text-[28px] break-words">{value?.name ?? "A collection of useful places"}</h1>
    {error ? <div role="alert"><p className="text-cocoa">This collection is unavailable. Its owner may have revoked the link.</p><button className="text-accent underline mt-3" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : !value ? <p role="status">Loading collection…</p> : value.items.length ? <ul className="space-y-3">{value.items.map(item => <li key={bookmarkKey(item)} className="rounded-[18px] border border-line bg-card p-5"><p className="text-dim text-[12px] mb-2">{item.itemType}</p><h2 className="card-title break-words"><BookmarkLink item={item}>{item.title || item.itemId}</BookmarkLink></h2></li>)}</ul> : <p className="text-cocoa">This shared collection has no bookmarks yet.</p>}
  </main>;
}
