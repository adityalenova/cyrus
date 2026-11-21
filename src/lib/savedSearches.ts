/* ══ savedSearches.ts — the shape of a saved Issue Finder search ═══
   A saved search is the *question*, never the answer: the normalised text
   plus the filter values, so reopening re-runs the search against whatever
   the crawl holds today instead of showing a frozen list of issues.

   Every rule that decides what a filter means lives here, in one pure
   module with no Next, no React and no node imports: the finder writes it
   into the URL, the dashboard reads it back, the server validates it, and
   the vitest suite can exercise all of it without a browser.

   The ceilings mirror `parseQuery` in src/lib/server/issueIndex.ts, so a
   stored search can never be wider than a search the finder is able to
   run. Facet values are lowercased because the index compares them
   lowercased, and the controls then match case-insensitively - a search
   saved as "TypeScript" and a link typed as "typescript" open the same
   page with the same chip pressed. The free-text query keeps its case:
   that one line is what the contributor typed, and the box shows it back.
   ═══════════════════════════════════════════════════════════════════ */

/** The sort values the finder offers. Mirrors `SORTS` in
 *  src/lib/server/issueIndex.ts, repeated here on purpose: that module
 *  imports node:zlib and cannot be pulled into the client bundle. */
export const SEARCH_SORTS = ["relevance", "stars", "updated", "comments", "oldest"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

const SORT_LABEL: Record<SearchSort, string> = {
  relevance: "Best match",
  updated: "Recently touched",
  stars: "Biggest project",
  comments: "Most discussed",
  oldest: "Oldest first",
};

/** The filters this page knows. Anything else a stored search carries was
 *  written by an older build and is skipped, not thrown at. */
export const SEARCH_KEYS = ["q", "lang", "org", "label", "repo", "beginner", "unassigned", "sort"] as const;
export type SearchKey = (typeof SEARCH_KEYS)[number];

/* ceilings, the same ones parseQuery clamps to */
export const NAME_MAX = 80;
export const Q_MAX = 120;
export const LANG_MAX = 24;
export const LANG_COUNT_MAX = 6;
export const ORG_MAX = 39;
export const LABEL_MAX = 40;
export const REPO_MAX = 80;
/** one entry per filter the page has; more than this is not a search */
export const FILTER_COUNT_MAX = SEARCH_KEYS.length;

export type SearchFilters = {
  q?: string;
  lang?: string[];
  org?: string;
  label?: string;
  repo?: string;
  beginner?: boolean;
  unassigned?: boolean;
  sort?: SearchSort;
};

/** One saved search, as the board holds it and as the server stores it.
 *  `dropped` names filters the search carried that this page no longer
 *  has; it is derived on read, never stored, and only ever shown. */
export type SavedSearch = {
  id: string;
  name: string;
  filters: SearchFilters;
  /** the day it was saved, ISO day precision, like the issue ledger */
  added: string;
  dropped?: string[];
};

/** the localStorage key the board holds saved searches under */
export const SEARCHES_KEY = "cyrus.searches.v1";
export type SearchStore = Record<string, SavedSearch>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** trim and collapse inner runs; the free-text query keeps its case */
const clip = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

/** the shape the index compares against: clipped and lowercased */
const clipLower = (v: unknown, max: number): string => clip(v, max).toLowerCase();

const truthy = (v: unknown): boolean => v === true || v === 1 || v === "1";

const asLangList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .map((s) => clipLower(s, LANG_MAX)).filter(Boolean);

/** True for a key a search may carry, false for anything retired or invented. */
export const isSearchKey = (k: string): k is SearchKey => (SEARCH_KEYS as readonly string[]).includes(k);

/* case-insensitive, then by text, so the stored list has one right order */
const byName = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase() ? 0 : a.toLowerCase() < b.toLowerCase() ? -1 : 1;

/** The URL the finder runs, from stored filters. Canonical key order, so
 *  the same search always writes the same shareable link. */
export function paramsFromFilters(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.lang?.length) p.set("lang", [...filters.lang].sort(byName).join(","));
  if (filters.org) p.set("org", filters.org);
  if (filters.label) p.set("label", filters.label);
  if (filters.repo) p.set("repo", filters.repo);
  if (filters.beginner) p.set("beginner", "1");
  if (filters.unassigned) p.set("unassigned", "1");
  if (filters.sort && filters.sort !== "relevance") p.set("sort", filters.sort);
  return p;
}

