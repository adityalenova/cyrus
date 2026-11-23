/* ══ issue-finder-live/model.ts — what the finder says out loud ══════
   Pure. The finder already paints its result count; this decides what
   a screen reader is told about it, in one sentence, once a filter has
   settled. Three rules:

   1. A phase that has nothing new to say returns null, so the live
      region is never re-filled with the same sentence.
   2. An unchanged count returns null. Typing a letter that changes
      nothing must not speak.
   3. Loading, failure, zero results and "N issues" are four different
      sentences, because "no results" and "not loaded" are not the same
      thing to someone who cannot see the grid.                  ══ */

export type FinderPhase = "loading" | "ready" | "error";

export type ResultStatusInput = {
  phase: FinderPhase;
  /** result total for the current query; null when it is not known */
  count: number | null;
  /** the last count that was actually announced; null before the first one */
  previousCount: number | null;
  /** short human label for the filters in play, without quotes */
  query?: string | null;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* a count nobody can trust is treated as unknown, not as zero */
function normalCount(count: number | null): number | null {
  if (count === null || !Number.isFinite(count)) return null;
  return Math.max(0, Math.trunc(count));
}

export const LOADING_TEXT = "Reading the issue index.";
export const ERROR_TEXT = "The issue index did not answer, so these results are out of date.";

export function describeResultStatus({
  phase,
  count,
  previousCount,
  query,
}: ResultStatusInput): string | null {
  /* a failure is never the empty state: it keeps its own sentence and its
     own retry on screen */
  if (phase === "error") return ERROR_TEXT;

  /* the first read is worth announcing; a re-read of an already populated
     grid is not, because the previous count is still on screen */
  if (phase === "loading") return previousCount === null ? LOADING_TEXT : null;

  const n = normalCount(count);
  if (n === null) return null;

  /* the count has not moved: say nothing rather than repeat it */
  if (previousCount !== null && normalCount(previousCount) === n) return null;

  const forQuery = queryPhrase(query);
  if (n === 0) return `No issues match${forQuery}.`;
  return `${n} ${plural(n, "issue matches", "issues match")}${forQuery}.`;
}

/* " for “memory leak, rust”", or nothing when no filter is spoken about */
export function queryPhrase(query?: string | null): string {
  const q = (query ?? "").trim();
  return q ? ` for “${q}”` : "";
}

export type FinderFilters = {
  term?: string | null;
  org?: string | null;
  label?: string | null;
  beginner?: boolean;
  unassigned?: boolean;
};

const MAX_TERM = 60;

/* The URL's filters as one clause. Order is the panel's order, the search
   words come first because they are what the visitor typed. */
export function queryLabel(filters: FinderFilters): string {
  const term = (filters.term ?? "").trim();
  const clipped = term.length > MAX_TERM ? term.slice(0, MAX_TERM - 1).trimEnd() + "…" : term;
  return [
    clipped,
    (filters.org ?? "").trim(),
    (filters.label ?? "").trim(),
    filters.beginner ? "beginner-labelled" : "",
    filters.unassigned ? "nobody assigned" : "",
  ].filter(Boolean).join(", ");
}
