/* ══ notifications.ts — the shape of a notification, kept pure ═══════
   Issue #185 wants a real-time feed: hackathons, deadline reminders, new
   followers and mentions, arriving over a Server-Sent Events stream and
   readable in a bell dropdown. Everything that can be decided without a
   socket or a database - how rows are ordered, de-duplicated, counted and
   marked read, how the SSE frames are framed, and how hard the client should
   back off before reconnecting - lives here, so the view and the route are
   thin and the logic is unit-tested rather than clicked.              ═ */

export const NOTIF_KINDS = ["hackathon", "deadline", "follower", "mention"] as const;
export type NotifKind = (typeof NOTIF_KINDS)[number];

export const KIND_LABEL: Record<NotifKind, string> = {
  hackathon: "New hackathon",
  deadline: "Deadline reminder",
  follower: "New follower",
  mention: "You were mentioned",
};

/** one notification as it travels over the wire and into the dropdown. */
export type Notification = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  /** absolute path on this site to open when clicked; "" if nowhere to go */
  href: string;
  read: boolean;
  /** ISO timestamp; the stream and the store both emit UTC */
  createdAt: string;
};

const isKind = (v: unknown): v is NotifKind =>
  typeof v === "string" && (NOTIF_KINDS as readonly string[]).includes(v);

/** coerce an untrusted row (API JSON) into a Notification, or null if junk. */
export function normalize(raw: unknown): Notification | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (!isKind(r.kind)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: r.id,
    kind: r.kind,
    title: str(r.title),
    body: str(r.body),
    href: str(r.href),
    read: r.read === true,
    createdAt: str(r.createdAt),
  };
}

export function normalizeAll(raw: unknown): Notification[] {
  if (!Array.isArray(raw)) return [];
  const out: Notification[] = [];
  for (const e of raw) {
    const n = normalize(e);
    if (n) out.push(n);
  }
  return sortNewest(dedupe(out));
}

/** newest first; ties broken by id so the order is stable for a list key. */
export function sortNewest(rows: Notification[]): Notification[] {
  return rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/** first row wins for each id, preserving the incoming (newest-first) order. */
export function dedupe(rows: Notification[]): Notification[] {
  const seen = new Set<string>();
  const out: Notification[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export const unreadCount = (rows: Notification[]): number => rows.reduce((n, r) => n + (r.read ? 0 : 1), 0);

/* The reducers return new arrays: the bell re-renders off identity change,
   and a shared, mutated array would make React skip the update.            */
export function markRead(rows: Notification[], id: string): Notification[] {
  return rows.map((r) => (r.id === id && !r.read ? { ...r, read: true } : r));
}

export function markAllRead(rows: Notification[]): Notification[] {
  return rows.map((r) => (r.read ? r : { ...r, read: true }));
}

/** keep the freshest `limit` rows; the dropdown never grows without bound. */
export function recent(rows: Notification[], limit: number): Notification[] {
  return sortNewest(rows).slice(0, Math.max(0, limit));
}

/** merge a live batch into what the client already shows, newest first,
    capped, and honouring ids the user already read locally.               */
export function merge(existing: Notification[], incoming: Notification[], limit: number): Notification[] {
  const readIds = new Set(existing.filter((e) => e.read).map((e) => e.id));
  const stamped = incoming.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
  return recent(dedupe([...stamped, ...existing]), limit);
}

/* ── SSE framing ─────────────────────────────────────────────────────
   A frame is blank-line terminated; every data line carries its own
   `data:` prefix, so a value containing a newline still decodes to one
   payload on the client.                                                 */
export function encodeSse(event: string, data: unknown): string {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const lines = text.split("\n").map((l) => `data: ${l}`);
  return `event: ${event}\n${lines.join("\n")}\n\n`;
}

/** the `last-event-id` the server echoes; a client resuming sends it back. */
export const heartbeat = (): string => encodeSse("ping", { at: "beat" });

/* ── reconnection ────────────────────────────────────────────────────
   EventSource reconnects on its own, but when it gives up the client
   takes over. delay = base * 2^attempt, clamped to cap. attempt counts
   from 0; the exponential term is capped so a long outage stops at `cap`
   instead of doubling forever.                                          */
export function backoffDelay(attempt: number, opts: { base?: number; cap?: number } = {}): number {
  const base = opts.base ?? 1000;
  const cap = opts.cap ?? 30_000;
  const n = Math.max(0, Math.floor(attempt));
  const exp = base * Math.pow(2, Math.min(n, 30));
  return Math.min(cap, exp);
}

/** polling interval once SSE is unavailable, widened after repeated
    misses so a cold backend is not hammered; never below `min`.          */
export function pollInterval(misses: number, opts: { min?: number; step?: number; max?: number } = {}): number {
  const min = opts.min ?? 15_000;
  const step = opts.step ?? 5_000;
  const max = opts.max ?? 120_000;
  const m = Math.max(0, Math.floor(misses));
  return Math.min(max, min + m * step);
}
