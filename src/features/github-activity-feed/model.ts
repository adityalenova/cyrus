/* ══ model.ts — the GitHub event feed, normalised once ════════════════
   Issue #190: a timeline of someone's public GitHub activity, filtered by
   event type, with a 90-day contribution heatmap. GitHub's Events API
   returns a loose payload per event type; everything here is pure so the
   route handler, the client feed and the vitest suite agree on one shape.

   Nothing fetches and nothing reads the DOM. No fabricated rows: the
   mapper returns null for anything it cannot identify, and the heatmap
   only counts timestamps that actually arrived.                        ═ */

/** The kinds the feed filters on. `create` is GitHub's CreateEvent
    (branch, tag or repository), kept apart from `push` because the
    issue asks for it by name and it reads differently in a timeline. */
export type EventKind =
  | "push" | "pr" | "issue" | "review" | "star" | "fork" | "create" | "other";

export type FeedEvent = {
  /** GitHub's event id; unique per event, stable across refetches */
  id: string;
  kind: EventKind;
  /** the raw GitHub event type, kept for the "other" rows */
  type: string;
  /** `owner/name`, or "" when GitHub omitted the repository */
  repo: string;
  /** one line describing what happened */
  title: string;
  /** github.com URL for the subject, "" when the payload carried none */
  url: string;
  /** ISO timestamp straight from GitHub, "" if missing */
  time: string;
};

export const KIND_ORDER: EventKind[] = ["push", "pr", "issue", "review", "create", "star", "fork", "other"];

export const KIND_LABEL: Record<EventKind, string> = {
  push: "Pushes",
  pr: "Pull requests",
  issue: "Issues",
  review: "Reviews",
  create: "Created",
  star: "Stars",
  fork: "Forks",
  other: "Other",
};

/** monospace glyphs, not emoji: they inherit the accent colour and never
    shift the baseline between rows */
export const KIND_ICON: Record<EventKind, string> = {
  push: "↑", pr: "⌥", issue: "❖", review: "✓",
  create: "＋", star: "★", fork: "⑂", other: "•",
};

type GhPayload = {
  action?: string;
  before?: string;
  head?: string;
  ref?: string;
  ref_type?: string;
  size?: number;
  commits?: { message?: string }[];
  pull_request?: {
    number?: number; title?: string; html_url?: string; state?: string;
    base?: { ref?: string };
  };
  issue?: { number?: number; title?: string; html_url?: string; state?: string };
  review?: { state?: string; html_url?: string };
  forkee?: { full_name?: string; html_url?: string };
};

