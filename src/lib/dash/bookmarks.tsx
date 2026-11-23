"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { updateBookmarkCollection } from "@/app/[locale]/bookmarks/actions";
import { bookmarkKey, filterBookmarks, type Bookmark, type BookmarkCollection, type CollectionChange } from "../bookmarks";
import { BookmarkLink } from "../../components/BookmarkLink";
import { api } from "../api";
import { useStore } from "../store";
import { PROGRAMS } from "../../data/orgs";
import { Link } from "../router";
import { btn } from "../../components/ui";
import { Card, DashHead } from "./shell";

export function BookmarksSection() {
  const { saved, savedOrgs, savedPrograms, serverUser, toggleSaved, toggleSavedOrg, toggleSavedProgram, refreshSession, flushBookmarks } = useStore();
  const [items, setItems] = useState<Bookmark[]>([]), [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [q, setQ] = useState(""), [type, setType] = useState("all"), [sort, setSort] = useState("newest"), [selection, setSelection] = useState("all");
  const [name, setName] = useState(""), [rename, setRename] = useState("");
  const [pending, startTransition] = useTransition(); const busy = useRef(false), request = useRef(0);
  const account = serverUser?.id ?? null, accountRef = useRef(account); accountRef.current = account;
  const signature = JSON.stringify([saved, savedOrgs, savedPrograms]);
  async function load(owner: string) {
    if (busy.current) return;
    const version = ++request.current; setLoading(true); setError("");
    try {
      await flushBookmarks();
      if (version !== request.current || accountRef.current !== owner) return;
      const [response, list] = await Promise.all([fetch("/api/me/bookmark-collections", { cache: "no-store" }), api.savedList()]);
      if (version !== request.current || accountRef.current !== owner) return;
      if (!response.ok || !list) throw new Error("Could not load cross-device bookmarks. Try refreshing when the server is available.");
      const data = await response.json() as { collections: BookmarkCollection[] };
      if (version !== request.current || accountRef.current !== owner) return;
      setCollections(data.collections); setItems(list.items);
    } catch (failure) { if (version === request.current && accountRef.current === owner) setError((failure as Error).message); }
    finally { if (version === request.current) setLoading(false); }
  }
  useEffect(() => {
    request.current++; setCollections([]); setItems([]); setSelection("all");
    return () => { request.current++; };
  }, [account]);
  useEffect(() => { if (account) void load(account); }, [account, signature]);
  const selected = collections.find(row => row.id === selection);
  useEffect(() => { setRename(selected?.name ?? ""); }, [selected?.name, selected?.id]);
  const bookmarks = useMemo(() => {
    const known = new Map(items.map(item => [bookmarkKey(item), item]));
    const values: Bookmark[] = [
      ...saved.map(itemId => ({ itemType: "repo", itemId })),
      ...savedOrgs.map(itemId => ({ itemType: "org", itemId })),
      ...savedPrograms.map((itemId: string) => ({ itemType: "program" as const, itemId, title: PROGRAMS.find((program: any) => program.id === itemId)?.name })),
    ];
    return [...values.map(item => ({ ...item, ...known.get(bookmarkKey(item)) })), ...items.filter(item => item.itemType === "issue")];
  }, [items, saved, savedOrgs, savedPrograms]);
  const rows = filterBookmarks(bookmarks, q, type, sort, selected);
  function mutate(change: CollectionChange, optimistic?: () => void) {
    if (!account || busy.current) return;
    const owner = account, previous = collections; busy.current = true;
    request.current++; setLoading(false); setError(""); optimistic?.();
    startTransition(async () => {
      let reload = false;
      try {
        if (change.action === "member") await flushBookmarks();
        if (accountRef.current !== owner) return;
        const result = await updateBookmarkCollection(change);
        if (accountRef.current !== owner) return;
        if ("error" in result) throw new Error(result.error);
        if ("committed" in result) { setError(result.warning); reload = true; }
        else setCollections(result.collections);
        if (change.action === "create") setName("");
        if (change.action === "delete") setSelection("all");
      } catch (failure) { if (accountRef.current === owner) { setCollections(previous); setError((failure as Error).message); } }
      finally { busy.current = false; if (reload && accountRef.current === owner) void load(owner); }
    });
  }
  const field = "rounded-[10px] bg-cream border border-line px-3 py-2 text-ink min-w-0 text-[13px]";
  const shareHref = selected?.shareToken ? `/bookmarks/share/${selected.shareToken}` : null;
  return <>
    <DashHead title="My Bookmarks" sub="Keep useful projects, programs and organizations together. Collections stay private until you share a link." action={<button type="button" className={btn("outline", "sm")} disabled={loading || pending} onClick={() => { void refreshSession().then(() => { if (account) void load(account); }); }}>Refresh bookmarks</button>} />
    {!account && <Card><p className="text-cocoa text-[13px]">These bookmarks are saved in this browser. Sign in to a server with cross-device storage to organize and share collections.</p></Card>}
    {error && <Card><p role="alert" className="text-brick text-[13px]">{error}</p></Card>}
    {loading && <p role="status" className="text-dim text-[13px]">Refreshing saved bookmarks…</p>}
    <p role="status" className="sr-only">{pending ? "Saving collection…" : ""}</p>
    <Card>
      <div className="flex flex-wrap gap-3">
        <label className="flex-1 min-w-[160px] text-[12px] text-cocoa">Search bookmarks<input aria-label="Search bookmarks" value={q} onChange={event => setQ(event.target.value)} className={field + " block w-full mt-1"} /></label>
        <label className="text-[12px] text-cocoa">Type<select aria-label="Bookmark type" className={field + " block mt-1"} value={type} onChange={event => setType(event.target.value)}>{[["all", "All types"], ["repo", "Projects"], ["program", "Programs"], ["org", "Organizations"], ["issue", "Issues"]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-[12px] text-cocoa">Sort<select aria-label="Sort bookmarks" className={field + " block mt-1"} value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest saved</option><option value="name">Name</option></select></label>
        <label className="text-[12px] text-cocoa flex-1 basis-[180px] min-w-0">Collection<select aria-label="Bookmark collection" className={field + " block mt-1 w-full"} value={selection} onChange={event => setSelection(event.target.value)}><option value="all">All bookmarks</option>{collections.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      </div>
    </Card>
    {account && <Card>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); mutate({ action: "create", name }); }}>
        <label className="text-[12px] text-cocoa flex-1 min-w-[150px]">New private collection<input aria-label="New collection name" className={field + " block mt-1 w-full"} value={name} maxLength={80} required onChange={event => setName(event.target.value)} /></label><button disabled={pending || !name.trim()} className={btn("outline", "sm")}>Create collection</button>
      </form>
      {selected && <div className="mt-4 pt-4 border-t border-line space-y-3">
        <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); mutate({ action: "rename", id: selected.id, name: rename }); }}><input aria-label="Rename collection" className={field + " flex-1"} value={rename} maxLength={80} required onChange={event => setRename(event.target.value)} /><button disabled={pending || !rename.trim()} className={btn("outline", "sm")}>Rename</button></form>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={pending} className={btn("outline", "sm")} onClick={() => mutate({ action: "share", id: selected.id, enabled: !selected.shareToken })}>{selected.shareToken ? "Revoke public link" : "Create public link"}</button><button type="button" disabled={pending} className={btn("outline", "sm")} onClick={() => { if (window.confirm(`Delete ${selected.name}? Your bookmarks will stay saved.`)) mutate({ action: "delete", id: selected.id }); }}>Delete collection</button></div>
        {shareHref && <div className="space-y-2"><p className="text-cocoa text-[12px]">Anyone with this link can view the collection title and its bookmarks. Revoking it immediately disables the old link.</p><Link to={shareHref} className="text-accent text-[13px] underline break-all">Open shared collection</Link><input aria-label="Public collection link" readOnly value={`${typeof window === "undefined" ? "" : window.location.origin}${shareHref}`} className={field + " w-full"} /></div>}
      </div>}
    </Card>}
    {!rows.length ? <Card><p className="text-cocoa text-[13px]">No bookmarks match this view. Save a project, program or organization to get started.</p></Card> : <div className="grid grid-cols-2 max-[900px]:grid-cols-1 gap-3.5">{rows.map(item => {
      const key = bookmarkKey(item);
      return <Card key={key}><p className="text-dim text-[11px] uppercase mb-2">{item.itemType === "repo" ? "Project" : item.itemType}</p><h2 className="card-title break-words"><BookmarkLink item={item}>{item.title || item.itemId}</BookmarkLink></h2><p className="card-desc mt-2 break-all">{item.itemId}</p>
        {account && collections.length > 0 && <fieldset className="mt-4 space-y-2"><legend className="text-[12px] text-cocoa mb-2">Collections</legend>{collections.map(collection => <label key={collection.id} className="flex items-center gap-2 text-[13px] min-w-0"><input type="checkbox" className="shrink-0" disabled={pending} checked={collection.itemKeys.includes(key)} onChange={event => { const enabled = event.target.checked; mutate({ action: "member", id: collection.id, itemType: item.itemType as "repo" | "org" | "program" | "issue", itemId: item.itemId, enabled }, () => setCollections(current => current.map(row => row.id === collection.id ? { ...row, itemKeys: enabled ? [...row.itemKeys, key] : row.itemKeys.filter(value => value !== key) } : row))); }} /><span className="min-w-0 break-all">{collection.name}</span></label>)}</fieldset>}
        <button type="button" className={btn("outline", "sm") + " mt-4"} disabled={pending} onClick={() => {
          if (item.itemType === "repo") toggleSaved(item.itemId);
          else if (item.itemType === "org") toggleSavedOrg(item.itemId);
          else if (item.itemType === "program") toggleSavedProgram(item.itemId);
          else if (account && !busy.current) {
            const owner = account; busy.current = true; request.current++; setLoading(false);
            setItems(current => current.filter(value => bookmarkKey(value) !== key));
            startTransition(async () => {
              const ok = await api.savedRemove(item.itemType, item.itemId).catch(() => false);
              busy.current = false;
              if (!ok && accountRef.current === owner) { void load(owner); setError("Could not remove that bookmark."); }
            });
          }
        }}>Remove bookmark</button>
      </Card>;
    })}</div>}
  </>;
}
