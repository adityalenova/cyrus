/* ══ compare.ts — the selection and attribute maths behind /compare ═══
   A comparison has to survive being pasted into a chat, so its whole state
   lives in the URL and nothing lives in localStorage: the page is a pure
   function of `?c=`. Each project is one repeated `c` parameter holding its
   own source URL, because that is the only identifier an archive row carries
   that stays put when the archive is rebuilt - the row's generated `key`
   includes its index in the shard, so a key would point at a different
   project after the next refresh.

   What the table prints is also deliberately limited to what a source
   actually publishes per project. Difficulty is absent on purpose: no archive
   states a difficulty per row, and /projects prints a scope badge only where
   GSoC publishes small/medium/large. Inventing a per-project score to fill a
   column would be the same fabrication the program cards were stripped of.
   ═══════════════════════════════════════════════════════════════════════ */

/** how many projects fit beside each other before the table stops being readable */
export const MAX_COMPARE = 3;

/** the query parameter a selection is carried in, repeated once per project */
export const COMPARE_PARAM = "c";

/** the minimum shape a comparison row needs - ArchiveRow satisfies it */
export type CompareRow = {
  url: string;
  title: string;
  org: string;
  program: string;
  year: number;
  season: string;
  lang: string;
  tags: string[];
  mentor: string;
  stars: number;
};

export type AttributeId = "program" | "timeline" | "org" | "lang" | "stack" | "mentors" | "stars";

export type Attribute = { id: AttributeId; label: string };

/** the rows of the table, in the order they read best on the page */
export const ATTRIBUTES: Attribute[] = [
  { id: "program", label: "Program" },
  { id: "timeline", label: "Timeline" },
  { id: "org", label: "Organization" },
  { id: "lang", label: "Primary language" },
  { id: "stack", label: "Tech stack" },
  { id: "mentors", label: "Mentors" },
  { id: "stars", label: "Stars" },
];

/** one attribute for one project, as the archive states it - "" when it does not */
export function cellOf(id: AttributeId, row: CompareRow): string {
  switch (id) {
    case "program": return row.program || "";
    /* the round the source names, falling back to the bare year it dates the row to */
    case "timeline": return row.season || (row.year ? String(row.year) : "");
    case "org": return row.org || "";
    case "lang": return row.lang || "";
    case "stack": return (row.tags ?? []).join(", ");
    case "mentors": return row.mentor || "";
    case "stars": return row.stars > 0 ? String(row.stars) : "";
  }
}

export type Match = "same" | "differs" | "unknown";

export type AttributeMatrixRow = {
  id: AttributeId;
  label: string;
  /** one cell per selected project, in selection order */
  cells: string[];
  /** how the row reads: identical, split, or published by nobody */
  kind: Match;
};

/**
 * Compare one attribute across the selection.
 *
 * "unknown" is only used when no source states the attribute at all, so the
 * page can say "not published" instead of drawing an empty column. A project
 * that omits a value the others state is a real difference in what is known
 * about them, so it lands in "differs" rather than being smoothed away.
 */
export function compareAttribute(attr: Attribute, rows: CompareRow[]): AttributeMatrixRow {
  const cells = rows.map((r) => cellOf(attr.id, r));
  const known = cells.filter((c) => c !== "");
  let kind: Match = "unknown";
  if (known.length > 0) {
    /* a column where one source is silent and another speaks is split information,
       which is a difference the reader should see highlighted, not a clean "same" */
    const partial = known.length !== cells.length;
    kind = !partial && known.every((c) => c === known[0]) ? "same" : "differs";
  }
  return { id: attr.id, label: attr.label, cells, kind };
}

/** the whole table */
export function buildMatrix(rows: CompareRow[], attrs: Attribute[] = ATTRIBUTES): AttributeMatrixRow[] {
  return attrs.map((a) => compareAttribute(a, rows));
}

/** attributes that are identical across every selected project */
export function sharedAttributes(matrix: AttributeMatrixRow[]): AttributeMatrixRow[] {
  return matrix.filter((r) => r.kind === "same");
}

/** attributes that split the selection */
export function differingAttributes(matrix: AttributeMatrixRow[]): AttributeMatrixRow[] {
  return matrix.filter((r) => r.kind === "differs");
}

/**
 * Read the selection out of a search string (`"?c=a&c=b"`, `"?c=a"`, `"c=a"`
 * or the bare value of a URLSearchParams). Blank repeats are dropped, a URL
 * listed twice is kept once in first-seen order, and anything past
 * MAX_COMPARE is ignored rather than silently reordering the page.
 */
export function selectionFromSearch(search: string): string[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of params.getAll(COMPARE_PARAM)) {
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_COMPARE) break;
  }
  return out;
}

/** the query string for a selection, without a leading "?" */
export function selectionToQuery(urls: string[]): string {
  const params = new URLSearchParams();
  for (const url of urls.slice(0, MAX_COMPARE)) params.append(COMPARE_PARAM, url);
  return params.toString();
}

/** a link that reopens this exact comparison */
export function compareHref(urls: string[]): string {
  const qs = selectionToQuery(urls);
  return qs ? `/compare?${qs}` : "/compare";
}

/**
 * Add a project, or take it back out. At the limit a new pick drops the
 * oldest, which is what a user who keeps clicking expects; the return value
 * never exceeds MAX_COMPARE, so callers cannot create a fourth column.
 */
export function toggleUrl(urls: string[], url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return urls.slice(0, MAX_COMPARE);
  if (urls.includes(trimmed)) return urls.filter((u) => u !== trimmed);
  return [...urls, trimmed].slice(-MAX_COMPARE);
}

/** true once the selection is at the cap and a new pick would drop one */
export function isFull(urls: string[]): boolean {
  return urls.length >= MAX_COMPARE;
}

export type Resolved = {
  /** the projects found in the archive, in selection order */
  rows: CompareRow[];
  /** selected URLs the loaded archive has no row for - a pasted link can age out */
  missing: string[];
};

/**
 * Map a selection onto loaded rows. A stale or hand-edited link resolves to
 * `missing` instead of a blank column, so the page can name the gap rather
 * than render a comparison of nothing.
 */
export function resolveSelection(rows: CompareRow[], urls: string[]): Resolved {
  const byUrl = new Map<string, CompareRow>();
  for (const r of rows) {
    if (r.url && !byUrl.has(r.url)) byUrl.set(r.url, r);
  }
  const out: CompareRow[] = [];
  const missing: string[] = [];
  for (const url of urls) {
    const hit = byUrl.get(url);
    if (hit) out.push(hit);
    else missing.push(url);
  }
  return { rows: out, missing };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Candidates for the picker: rows matching a term, skipping anything already
 * selected and anything with no URL to compare on. Ranked so an org or title
 * that starts with the term beats an incidental hit in the description.
 */
export function searchCandidates(rows: CompareRow[], term: string, selected: string[] = [], limit = 12): CompareRow[] {
  const q = norm(term);
  const taken = new Set(selected);
  const pool = rows.filter((r) => r.url && !taken.has(r.url));
  if (!q) return pool.slice(0, limit);
  const scored = pool
    .map((r) => {
      const title = norm(r.title);
      const org = norm(r.org);
      const stack = norm((r.tags ?? []).join(" "));
      let score = 0;
      if (title.startsWith(q)) score = 4;
      else if (title.includes(q)) score = 3;
      else if (org.startsWith(q) || org.includes(q)) score = 2;
      else if (stack.includes(q)) score = 1;
      return { r, score };
    })
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.r);
}
