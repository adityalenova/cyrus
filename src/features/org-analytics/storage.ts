/* ══ storage.ts — the browser half of the analytics dashboard ══════════
   Issue #187. Reads the three stores this browser already keeps and, while
   /organizations/analytics is open, records the app's existing
   `cyrus:analytics` events into `cyrus.analytics.events.v1`.

   Why a recorder at all: `src/lib/analyticsTracker.ts` dispatches an event
   and nothing was listening, so the dashboard had no history to draw. This
   is the listener - it persists what the app already emits, capped, with no
   payload beyond the event name. Nothing is generated: if the stores are
   empty the dashboard says so.                                        ═ */
import { collectEvents, type RecordedEvent } from "./model";

export const STORE = {
  /** written by the recorder below; the app's own event stream */
  recorder: "cyrus.analytics.events.v1",
  /** the issue ledger: one `added` day per tracked issue */
  ledger: "cyrus.issues.v1",
  /** saved searches: one `added` day per saved search */
  searches: "cyrus.searches.v1",
} as const;

/** keep the recorder small enough that reading it stays instant */
export const RECORDER_CAP = 500;

type StoredRow = { name: string; at: string };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch { /* private mode: recording stops, the page still renders */ }
}

/** Every event this browser holds, from all three stores. */
export function readRecordedEvents(): RecordedEvent[] {
  return collectEvents({
    recorded: read(STORE.recorder),
    ledger: read(STORE.ledger),
    searches: read(STORE.searches),
  });
}

/** Append one tracker event. Deduplicated by name+time because a
    StrictMode double-mount must not record the same dispatch twice. */
export function record(name: string, time: number) {
  if (!name) return;
  const raw = read(STORE.recorder);
  let rows: StoredRow[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rows = parsed as StoredRow[];
    } catch { rows = []; }
  }
  const at = new Date(time).toISOString();
  if (rows.some((r) => r.name === name && r.at === at)) return;
  rows.push({ name: name.slice(0, 80), at });
  write(STORE.recorder, JSON.stringify(rows.slice(-RECORDER_CAP)));
}

/**
 * Listen for the app's `cyrus:analytics` events while this page is open.
 * Returns the unsubscribe function. The callback runs after each recorded
 * event so the dashboard can re-read its stores without polling.
 */
export function startAnalyticsRecorder(onRecord?: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ name?: unknown; time?: unknown }>).detail;
    if (!detail || typeof detail.name !== "string") return;
    const time = typeof detail.time === "number" ? detail.time : Date.now();
    record(detail.name, time);
    onRecord?.();
  };
  window.addEventListener("cyrus:analytics", handler);
  return () => window.removeEventListener("cyrus:analytics", handler);
}
