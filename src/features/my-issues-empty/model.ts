/* ══ my-issues-empty/model.ts — which of three states owns the page ══
   Pure. My Issues reads its rows out of this browser's ledger, so the
   three states it can be in are separable by inspection: not read yet
   (loading), a read that failed (error), read and empty (first run).
   They are deliberately not collapsed: an empty board and a board that
   never loaded look identical if the empty state is the fallback, and
   the first-run explanation would then be shown over a failed read.  ══ */

export type IssuesFeed = {
  /** the ledger has been read out of this browser */
  ready: boolean;
  /** a read that failed, as a sentence for the page; null when there was none */
  error: string | null;
  /** rows on the ledger right now */
  count: number;
};

export type IssuesEmptyState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "none" };

/* Precedence: a failure is reported whatever else is true, a read that has
   not happened is loading whatever the placeholder count says, and only a
   completed read with no rows is the first-run empty state. */
export function selectEmptyState({ ready, error, count }: IssuesFeed): IssuesEmptyState {
  if (error) return { kind: "error", message: error };
  if (!ready) return { kind: "loading" };
  return countOf(count) === 0 ? { kind: "empty" } : { kind: "none" };
}

/* a corrupt or missing count is treated as "nothing tracked", never as a
   reason to render a half-built page */
function countOf(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

/* Only the first-run state carries a way out; loading and error keep their
   own affordances, so the caller can ask without inspecting the union. */
export function isFirstRun(state: IssuesEmptyState): boolean {
  return state.kind === "empty";
}
