/* ══ activity.ts — the user activity feed, in the browser and the API ══
   Issue #190 wants a GitHub-style activity feed on a user's profile:
   commits, PRs, issues and reviews, filtered by kind, with a
   contribution heatmap on top. The events arrive as GitHub's own shape
   from GET /users/{login}/events/public and are normalised once here so
   every consumer sees the same Activity rows and the same heatmap.

   Pure: nothing fetches, nothing reads the DOM. The route reads GitHub;
   the view renders what this hands back.                                 ═ */

/** A single normalised event from the GitHub activity feed. */
export type Activity = {
  /** the GitHub event id (unique within a login) */
  id: string;
  kind: ActivityKind;
  /** repo this event happened in, `owner/name` or `""` if the API omitted it */
  repo: string;
  /** display title: PR / issue title, commit first line, otherwise the repo */
  title: string;
  /** absolute URL on github.com for the underlying object, "" if none */
  url: string;
  /** GitHub-reported created_at, ISO */
  time: string;
  /** PR/issue number for PR/issue events; undefined otherwise */
  number?: number;
  /** state for PR/issue when GitHub gave one */
  state?: string;
  /** actor login for review and comment events */
  actor?: string;
};

export type ActivityKind =
  | "push" | "pr" | "issue" | "review" | "comment" | "release"
  | "fork" | "star" | "other";

/* GitHub event type -> our kind. Everything we don't name becomes "other"
   so a future event type still shows up in the feed.                     */
export const KIND_BY_EVENT: Record<string, ActivityKind> = {
  PushEvent: "push",
  CreateEvent: "push",
  DeleteEvent: "push",
  PublicEvent: "other",
  PullRequestEvent: "pr",
  PullRequestReviewEvent: "review",
  PullRequestReviewCommentEvent: "comment",
  IssueEvent: "issue",
  IssuesEvent: "issue",
  IssueCommentEvent: "comment",
  CommitCommentEvent: "comment",
  ReleaseEvent: "release",
  ForkEvent: "fork",
  WatchEvent: "star",
};

/** every kind we surface, filter chips in this order */
export const KINDS: ActivityKind[] =
  ["push", "pr", "issue", "review", "comment", "release", "fork", "star", "other"];

/** the filter label for a kind */
export const KIND_LABEL: Record<ActivityKind, string> = {
  push: "Pushes", pr: "Pull requests", issue: "Issues", review: "Reviews",
  comment: "Comments", release: "Releases", fork: "Forks", star: "Stars",
  other: "Other",
};

/* icon character per kind, from the same glyph set the platform uses;
   the "other" fallback keeps an unknown event from rendering a blank chip */
export const KIND_ICON: Record<ActivityKind, string> = {
  push: "↑", pr: "⌥", issue: "❖", review: "✓", comment: "✎",
  release: "✦", fork: "⌥", star: "★", other: "•",
};

/** The GitHub event shape is loose; only the fields we actually read
    are typed here, everything else is `unknown` on purpose. */
type GhPayload = {
  action?: string;
  commits?: unknown[];
  ref?: string;
  ref_type?: string;
  head?: string;
  release?: { tag_name?: string };
  pull_request?: {
    number?: number; title?: string; html_url?: string;
    state?: string; body?: string; draft?: boolean; merged?: boolean;
    user?: { login?: string };
  };
  issue?: {
    number?: number; title?: string; html_url?: string;
    state?: string; user?: { login?: string };
  };
  review?: {
    state?: string; html_url?: string; user?: { login?: string };
  };
  comment?: { html_url?: string; user?: { login?: string } };
  sender?: { login?: string };
};

