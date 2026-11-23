/* ══ model.ts — the analytics behind /organizations/analytics ══════════
   Issue #187. Two real sources and nothing else:

   (a) what this browser actually recorded for this visitor —
       `cyrus.analytics.events.v1` (the app's own `cyrus:analytics`
       stream, captured by the recorder on this page), `cyrus.issues.v1`
       (the issue ledger, which stores the day each issue was added) and
       `cyrus.searches.v1` (saved searches, same day precision);
   (b) the crawl snapshot in src/data — per-organisation rows from
       issueSignals.ts and the snapshot totals in crawlStats.ts.

   Time series only ever come from (a). The snapshot is a single point in
   time, so nothing here draws a trend from it: organisation panels show
   counts, and the page says a trend cannot be computed from one snapshot.

   Pure by design: every function below takes parsed input. The browser
   reads localStorage in storage.ts, the tests call these directly.     ═ */

/* ── recorded visitor events ──────────────────────────────────────── */

export type EventSource = "tracker" | "ledger" | "search";

export type RecordedEvent = {
  /** stable id: `tracker:<n>`, `ledger:<issue url>`, `search:<id>` */
  id: string;
  /** e.g. "issue.tracked", "search.saved", or a name from the tracker */
  name: string;
  /** ISO instant. Day-precision rows are anchored at noon UTC. */
  at: string;
  source: EventSource;
};

export const SOURCE_LABEL: Record<EventSource, string> = {
  tracker: "tracker stream",
  ledger: "issue ledger",
  search: "saved searches",
};

export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export const DAY_MS = 86_400_000;
/** the crawler writes a day, not an instant; noon UTC keeps that day intact
    in every timezone this site is likely to be read in */