type GhEvent = {
  id?: string;
  type?: string;
  created_at?: string;
  repo?: { name?: string };
  payload?: GhPayload;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

/** GitHub's own username rule: 1-39 characters, alphanumerics and single
    hyphens, never leading or trailing. Shared with the route handler so a
    malformed login is a 400 before any upstream call is spent. */
export const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export function isValidLogin(login: string): boolean {
  return LOGIN_RE.test(login);
}

const repoUrl = (repo: string) => (repo ? `https://github.com/${repo}` : "");

/** One GitHub event -> one FeedEvent, or null when there is nothing
    honest to show (no type and no repository). */
export function mapEvent(raw: unknown): FeedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as GhEvent;
  const type = str(e.type);
  const p = e.payload ?? {};
  const repo = str(e.repo?.name);
  const time = str(e.created_at);
  const id = str(e.id) || `${type}:${repo}:${time}`;
  if (!type) return null;

  const base = { id, type, repo, time };

  if (type === "PushEvent") {
    const first = Array.isArray(p.commits) ? p.commits[0]?.message : "";
    const headline = str(first).split("\n")[0].slice(0, 140);
    const ref = str(p.ref).replace(/^refs\/heads\//, "");
    const before = str(p.before);
    const head = str(p.head);
    /* a compare link only when both shas look real; the initial push on a
       branch reports an all-zero "before" and GitHub's compare page 404s */
    const comparable = /^[0-9a-f]{7,40}$/i.test(before) && /^[0-9a-f]{7,40}$/i.test(head) && !/^0+$/.test(before);
    const count = num(p.size) ?? (Array.isArray(p.commits) ? p.commits.length : 0);
    const title = headline || (ref ? `pushed to ${ref}` : "pushed");
    return {
      ...base, kind: "push",
      title: count > 1 ? `${title} (+${count - 1} more)` : title,
      url: comparable ? `https://github.com/${repo}/compare/${before}...${head}` : repoUrl(repo),
    };
  }

  if (type === "PullRequestEvent") {
    const pr = p.pull_request ?? {};
    const n = num(pr.number);
    const action = str(p.action);
    const title = str(pr.title) || (n ? `#${n}` : "pull request");
    return {
      ...base, kind: "pr",
      title: action ? `${action} pull request: ${title}` : title,
      url: str(pr.html_url) || (n ? `https://github.com/${repo}/pull/${n}` : repoUrl(repo)),
    };
  }

  if (type === "IssuesEvent") {
    const it = p.issue ?? {};
    const n = num(it.number);
    const action = str(p.action);
    const title = str(it.title) || (n ? `#${n}` : "issue");
    return {
      ...base, kind: "issue",
      title: action ? `${action} issue: ${title}` : title,
      url: str(it.html_url) || (n ? `https://github.com/${repo}/issues/${n}` : repoUrl(repo)),
    };
  }

  if (type === "PullRequestReviewEvent") {
    const state = str(p.review?.state).toLowerCase();
    const n = num(p.pull_request?.number);
    const title = n ? `reviewed pull request #${n}${state ? ` (${state})` : ""}` : `review${state ? ` (${state})` : ""}`;
    return {
      ...base, kind: "review", title,
      url: str(p.review?.html_url) || (n ? `https://github.com/${repo}/pull/${n}` : repoUrl(repo)),
    };
  }

  if (type === "WatchEvent") {
    return { ...base, kind: "star", title: `starred ${repo || "a repository"}`, url: repoUrl(repo) };
  }

  if (type === "ForkEvent") {
    const fork = p.forkee ?? {};
    const to = str(fork.full_name);
    return {
      ...base, kind: "fork",
      title: to ? `forked ${repo} to ${to}` : `forked ${repo || "a repository"}`,
      url: str(fork.html_url) || repoUrl(repo),
    };
  }

  if (type === "CreateEvent") {
    const refType = str(p.ref_type) || "reference";
    const ref = str(p.ref);
    const label = refType === "repository" ? "repository" : refType;
    const title = ref
      ? `created ${label} ${ref}`
      : `created ${label}`;
    const url = refType === "branch" && ref
      ? `https://github.com/${repo}/tree/${encodeURIComponent(ref)}`
      : refType === "tag" && ref
        ? `https://github.com/${repo}/releases/tag/${encodeURIComponent(ref)}`
        : repoUrl(repo);
    return { ...base, kind: "create", title, url };
  }

  /* Everything else keeps GitHub's own type name so a newer event type
     still appears, labelled as what it is rather than guessed at. */
  return { ...base, kind: "other", title: `${type.replace(/Event$/, "")} on ${repo || "GitHub"}`, url: repoUrl(repo) };
}

/** Map a raw API list, dropping rows we cannot render, newest first. */
export function mapEvents(raw: unknown): FeedEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedEvent[] = [];
  for (const e of raw) {
    const mapped = mapEvent(e);
    if (mapped) out.push(mapped);
  }
  return sortNewestFirst(out);
}

/** GitHub returns newest-first; sort defensively so a cached page and a
    fresh one never disagree about ordering. */
export function sortNewestFirst(events: FeedEvent[]): FeedEvent[] {
  return events.slice().sort((a, b) => {
    const ta = Date.parse(a.time);
    const tb = Date.parse(b.time);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id.localeCompare(b.id);
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta || a.id.localeCompare(b.id);
  });
}

/* ── filtering ─────────────────────────────────────────────────────── */

export type FeedFilter = { kind: EventKind | "all"; q?: string };

export function filterEvents(events: FeedEvent[], f: FeedFilter): FeedEvent[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return events.filter((e) => {
    if (f.kind !== "all" && e.kind !== f.kind) return false;
    if (!q) return true;
    return e.repo.toLowerCase().includes(q) || e.title.toLowerCase().includes(q);
  });
}

