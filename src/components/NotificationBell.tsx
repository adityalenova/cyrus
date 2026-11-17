"use client"
/* ══ NotificationBell.tsx — the reader's side of the SSE feed ════════
   Mounted once, on the dashboard, not in a global provider: the bell only
   earns its socket when there is a signed-in user reading it. It opens the
   stream, merges the frames the pure lib defines, and - if this environment
   has no EventSource or the backend is offline - quietly steps back to
   polling. A failed socket is retried with exponential backoff so a server
   restart costs one reconnect, not a stuck bell.                     ═ */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/ui";
import {
  KIND_LABEL, backoffDelay, markAllRead, markRead, merge, normalizeAll,
  pollInterval, recent, unreadCount, type Notification,
} from "@/lib/notifications";

const MAX_ROWS = 50;
const LIST_LIMIT = 12;

/** read the recent window straight from the API; also the poll fallback. */
async function fetchFeed(): Promise<{ rows: Notification[]; unread: number } | null> {
  try {
    const res = await fetch("/api/notifications", { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    return { rows: normalizeAll(json.notifications), unread: Number(json.unread) || 0 };
  } catch {
    return null;
  }
}

export default function NotificationBell() {
  const { user } = useStore();
  const [rows, setRows] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(() => {});

  const unread = unreadCount(rows);

  const applySnapshot = useCallback((next: Notification[]) => setRows((prev) => merge(prev, next, MAX_ROWS)), []);

  // 1. the first page, before any frame arrives.
  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchFeed().then((f) => { if (live && f) setRows(f.rows); });
    return () => { live = false; };
  }, [user]);

  // 2. the stream, or polling where EventSource is unavailable.
  useEffect(() => {
    if (!user) return;
    let closed = false;
    let attempt = 0;
    let misses = 0;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setTimeout> | undefined;

    const schedulePoll = () => {
      poll = setTimeout(async () => {
        if (closed) return;
        const f = await fetchFeed();
        if (f) { misses = 0; setRows(f.rows); }
        else misses += 1;
        schedulePoll();
      }, pollInterval(misses));
    };

    const connect = () => {
      if (closed) return;
      if (typeof EventSource === "undefined") { setConnected(false); schedulePoll(); return; }
      es = new EventSource("/api/notifications/stream");
      es.addEventListener("snapshot", (e) => {
        setConnected(true); attempt = 0;
        try { applySnapshot(normalizeAll(JSON.parse((e as MessageEvent).data).notifications)); } catch { /* ignore a bad frame */ }
      });
      es.addEventListener("notify", (e) => {
        setConnected(true); attempt = 0;
        try {
          const one = normalizeAll([(e as MessageEvent).data ? JSON.parse((e as MessageEvent).data) : null]);
          if (one.length) applySnapshot(one);
        } catch { /* ignore */ }
      });
      es.addEventListener("unread", () => { void fetchFeed().then((f) => { if (f) setRows(f.rows); }); });
      es.onerror = () => {
        setConnected(false);
        // EventSource reconnects on its own unless it has given up; when it
        // is CLOSED we take over and back off ourselves.
        if (es && es.readyState === EventSource.CLOSED) {
          es.close();
          if (!closed) poll = setTimeout(connect, backoffDelay(attempt++));
        }
      };
    };

    connect();
    closeRef.current = () => {
      closed = true;
      if (es) es.close();
      if (poll) clearTimeout(poll);
    };
    return () => { closeRef.current(); setConnected(false); };
  }, [user, applySnapshot]);

  // close the panel on an outside click.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, [open]);

  if (!user) return null;

  const postRead = (ids: string[]) =>
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ids.length ? { ids } : { all: true }),
    }).catch(() => undefined);

  const readOne = (n: Notification) => {
    setRows((prev) => markRead(prev, n.id));
    void postRead([n.id]);
    setOpen(false);
  };
  const readAll = () => {
    setRows((prev) => markAllRead(prev));
    void postRead([]);
  };

  const shown = recent(rows, LIST_LIMIT);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative w-[38px] h-[38px] rounded-full grid place-items-center border border-line bg-card/60 text-ink transition-colors duration-200 hover:bg-peach cursor-pointer"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-accentfg text-[10px] font-mono grid place-items-center"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        {/* live region so a screen reader hears the count change without the badge */}
        <span className="sr-only" role="status" aria-live="polite">{unread ? `${unread} unread notifications` : "No unread notifications"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[46px] w-[340px] bg-card border border-line rounded-[16px] shadow-lift z-[70] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-liness">
            <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim">
              Notifications <span className={connected ? "text-accent" : "text-dim"}>· {connected ? "live" : "polling"}</span>
            </span>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-[12px] font-medium text-accent hover:underline cursor-pointer">Mark all read</button>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Avatar name={user.name} size={30} src={user.picture} />
              <p className="text-cocoa text-[13px] mt-2">Nothing yet. New hackathons, deadlines and mentions land here.</p>
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto list-none p-1.5 m-0">
              {shown.map((n) => {
                const rowCls = `w-full text-left flex gap-2.5 px-2.5 py-2 rounded-[10px] transition-colors cursor-pointer ${n.read ? "hover:bg-paper" : "bg-peach/40 hover:bg-peach"}`;
                const content = (
                  <>
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-accent"}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-[.1em] text-dim">{KIND_LABEL[n.kind]}</span>
                      <span className="block text-[13.5px] font-semibold text-ink truncate">{n.title}</span>
                      {n.body && <span className="block text-[12.5px] text-cocoa line-clamp-2">{n.body}</span>}
                    </span>
                  </>
                );
                // A row with a destination is one Link; a row without is a button.
                // Nesting an anchor inside a button would break the a11y tree.
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link to={n.href} className={rowCls} onClick={() => readOne(n)}>{content}</Link>
                    ) : (
                      <button type="button" className={rowCls} onClick={() => readOne(n)}>{content}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