/** The finder's own URL, from a search's filters - the link a reopen follows. */
export function searchUrl(filters: SearchFilters): string {
  const qs = paramsFromFilters(filters).toString();
  return qs ? `/issues?${qs}` : "/issues";
}

/** Keys that belong to the row rather than the search: never a filter this
 *  page has, and never worth telling anyone about. `page` is a live read of
 *  one search, so it is deliberately not part of a saved one either. */
const ENVELOPE = ["filters", "name", "title", "id", "itemId", "added", "createdAt", "page"];
const unknownKeysOf = (raw: Record<string, unknown>): string[] =>
  Object.keys(raw).filter((k) => !isSearchKey(k) && !ENVELOPE.includes(k));

/**
 * Read filters from whatever the caller has: a live URLSearchParams, the
 * JSON a browser stored, or a row that came back from the server. Unknown
 * keys are skipped rather than rejected, values are clipped to the same
 * ceilings the finder uses, and empty or default filters disappear - so a
 * search saved before a filter was retired still opens.
 */
export function normaliseFilters(input: unknown): SearchFilters {
  const raw: Record<string, unknown> =
    input instanceof URLSearchParams ? Object.fromEntries(input) : isPlainObject(input) ? input : {};

  const out: SearchFilters = {};
  const q = clip(raw.q, Q_MAX);
  if (q) out.q = q;

  const langs = [...new Set(asLangList(raw.lang))].sort(byName);
  if (langs.length) out.lang = langs.slice(0, LANG_COUNT_MAX);

  const org = clipLower(raw.org, ORG_MAX);
  if (org) out.org = org;
  const label = clipLower(raw.label, LABEL_MAX);
  if (label) out.label = label;
  const repo = clipLower(raw.repo, REPO_MAX);
  if (repo) out.repo = repo;

  if (truthy(raw.beginner)) out.beginner = true;
  if (truthy(raw.unassigned)) out.unassigned = true;

  const sort = clipLower(raw.sort, 12);
  /* a sort that no longer exists is not a filter worth telling anyone
     about: it changes nothing about which issues match, only their order */
  if (sort && sort !== "relevance" && (SEARCH_SORTS as readonly string[]).includes(sort))
    out.sort = sort as SearchSort;

  return out;
}

/** The filters currently in the URL. */
export const filtersFromParams = (params: URLSearchParams): SearchFilters => normaliseFilters(params);

/**
 * The filters as the server is allowed to hold them: what normaliseFilters
 * writes, in its fixed key order, with defaults left out. The POST handler
 * runs searchFiltersError first and stores only this, so a row can never
 * carry a key the finder is unable to replay.
 */
export const canonicalFilters = (input: unknown): SearchFilters => normaliseFilters(input);

/**
 * Keys a link carries that this page has no filter for - the retired half
 * of a search saved before a filter was removed, or a hand-edited URL. The
 * finder runs the rest and names these, rather than breaking on them.
 */
export function unknownFilterKeys(input: URLSearchParams | Record<string, unknown>): string[] {
  const raw = input instanceof URLSearchParams ? Object.fromEntries(input) : input;
  return unknownKeysOf(raw);
}

/**
 * Decode the `meta` a saved search carries. Tolerant by design: a row from
 * before this feature, a hand-edited localStorage value and a retired
 * filter all come back as an openable search plus the names worth
 * surfacing. `dropped` lists filters this page no longer has, so the UI can
 * say so instead of pretending the search still means what it did.
 */
