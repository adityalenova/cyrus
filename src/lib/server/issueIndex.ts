/* ══ issueIndex.ts — search over the crawled issue index ═════════════
   The whole point of the crawl is that a contributor can ask a narrow
   question ("Rust, good first issue, nobody assigned, touched this
   month") and get an answer. That needs all 40k rows in reach, so the
   gzipped index is read once per cold start, kept in module scope, and
   filtered in memory. Nothing here pretends to be live: every row is a
   GitHub API response from the snapshot date in `meta.generated`, and
   the finder says so on screen.

   The pure half (`parseQuery`, `scoreRow`, `filterIssues`) is what the
   tests exercise; the I/O half (`loadIndex`) only fetches and inflates.
   ═══════════════════════════════════════════════════════════════════ */
import { gunzipSync } from "node:zlib";

export type IssueRow = {
  /** owner/name */
  r: string;
  n: number;
  t: string;
  /** how many people GitHub shows as assigned */
  a: number;
  l: string[];
  /** the repository's primary language, null when GitHub has none */
  g: string | null;
  s: number;
  /** ISO dates, day precision */
  u: string;
  c: string;
  /** comment count */
  m: number;
  /** 1 when a label reads as beginner-friendly */
  b: 0 | 1;
};

export type IssueMeta = {
  generated: string;
  issues: number;
  repos: number;
  orgs: number;
  languages: number;
  beginner: number;
  unassigned: number;
};

export type Sort = "relevance" | "stars" | "updated" | "comments" | "oldest";
export const SORTS: Sort[] = ["relevance", "stars", "updated", "comments", "oldest"];

export type IssueQuery = {
  q: string;
  langs: string[];
  org: string;
  label: string;
  repo: string;
  beginner: boolean;
  unassigned: boolean;
  sort: Sort;
  page: number;
  per: number;
};

export const EMPTY_QUERY: IssueQuery = {
  q: "", langs: [], org: "", label: "", repo: "",
  beginner: false, unassigned: false, sort: "relevance", page: 1, per: 25,
};

const clean = (v: string | null, max: number) => (v ?? "").trim().slice(0, max).toLowerCase();

/** Query strings are user input, so everything is clamped here rather
 *  than trusted downstream: 100 rows a page, no page beyond 200. */
export function parseQuery(params: URLSearchParams): IssueQuery {
  const sort = (clean(params.get("sort"), 12) as Sort) || "relevance";
  const num = (v: string | null, min: number, max: number, fallback: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    q: (params.get("q") ?? "").trim().slice(0, 120),
    langs: [...new Set((params.get("lang") ?? "").split(",").map((s) => clean(s, 24)).filter(Boolean))].slice(0, 6),
    org: clean(params.get("org"), 39),
    label: clean(params.get("label"), 40),
    repo: clean(params.get("repo"), 80),
    beginner: params.get("beginner") === "1",
    unassigned: params.get("unassigned") === "1",
    sort: SORTS.includes(sort) ? sort : "relevance",
    page: num(params.get("page"), 1, 200, 1),
    per: num(params.get("per"), 1, 100, 25),
  };
}

const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);

/** Every token has to appear somewhere in the row, and a token that lands
 *  in the title is worth more than one that only matches the repository.
 *  Deliberately simple: this is a filter over 40k rows, not a search engine,
 *  and a ranking people can reason about beats one they cannot. */
export function scoreRow(row: IssueRow, words: string[]): number {
  if (!words.length) return 0;
  const title = row.t.toLowerCase();
  const repo = row.r.toLowerCase();
  const labels = row.l.join(" ").toLowerCase();
  const lang = (row.g ?? "").toLowerCase();
  let total = 0;
  for (const w of words) {
    let s = 0;
    if (title.includes(w)) s += title.startsWith(w) ? 6 : 4;
    if (repo.includes(w)) s += 3;
    if (labels.includes(w)) s += 2;
    if (lang === w) s += 2;
    if (!s) return -1;
    total += s;
  }
  return total;
}

export type IssuePage = { total: number; page: number; per: number; pages: number; results: IssueRow[] };

/** The three filters that have a facet rail of their own. */
type Rail = "langs" | "orgs" | "labels";

/** Which of the three rail filters this row fails. Split out so the facets
 *  can apply every filter except the rail's own. */
function failedRails(row: IssueRow, query: IssueQuery, langs: string[]): Rail[] {
  const out: Rail[] = [];
  if (langs.length && !langs.includes((row.g ?? "").toLowerCase())) out.push("langs");
  if (query.org && !row.r.toLowerCase().startsWith(query.org + "/")) out.push("orgs");
  if (query.label && !row.l.some((l) => l.toLowerCase().includes(query.label))) out.push("labels");
  return out;
}

/** The filters that no rail owns: repo, the two toggles and the text query.
 *  Returns the text score, or -1 when the row is out. */