export const DAY_ANCHOR = "T12:00:00.000Z";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function utcDay(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** epoch ms for a stored timestamp, or null. Accepts ISO strings and the
    epoch milliseconds the tracker emits. */
export function instantOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function safeJson(raw: string | null | undefined): unknown {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Rows written by the recorder. Anything malformed is dropped, never
    repaired into a plausible-looking event. */
export function parseRecorded(raw: string | null | undefined): RecordedEvent[] {
  const body = safeJson(raw);
  if (!Array.isArray(body)) return [];
  const out: RecordedEvent[] = [];
  for (let i = 0; i < body.length; i++) {
    const row = body[i];
    if (!row || typeof row !== "object") continue;
    const r = row as { name?: unknown; at?: unknown; time?: unknown };
    const at = instantOf(r.at ?? r.time);
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    if (at === null || !name) continue;
    out.push({ id: `tracker:${i}`, name, at: new Date(at).toISOString(), source: "tracker" });
  }
  return out;
}

/** One event per issue the visitor put on the board, dated by the ledger's
    own `added` day. The stage is part of the name, so a later stage change
    is not invented here — only what was stored is read. */
export function eventsFromLedger(raw: string | null | undefined): RecordedEvent[] {
  const body = safeJson(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const out: RecordedEvent[] = [];
  for (const [url, value] of Object.entries(body as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as { stage?: unknown; added?: unknown };
    const day = typeof entry.added === "string" ? entry.added.slice(0, 10) : "";
    if (!ISO_DAY.test(day)) continue;
    const stage = typeof entry.stage === "string" && entry.stage.trim() ? entry.stage.trim() : "saved";
    out.push({
      id: `ledger:${url}`,
      name: `issue.${stage}`,
      at: `${day}${DAY_ANCHOR}`,
      source: "ledger",
    });
  }
  return out;
}

/** One event per saved search, dated by its `added` day. */
export function eventsFromSearches(raw: string | null | undefined): RecordedEvent[] {
  const body = safeJson(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const out: RecordedEvent[] = [];
  for (const [id, value] of Object.entries(body as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as { added?: unknown };
    const day = typeof entry.added === "string" ? entry.added.slice(0, 10) : "";
    if (!ISO_DAY.test(day)) continue;
    out.push({
      id: `search:${id}`,
      name: "search.saved",
      at: `${day}${DAY_ANCHOR}`,
      source: "search",
    });
  }
  return out;
}

/** Merge the three stores, newest first, one row per id. */
export function collectEvents(parts: {
  recorded?: string | null;
  ledger?: string | null;
  searches?: string | null;
}): RecordedEvent[] {
  const all = [
    ...parseRecorded(parts.recorded),
    ...eventsFromLedger(parts.ledger),
    ...eventsFromSearches(parts.searches),
  ];
  const seen = new Set<string>();
  const rows = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  return rows.sort((a, b) => (Date.parse(b.at) - Date.parse(a.at)) || a.id.localeCompare(b.id));
}

/** The earliest instant this browser holds, or null when it holds none.
    This is the "since <date>" the time-series panels print. */
export function historyStart(events: RecordedEvent[]): string | null {
  let min: number | null = null;
  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    if (min === null || t < min) min = t;
  }
  return min === null ? null : new Date(min).toISOString();
}

/* ── windows and buckets ──────────────────────────────────────────── */

/** The UTC days of a range, oldest first, ending today (inclusive). */
export function windowDays(range: RangeDays, now: Date = new Date()): string[] {
  const days = Math.max(1, Math.floor(range));
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(utcDay(new Date(end - i * DAY_MS)));
  return out;
}

/** The equally long window immediately before the selected one. */
export function previousWindowDays(range: RangeDays, now: Date = new Date()): string[] {
  const days = Math.max(1, Math.floor(range));
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: string[] = [];
  for (let i = days * 2 - 1; i >= days; i--) out.push(utcDay(new Date(end - i * DAY_MS)));
  return out;
}

export type DayBucket = { day: string; count: number };

/** Events per UTC day in the selected window; zero days are kept so the
    chart's x-axis is a calendar, not a list of active days. */
export function bucketEvents(events: RecordedEvent[], range: RangeDays, now: Date = new Date()): DayBucket[] {
  const days = windowDays(range, now);
  const inWindow = new Set(days);
  const counts = new Map<string, number>();
  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    const day = utcDay(new Date(t));
    if (!inWindow.has(day)) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return days.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

export type Comparison = {
  /** events inside the selected window */
  current: number;
  /** events in the equally long window before it */
  previous: number;
  /** current - previous */
  delta: number;
  /** percent change, null when the previous window held nothing to divide by */
  pct: number | null;
};

export function periodComparison(events: RecordedEvent[], range: RangeDays, now: Date = new Date()): Comparison {
  const count = (days: string[]) => {
    const set = new Set(days);
    let n = 0;
    for (const e of events) {
      const t = Date.parse(e.at);
      if (Number.isNaN(t)) continue;
      if (set.has(utcDay(new Date(t)))) n++;
    }
    return n;
  };
  const current = count(windowDays(range, now));
  const previous = count(previousWindowDays(range, now));
  const delta = current - previous;
  const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
  return { current, previous, delta, pct };
}

export type SeriesPoint = { day: string; current: number; previous: number };

/** Running totals, day by day, for the current window and the one before
    it. Two lines that share an x-axis without pretending the days are the
    same dates. */
export function cumulativeSeries(events: RecordedEvent[], range: RangeDays, now: Date = new Date()): SeriesPoint[] {
  const cur = bucketEvents(events, range, now);
  const prev = bucketEvents(events, range, new Date(now.getTime() - range * DAY_MS));
  let a = 0;
  let b = 0;
  return cur.map((row, i) => {
    a += row.count;
    b += prev[i]?.count ?? 0;
    return { day: row.day, current: a, previous: b };
  });
}

/** The most recent recorded instant and its age, in whole seconds. */
export function lastEvent(events: RecordedEvent[], now: Date = new Date()): { at: string | null; seconds: number | null } {
  let max: number | null = null;
  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    if (max === null || t > max) max = t;
  }
  if (max === null) return { at: null, seconds: null };
  return { at: new Date(max).toISOString(), seconds: Math.max(0, Math.floor((now.getTime() - max) / 1000)) };
}

/** "12s", "4m", "2h" — compact, for the "last event Ns ago" line. */
export function elapsedLabel(seconds: number | null): string {
  if (seconds === null) return "no event recorded yet";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export type NameCount = { name: string; count: number };

/** Event names by count, largest first, then alphabetically. */
export function nameCounts(events: RecordedEvent[]): NameCount[] {
  const m = new Map<string, number>();
  for (const e of events) m.set(e.name, (m.get(e.name) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type HistoryState = "no-history" | "no-events-in-range" | "ready";

/** Which empty state the time-series panels show. "no-history" means this
    browser has never recorded anything; "no-events-in-range" means it has
    history, but none inside the selected window. */
export function historyState(events: RecordedEvent[], range: RangeDays, now: Date = new Date()): HistoryState {
  if (events.length === 0) return "no-history";
  const c = periodComparison(events, range, now);
  return c.current === 0 && c.previous === 0 ? "no-events-in-range" : "ready";
}

/* ── crawl snapshot aggregates ────────────────────────────────────── */

/** The columns of src/data/issueSignals.ts this page reads. */
export type SnapshotIssue = {
  repo: string;
  title: string;
  url: string;
  number: number;
  stars: number;
  lang: string | null;
  labels: string[];
  updated: string;
  beginner: boolean;
};

export type SnapshotTotals = {
  issues: number;
  reposWithIssues: number;
  orgs: number;
  languages: number;
  beginnerLabelled: number;
  crawledAt: string;
};

export type OrgAggregate = {
  org: string;
  /** distinct repositories of this org in the detail rows */
  repos: number;
  /** open issues of this org in the detail rows */
  issues: number;
  beginner: number;
  /** beginner / issues, 0 when the org has no rows */
  beginnerShare: number;
  /** primary languages seen in this org's rows, alphabetical */
  languages: string[];
};

export const orgOf = (repo: string): string => repo.split("/")[0] ?? "";

/** Per-organisation counts from the crawl's detail rows. Deliberately not a
    share of the whole crawl: only the detail rows carry a language and a
    beginner flag, and the page says so next to the table. */
export function orgAggregates(rows: SnapshotIssue[]): OrgAggregate[] {
  const map = new Map<string, { repos: Set<string>; issues: number; beginner: number; langs: Set<string> }>();
  for (const row of rows) {
    const org = orgOf(row.repo);
    if (!org) continue;
    const acc = map.get(org) ?? { repos: new Set<string>(), issues: 0, beginner: 0, langs: new Set<string>() };
    acc.repos.add(row.repo);
    acc.issues++;
    if (row.beginner) acc.beginner++;
    if (row.lang) acc.langs.add(row.lang);
    map.set(org, acc);
  }
  return [...map].map(([org, acc]) => ({
    org,
    repos: acc.repos.size,
    issues: acc.issues,
    beginner: acc.beginner,
    beginnerShare: acc.issues ? acc.beginner / acc.issues : 0,
    languages: [...acc.langs].sort(),
  })).sort((a, b) => b.issues - a.issues || a.org.localeCompare(b.org));
}

export type RepoAggregate = {
  repo: string;
  org: string;
  issues: number;
  lang: string;
  beginner: number;
};

/** Repository-level view: one row per repository in the detail set. */
export function repoAggregates(rows: SnapshotIssue[]): RepoAggregate[] {
  const map = new Map<string, RepoAggregate>();
  for (const row of rows) {
    const acc = map.get(row.repo) ?? { repo: row.repo, org: orgOf(row.repo), issues: 0, lang: row.lang ?? "—", beginner: 0 };
    acc.issues++;
    if (row.beginner) acc.beginner++;
    map.set(row.repo, acc);
  }
  return [...map.values()].sort((a, b) => b.issues - a.issues || a.repo.localeCompare(b.repo));
}

export type LanguageCount = { lang: string; issues: number };

/** Language mix across the detail rows; "—" collects rows GitHub gave no
    primary language for. */
export function languageMix(rows: SnapshotIssue[]): LanguageCount[] {
  const m = new Map<string, number>();
  for (const row of rows) {
    const lang = row.lang ?? "—";
    m.set(lang, (m.get(lang) ?? 0) + 1);
  }
  return [...m].map(([lang, issues]) => ({ lang, issues }))
    .sort((a, b) => b.issues - a.issues || a.lang.localeCompare(b.lang));
}

/** Beginner-labelled share of the detail rows, 0..1, null when empty. */
export function beginnerShare(rows: SnapshotIssue[]): number | null {
  if (!rows.length) return null;
  return rows.filter((r) => r.beginner).length / rows.length;
}

export const percent = (value: number | null, digits = 1): string =>
  value === null ? "—" : `${(value * 100).toFixed(digits)}%`;

/* ── CSV shapes ───────────────────────────────────────────────────── */

/** One row per day of the selected range, zero days included, so an export
    matches the chart the visitor is looking at. */
export type SeriesCsvRow = { day: string; events: number };
export function seriesCsvRows(buckets: DayBucket[]): SeriesCsvRow[] {
  return buckets.map((b) => ({ day: b.day, events: b.count }));
}

export type OrgCsvRow = {
  organisation: string;
  repositories: number;
  openIssues: number;
  beginnerLabelled: number;
  beginnerShare: string;
  languages: string;
};
export function orgCsvRows(aggs: OrgAggregate[]): OrgCsvRow[] {
  return aggs.map((a) => ({
    organisation: a.org,
    repositories: a.repos,
    openIssues: a.issues,
    beginnerLabelled: a.beginner,
    beginnerShare: percent(a.beginnerShare, 0),
    languages: a.languages.join(" "),
  }));
}

export type RepoCsvRow = {
  repository: string;
  organisation: string;
  openIssues: number;
  language: string;
  beginnerLabelled: number;
};
export function repoCsvRows(aggs: RepoAggregate[]): RepoCsvRow[] {
  return aggs.map((a) => ({
    repository: a.repo,
    organisation: a.org,
    openIssues: a.issues,
    language: a.lang,
    beginnerLabelled: a.beginner,
  }));
}

/** The date a snapshot was taken, as the page prints it. */
export const snapshotDate = (totals: SnapshotTotals): string => totals.crawledAt;