type GhEvent = {
  id?: string;
  type?: string;
  created_at?: string;
  repo?: { id?: number; name?: string };
  payload?: GhPayload;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** one GitHub event -> one Activity, or null for rows we can't render. */
export function normalizeEvent(raw: GhEvent | null | undefined): Activity | null {
  if (!raw) return null;
  const p = raw.payload ?? {};
  const kind = KIND_BY_EVENT[str(raw.type)] ?? "other";
  const repo = str(raw.repo?.name);
  const id = str(raw.id) || `${repo}:${str(raw.created_at)}:${kind}`;
  const time = str(raw.created_at) || "";

  if (kind === "push") {
    const ref = str(p.ref ?? p.head);
    const first = Array.isArray(p.commits) ? p.commits[0] : undefined;
    const msg = first && typeof (first as { message?: unknown }).message === "string"
      ? ((first as { message: string }).message.split("\n")[0] || "")
      : "";
    const title = msg || (ref ? `push ${ref}` : "push");
    return { id, kind, repo, title, url: `https://github.com/${repo}`, time, actor: p.sender?.login };
  }

  if (kind === "pr") {
    const pr = p.pull_request ?? {};
    const title = str(pr.title) || "pull request";
    const url = str(pr.html_url) || (num(pr.number) != null ? `https://github.com/${repo}/pull/${pr.number}` : "");
    return { id, kind, repo, title, url, time, number: num(pr.number), state: str(pr.state), actor: p.sender?.login };
  }

  if (kind === "issue") {
    const it = p.issue ?? {};
    const title = str(it.title) || "issue";
    const url = str(it.html_url) || (num(it.number) != null ? `https://github.com/${repo}/issues/${it.number}` : "");
    return { id, kind, repo, title, url, time, number: num(it.number), state: str(it.state), actor: p.sender?.login };
  }

  if (kind === "review") {
    const rv = p.review ?? {};
    const state = str(rv.state);
    const title = state ? `review (${state})` : "review";
    return { id, kind, repo, title, url: str(rv.html_url) || `https://github.com/${repo}`, time, state, actor: rv.user?.login };
  }

  if (kind === "comment") {
    const c = p.comment ?? {};
    const it = p.issue ?? {};
    const title = str(it.title) || "comment";
    return { id, kind, repo, title, url: str(c.html_url) || str(it.html_url) || `https://github.com/${repo}`, time, actor: c.user?.login };
  }

  if (kind === "release") {
    const tag = str(p.release?.tag_name);
    return { id, kind, repo, title: tag ? `released ${tag}` : "released", url: `https://github.com/${repo}/releases`, time };
  }

  if (kind === "fork") {
    return { id, kind, repo, title: "forked", url: `https://github.com/${repo}`, time, actor: p.sender?.login };
  }

  if (kind === "star") {
    return { id, kind, repo, title: "starred", url: `https://github.com/${repo}`, time, actor: p.sender?.login };
  }

  /* other: still show it so the feed matches GitHub's own timeline */
  return { id, kind, repo, title: str(raw.type) || "activity", url: `https://github.com/${repo}`, time };
}

/** GitHub returns newest-first; sort defensively so the feed order is stable. */
export function sortDesc(rows: Activity[]): Activity[] {
  return rows.slice().sort((a, b) => (b.time.localeCompare(a.time) || a.id.localeCompare(b.id)));
}

/** normalize a list of raw events, dropping nulls, newest first. */
export function normalizeEvents(raw: unknown): Activity[] {
  if (!Array.isArray(raw)) return [];
  const out: Activity[] = [];
  for (const e of raw) {
    const a = normalizeEvent(e);
    if (a) out.push(a);
  }
  return sortDesc(out);
}

/* ── filtering ──────────────────────────────────────────────────────── */

/** filter by kind, then by repo substring (case-insensitive). */
export function filter(rows: Activity[], opts: { kind?: ActivityKind | "all"; q?: string }): Activity[] {
  const q = (opts.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.kind && opts.kind !== "all" && r.kind !== opts.kind) return false;
    if (q && !(r.repo.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** relative time ("2h", "3d", "5w", "1y", or "—"). */
export function relativeTime(iso: string, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  const y = Math.floor(d / 365);
  return `${y}y`;
}

/* ── contribution heatmap ─────────────────────────────────────────── */

/** a day bucket: date, count, level 0..4 (GitHub's intensity scale). */
export type HeatCell = { day: string; count: number; level: 0 | 1 | 2 | 3 | 4 };

/** YYYY-MM-DD in UTC from a Date. */
export const dayOf = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** level from count, GitHub's 0..4 scale. Zero days map to 0; 1-2/3-5/6-8/9+
    map to 1/2/3/4 so a small feed still shows gradient. */
export const levelOf = (count: number): 0 | 1 | 2 | 3 | 4 => {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
};

/** bucket activity into day cells, oldest first, one per calendar day over a
    `days`-long window ending today (inclusive), padded with zero-count cells
    so the heatmap is dense rather than a sparse list. Defaults to 53 weeks. */
export function heatmap(rows: Activity[], opts: { now?: Date; days?: number } = {}): { cells: HeatCell[]; total: number; max: number } {
  const now = opts.now ?? new Date();
  const days = Math.max(1, opts.days ?? 371);
  const counts = new Map<string, number>();
  for (const a of rows) {
    const t = Date.parse(a.time);
    if (Number.isNaN(t)) continue;
    const k = dayOf(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayMs = 86_400_000;
  const cells: HeatCell[] = [];
  let total = 0;
  let max = 0;
  for (let i = days - 1; i >= 0; i--) {
    const k = dayOf(new Date(end.getTime() - i * dayMs));
    const c = counts.get(k) ?? 0;
    total += c;
    if (c > max) max = c;
    cells.push({ day: k, count: c, level: levelOf(c) });
  }
  return { cells, total, max };
}

/* ── summary line ─────────────────────────────────────────────────── */

/** "12 pushes, 3 PRs, 2 reviews" — the top three kinds by count. */
export function summaryOf(rows: Activity[]): string {
  if (!rows.length) return "no recent activity";
  const counts = new Map<ActivityKind, number>();
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return top.map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`).join(", ");
}