function scoreOther(row: IssueRow, query: IssueQuery, words: string[]): number {
  if (query.repo && !row.r.toLowerCase().includes(query.repo)) return -1;
  if (query.beginner && !row.b) return -1;
  if (query.unassigned && row.a > 0) return -1;
  return scoreRow(row, words);
}

export function filterIssues(items: IssueRow[], query: IssueQuery): IssuePage {
  const words = tokens(query.q);
  const langs = query.langs.map((l) => l.toLowerCase());
  const matched: { row: IssueRow; score: number }[] = [];

  for (const row of items) {
    if (failedRails(row, query, langs).length) continue;
    const score = scoreOther(row, query, words);
    if (score < 0) continue;
    matched.push({ row, score });
  }

  type Hit = { row: IssueRow; score: number };
  const byStars = (a: Hit, b: Hit) => b.row.s - a.row.s;
  const byNewest = (a: Hit, b: Hit) => (a.row.u < b.row.u ? 1 : a.row.u > b.row.u ? -1 : byStars(a, b));
  /* with no query every row scores 0, so a stars tie-break would open the
     page on 25 issues from whichever repository has the most stars. An empty
     search is a live board, so it leads with whatever moved most recently. */
  const plain = words.length === 0;
  const cmp: Record<Sort, (a: Hit, b: Hit) => number> = {
    /* a tie on score falls back to stars, then to whoever was touched last,
       so the same query always gives the same first page */
    relevance: (a, b) =>
      b.score - a.score || (plain ? byNewest(a, b) : byStars(a, b)) || (plain ? byStars(a, b) : byNewest(a, b)),
    stars: byStars,
    updated: byNewest,
    comments: (a, b) => b.row.m - a.row.m || byStars(a, b),
    oldest: (a, b) => (a.row.c < b.row.c ? -1 : a.row.c > b.row.c ? 1 : byStars(a, b)),
  };
  matched.sort(cmp[query.sort]);

  const start = (query.page - 1) * query.per;
  return {
    total: matched.length,
    page: query.page,
    per: query.per,
    pages: Math.max(1, Math.ceil(matched.length / query.per)),
    results: matched.slice(start, start + query.per).map((m) => m.row),
  };
}

/** Facets for the filter rail: what is actually in the result set, so a
 *  chip never offers a language that returns nothing. With a query, each
 *  rail counts the rows that match every active filter except its own, so
 *  a chosen language still shows its siblings and the other rails narrow
 *  with the search. */
export function facets(items: IssueRow[], query: IssueQuery = EMPTY_QUERY) {
  const words = tokens(query.q);
  const langsQ = query.langs.map((l) => l.toLowerCase());
  const counts: Record<Rail, Map<string, number>> = { langs: new Map(), orgs: new Map(), labels: new Map() };
  const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

  for (const row of items) {
    const failed = failedRails(row, query, langsQ);
    /* failing two rail filters means every rail's own-excluded view drops it */
    if (failed.length > 1) continue;
    if (scoreOther(row, query, words) < 0) continue;
    if ((!failed.length || failed[0] === "langs") && row.g) bump(counts.langs, row.g);
    if (!failed.length || failed[0] === "orgs") bump(counts.orgs, row.r.split("/")[0]);
    if (!failed.length || failed[0] === "labels") for (const l of row.l) bump(counts.labels, l.toLowerCase());
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([value, count]) => ({ value, count }));
  return { langs: top(counts.langs, 12), orgs: top(counts.orgs, 12), labels: top(counts.labels, 14) };
}

/** What the facets depend on: the filters and the text, never the sort or
 *  the page. Two requests that only differ in those share one entry. */
export function facetKey(query: IssueQuery): string {
  return JSON.stringify([
    tokens(query.q),
    [...query.langs].sort(), query.org, query.label, query.repo, query.beginner, query.unassigned,
  ]);
}

/* ── the I/O half ─────────────────────────────────────────────────── */
let cache: { meta: IssueMeta; items: IssueRow[] } | null = null;
let loading: Promise<{ meta: IssueMeta; items: IssueRow[] } | null> | null = null;

const INDEX_PATH = "/data/issues.json.gz";

/** The index is a static asset, so a serverless function reads it back
 *  through its own origin rather than carrying 70 MB of crawl in the
 *  bundle. One inflating pass, then it lives in module scope. */
export async function loadIndex(originUrl: string) {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      try {
        const res = await fetch(new URL(INDEX_PATH, originUrl).href, { cache: "force-cache" });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const parsed = JSON.parse(gunzipSync(buf).toString("utf8")) as { meta: IssueMeta; items: IssueRow[] };
        if (!Array.isArray(parsed?.items)) return null;
        cache = { meta: parsed.meta, items: parsed.items };
        return cache;
      } catch {
        return null;
      } finally {
        loading = null;
      }
    })();
  }
  return loading;
}

export const issueUrl = (row: IssueRow) => `https://github.com/${row.r}/issues/${row.n}`;