/** kind counts in KIND_ORDER, only the kinds present; drives the chips. */
export function kindCounts(events: FeedEvent[]): { kind: EventKind; count: number }[] {
  const m = new Map<EventKind, number>();
  for (const e of events) m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
  return KIND_ORDER.filter((k) => m.has(k)).map((kind) => ({ kind, count: m.get(kind) ?? 0 }));
}

/* ── contribution heatmap ─────────────────────────────────────────── */

export type HeatCell = {
  /** YYYY-MM-DD, UTC, so the same event buckets the same everywhere */
  day: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

/** YYYY-MM-DD for an instant, in UTC. */
export function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** GitHub's five-step intensity, stretched so a small feed still shows
    gradient: 1-2 -> 1, 3-5 -> 2, 6-8 -> 3, 9+ -> 4. */
export function levelOf(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

const DAY_MS = 86_400_000;

/**
 * Bucket event timestamps into one cell per UTC day over the last `days`
 * days, ending today (inclusive) and padded with zero cells so the grid is
 * dense. Timestamps are parsed as instants and bucketed in UTC: an event
 * sent as `2026-11-22T23:30:00-05:00` belongs to 2026-11-23, and an event
 * outside the window is not drawn at all (it is not silently moved).
 */
export function heatmap(
  events: FeedEvent[],
  opts: { now?: Date; days?: number } = {},
): { cells: HeatCell[]; total: number; max: number; activeDays: number } {
  const now = opts.now ?? new Date();
  const days = Math.max(1, Math.floor(opts.days ?? 90));
  const counts = new Map<string, number>();
  for (const e of events) {
    const t = Date.parse(e.time);
    if (Number.isNaN(t)) continue;
    const k = dayKey(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  /* today at UTC midnight, so "today" is the same day for every visitor */
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cells: HeatCell[] = [];
  let total = 0;
  let max = 0;
  let activeDays = 0;
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(new Date(end - i * DAY_MS));
    const count = counts.get(day) ?? 0;
    total += count;
    if (count > max) max = count;
    if (count > 0) activeDays++;
    cells.push({ day, count, level: levelOf(count) });
  }
  return { cells, total, max, activeDays };
}

/** Group heatmap cells into columns of seven, Sunday first, with leading
    blanks so the first column starts on the right weekday. Pure layout:
    the component only maps these to boxes. */
export function heatWeeks(cells: HeatCell[]): (HeatCell | null)[][] {
  if (!cells.length) return [];
  const first = new Date(`${cells[0].day}T00:00:00Z`);
  const pad = Number.isNaN(first.getTime()) ? 0 : first.getUTCDay();
  const flat: (HeatCell | null)[] = Array.from({ length: pad }, (): HeatCell | null => null);
  flat.push(...cells);
  const weeks: (HeatCell | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

/** "4h", "2d", "3w" — compact age for a timeline row. */
export function age(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  return `${Math.floor(d / 365)}y`;
}

/** One line under the login: "12 pushes, 3 pull requests" (top three). */
export function summary(events: FeedEvent[]): string {
  if (!events.length) return "no public events to show";
  const counts = kindCounts(events).sort((a, b) => b.count - a.count || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return counts.slice(0, 3).map((c) => `${c.count} ${KIND_LABEL[c.kind].toLowerCase()}`).join(", ");
}

/* ── HTTP status -> client state ──────────────────────────────────── */

/** The body every response from /api/github/events/[login] carries. A
    successful read has `events` and `fetchedAt`; a failure has `error`
    and never invents rows. `stale` marks a cached list served while
    GitHub was throttling us. */
export type EventsPayload = {
  events: FeedEvent[];
  /** epoch ms of the upstream read that produced `events`, null on error */
  fetchedAt: number | null;
  stale?: boolean;
  error?: string;
};

/** The five states the feed can be in. `invalid` means the login did not
    pass GitHub's own rule; `not-found` means GitHub said 404. */
export type FeedState = "ok" | "invalid" | "not-found" | "rate-limited" | "error";

/**
 * Map the route's HTTP status to a feed state. 403 is included with 429
 * because the unauthenticated Events API answers 403 when the hourly quota
 * is gone; both mean "GitHub is throttling us", never "no activity".
 */
export function stateForStatus(status: number): FeedState {
  if (status === 200) return "ok";
  if (status === 400) return "invalid";
  if (status === 404) return "not-found";
  if (status === 403 || status === 429) return "rate-limited";
  return "error";
}