export function decodeStoredSearch(meta: unknown): { filters: SearchFilters; dropped: string[] } {
  let raw = meta;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return { filters: {}, dropped: [] }; }
  }
  if (!isPlainObject(raw)) return { filters: {}, dropped: [] };

  /* both shapes are accepted: { filters: {...} } and the bare filter object */
  const filtersRaw = isPlainObject(raw.filters) ? raw.filters : raw;
  const dropped = [...new Set([...unknownKeysOf(raw), ...unknownKeysOf(filtersRaw)])];
  return { filters: normaliseFilters(filtersRaw), dropped };
}

/** A stored row read back as a saved search, or null when it cannot be
 *  shown at all (no id, no name). Never throws. */
export function hydrateSavedSearch(row: {
  itemId: string; title?: string | null; meta?: unknown; createdAt?: string;
}): SavedSearch | null {
  if (typeof row.itemId !== "string" || !row.itemId) return null;
  const name = clipName(row.title);
  if (!name) return null;
  const { filters, dropped } = decodeStoredSearch(row.meta);
  return {
    id: row.itemId, name, filters,
    added: (row.createdAt ?? "").slice(0, 10),
    ...(dropped.length ? { dropped } : {}),
  };
}

/** A short human line per active filter, for the board's list and for
 *  screen readers: what the search actually asks for. */
export function describeFilters(filters: SearchFilters): string[] {
  const lines: string[] = [];
  if (filters.q) lines.push(`“${filters.q}”`);
  if (filters.lang?.length) lines.push(`lang: ${filters.lang.join(", ")}`);
  if (filters.org) lines.push(`org: ${filters.org}`);
  if (filters.label) lines.push(`label: ${filters.label}`);
  if (filters.repo) lines.push(`repo: ${filters.repo}`);
  if (filters.beginner) lines.push("beginner-labelled");
  if (filters.unassigned) lines.push("nobody assigned");
  if (filters.sort) lines.push(`sort: ${SORT_LABEL[filters.sort] ?? filters.sort}`);
  return lines;
}

/** True when the search asks nothing - the finder with every filter cleared.
 *  Measured against the URL the search would write, so a row that only
 *  carries the default sort counts as empty: it opens the same page. */
export const isEmptySearch = (filters: SearchFilters) => paramsFromFilters(filters).toString() === "";

/** A name is the only part of a search a person types by hand, so it is the
 *  one part that can arrive empty or absurdly long. */
export const clipName = (v: unknown): string => clip(v, NAME_MAX);

export function searchNameError(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return "a saved search needs a name";
  if (name.trim().length > NAME_MAX) return `a saved search name is ${NAME_MAX} characters at most`;
  return null;
}

/**
 * The server-side check on stored filters. Unlike normaliseFilters, which
 * quietly fixes what a URL contains, this one refuses: a saved search must
 * arrive in the shape the finder writes, or the request is a 400.
 */
