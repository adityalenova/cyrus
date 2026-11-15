/* ══ GET /api/issues — the issue finder's data ════════════════════
   Read-only search over the crawled snapshot. The response carries the
   snapshot date with it, because a list of "open issues" that does not
   say when it was read is a list of guesses. */
import { facetKey, facets, filterIssues, issueUrl, loadIndex, parseQuery, type IssueMeta, type IssueQuery, type IssueRow } from "@/lib/server/issueIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* in-process guard: this endpoint filters 40k rows, so a single visitor
   should not be able to make it do that hundreds of times a minute.
   The window is per address and the map is swept when it grows, so a busy
   day of unique visitors cannot leave the process holding every IP it saw. */
const WINDOW = 60_000;
const LIMIT = 60;
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [key, e] of hits) if (now - e.t > WINDOW) hits.delete(key);
  }
  const e = hits.get(ip);
  if (!e || now - e.t > WINDOW) { hits.set(ip, { n: 1, t: now }); return false; }
  if (e.n >= LIMIT) return true;
  e.n++;
  return false;
}

/* facets are recomputed per query now, so the result is kept by the filters
   that shaped it (not the sort or page). Insertion-ordered Map, oldest entry
   dropped past the cap, and the whole cache is reset if the index is reloaded. */
const FACET_CACHE_MAX = 200;
const facetCache = new Map<string, ReturnType<typeof facets>>();
let facetCacheItems: unknown = null;
function facetsFor(items: IssueRow[], query: IssueQuery) {
  if (facetCacheItems !== items) { facetCache.clear(); facetCacheItems = items; }
  const key = facetKey(query);
  const hit = facetCache.get(key);
  if (hit) return hit;
  const fresh = facets(items, query);
  if (facetCache.size >= FACET_CACHE_MAX) facetCache.delete(facetCache.keys().next().value as string);
  facetCache.set(key, fresh);
  return fresh;
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ error: "too many searches - try again in a minute" }, { status: 429 });

  const url = new URL(req.url);
  const index = await loadIndex(url.origin + "/");
  if (!index) {
    return Response.json({ error: "the issue index is not available yet" }, { status: 503 });
  }

  const query = parseQuery(url.searchParams);
  const page = filterIssues(index.items, query);

  return Response.json({
    meta: index.meta satisfies IssueMeta,
    query,
    total: page.total,
    page: page.page,
    per: page.per,
    pages: page.pages,
    facets: facetsFor(index.items, query),
    issues: page.results.map((row: IssueRow) => ({
      url: issueUrl(row),
      repo: row.r,
      number: row.n,
      title: row.t,
      labels: row.l,
      lang: row.g,
      stars: row.s,
      updated: row.u,
      created: row.c,
      comments: row.m,
      assignees: row.a,
      beginner: row.b === 1,
    })),
  });
}
