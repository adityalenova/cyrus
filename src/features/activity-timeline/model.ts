/* ══ activity-timeline/model.ts — chronological activity event log ══ */

export type EventType = "commit" | "pr-opened" | "pr-merged" | "review" | "issue-opened" | "issue-closed" | "badge-earned" | "streak-milestone" | "comment";

export interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  detail: string;
  timestamp: number;
  repoName?: string;
  url?: string;
}

export interface TimelineGroup {
  date: string;
  events: TimelineEvent[];
}

export function groupByDate(events: TimelineEvent[]): TimelineGroup[] {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const d = new Date(e.timestamp).toISOString().slice(0, 10);
    const arr = map.get(d);
    if (arr) arr.push(e); else map.set(d, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, events]) => ({ date, events: events.sort((a, b) => b.timestamp - a.timestamp) }));
}

export function filterByType(events: TimelineEvent[], types: EventType[]): TimelineEvent[] {
  if (types.length === 0) return events;
  const set = new Set(types);
  return events.filter((e) => set.has(e.type));
}

export function searchEvents(events: TimelineEvent[], query: string): TimelineEvent[] {
  const q = query.toLowerCase();
  return events.filter((e) => e.title.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q));
}

export function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; total: number; pages: number; page: number } {
  const total = items.length;
  const pages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  return { items: items.slice(start, start + perPage), total, pages, page };
}

export function eventIcon(type: EventType): string {
  const icons: Record<EventType, string> = {
    "commit": "⊕", "pr-opened": "⎇", "pr-merged": "⏣", "review": "◉",
    "issue-opened": "○", "issue-closed": "●", "badge-earned": "★", "streak-milestone": "🔥", "comment": "💬",
  };
  return icons[type] ?? "·";
}

export function countByType(events: TimelineEvent[]): Record<EventType, number> {
  const counts: Partial<Record<EventType, number>> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts as Record<EventType, number>;
}
