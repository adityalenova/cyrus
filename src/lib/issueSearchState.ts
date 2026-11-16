/* What the Issue Finder should show for a search, kept pure so the
   zero-results rules can be tested without rendering the page.
   Only the visitor's own query and filters are described; nothing from the
   crawl is echoed back. */

export type SearchStatus = "loading" | "ready" | "error";
export type ResultsView = "skeleton" | "error" | "empty" | "results" | "refreshing";

export type ActiveSearch = {
  term: string;
  langs: string[];
  org: string;
  label: string;
  beginner: boolean;
  unassigned: boolean;
};

/* A "completed search with zero matches" is only a ready one. A request that
   is still in flight, or failed, must never read as "nothing matches". */
export function resultsView(status: SearchStatus, hasBody: boolean, rowCount: number): ResultsView {
  if (status === "error") return "error";
  if (status === "loading") return hasBody && rowCount > 0 ? "refreshing" : "skeleton";
  if (!hasBody) return "skeleton";
  return rowCount === 0 ? "empty" : "results";
}

/* Short human parts, in a stable order: the phrase, then each filter. */
export function describeSearch(s: ActiveSearch): string[] {
  const parts: string[] = [];
  const term = s.term.trim();
  if (term) parts.push(`search "${term.length > 60 ? `${term.slice(0, 60)}...` : term}"`);
  if (s.langs.length) parts.push(`language ${s.langs.join(" or ")}`);
  if (s.org) parts.push(`organization ${s.org}`);
  if (s.label) parts.push(`label ${s.label}`);
  if (s.beginner) parts.push("beginner-labelled only");
  if (s.unassigned) parts.push("nobody assigned");
  return parts;
}

/* The sentence a screen reader hears when filtering lands on zero. */
export function emptyAnnouncement(s: ActiveSearch): string {
  const parts = describeSearch(s);
  return parts.length
    ? `No issues match ${parts.join(", ")}. Clear filters to see every issue.`
    : "No issues in the index.";
}