export function searchFiltersError(input: unknown): string | null {
  let raw = input;
  if (isPlainObject(raw) && isPlainObject(raw.filters)) raw = raw.filters;
  if (!isPlainObject(raw)) return "search filters must be an object";

  /* strict here: a saved search is written by this page, so anything that
     is not one of its eight filters - a stray "page", a retired "status" -
     is refused rather than quietly dropped */
  const unknown = Object.keys(raw).filter((k) => !isSearchKey(k));
  if (unknown.length) return `unknown filter: ${unknown.join(", ")}`;
  if (Object.keys(raw).length > FILTER_COUNT_MAX) return `a search holds ${FILTER_COUNT_MAX} filters at most`;

  const bad = (v: unknown, max: number, label: string, lower: boolean) => {
    if (typeof v !== "string") return `${label} must be text`;
    if (v.length > max) return `${label} is ${max} characters at most`;
    const want = lower ? clipLower(v, max) : clip(v, max);
    return v === want ? null : `${label} must be normalised before it is saved`;
  };

  if (raw.q !== undefined) { const e = bad(raw.q, Q_MAX, "the search text", false); if (e) return e; }
  if (raw.org !== undefined) { const e = bad(raw.org, ORG_MAX, "the organization", true); if (e) return e; }
  if (raw.label !== undefined) { const e = bad(raw.label, LABEL_MAX, "the label", true); if (e) return e; }
  if (raw.repo !== undefined) { const e = bad(raw.repo, REPO_MAX, "the repository", true); if (e) return e; }

  if (raw.lang !== undefined) {
    if (!Array.isArray(raw.lang)) return "the language filter must be a list";
    if (raw.lang.length > LANG_COUNT_MAX) return `a search holds ${LANG_COUNT_MAX} languages at most`;
    for (const l of raw.lang) { const e = bad(l, LANG_MAX, "a language", true); if (e) return e; }
  }
  for (const k of ["beginner", "unassigned"] as const) {
    if (raw[k] !== undefined && typeof raw[k] !== "boolean") return `${k} must be true or false`;
  }
  if (raw.sort !== undefined && !(SEARCH_SORTS as readonly string[]).includes(raw.sort as string))
    return "sort is not a sort the finder offers";

  return null;
}

/**
 * A saved search needs an id that is stable across renames, so the row the
 * board holds and the row on the server stay the same row. Random, not
 * derived from the filters: the same question can legitimately be saved
 * twice under two names, and both should survive.
 */
export function newSearchId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  const rand = typeof c?.randomUUID === "function"
    ? c.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `sq-${rand}`.slice(0, 200);
}

/** The day a search was saved, in the same shape the issue ledger uses. */
export const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Read the browser's stored map back into a list. Anything the key holds
 * that is not a search - an older shape, a hand-edited entry - is dropped
 * rather than rendered, because the board cannot show a row whose name or
 * filters it does not know.
 */
export function readSearchStore(raw: unknown): SavedSearch[] {
  const entries = isPlainObject(raw) ? Object.values(raw) : Array.isArray(raw) ? raw : [];
  const out: SavedSearch[] = [];
  for (const e of entries) {
    if (!isPlainObject(e)) continue;
    const id = typeof e.id === "string" ? e.id : typeof e.itemId === "string" ? e.itemId : "";
    const name = clipName(e.name ?? e.title);
    if (!id || !name) continue;
    const source = isPlainObject(e.filters) ? e.filters : e;
    const { filters, dropped } = decodeStoredSearch(source);
    out.push({
      id, name, filters,
      added: typeof e.added === "string" ? e.added : "",
      /* only listed when something was actually skipped - an empty
         `dropped` is noise in the stored map and in the UI */
      ...(dropped.length ? { dropped } : {}),
    });
  }
  return out;
}

/** The same list as the map localStorage holds, keyed by id, with nothing
 *  derived left inside it. */
export function toSearchStore(list: SavedSearch[]): SearchStore {
  const map: SearchStore = {};
  for (const s of list) map[s.id] = { id: s.id, name: s.name, filters: s.filters, added: s.added };
  return map;
}

/**
 * The sign-in union. The account's row wins for an id this browser also
 * holds - that is where the last rename landed - and anything only one of
 * the two has is kept, so signing in never drops a search. Newest first,
 * with names breaking ties so the list is the same on every device.
 */
export function mergeSearches(server: SavedSearch[], local: SavedSearch[]): SavedSearch[] {
  const byId = new Map<string, SavedSearch>();
  for (const s of local) byId.set(s.id, s);
  for (const s of server) byId.set(s.id, s);
  return [...byId.values()].sort(
    (a, b) => b.added.localeCompare(a.added) || a.name.localeCompare(b.name),
  );
}
