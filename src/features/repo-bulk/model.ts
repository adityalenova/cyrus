/* ══ repo-bulk/model.ts — selection and removal planning ══════════════
   Pure: no React, no storage, no network. The panel owns the state and
   hands ids to the store; this module decides what a selection means,
   which rows a removal would touch, and how a partial failure reads.

   One rule runs through all of it: a selection can only ever contain
   rows that are on screen right now. "Select all" is select-all-visible,
   the plan filters against the visible rows a second time, and a filter
   change prunes whatever fell out of view - so a hidden repository can
   never be removed by a select-all.                                    ══ */

export type BulkRow = { id: string; label: string };

/* The saved list is the authority on what the store will accept as an id.
   Catalog names and stored ids normally agree exactly; they are compared
   case-insensitively so a hand-edited or server-synced entry that differs
   only by case is still removed rather than silently duplicated. */
export function matchStoredId(saved: readonly string[], repoName: string): string {
  const lower = repoName.toLowerCase();
  return saved.find((id) => id.toLowerCase() === lower) ?? repoName;
}

export function isSelected(selected: readonly string[], id: string): boolean {
  return selected.includes(id);
}

/* Toggling answers a new array and never mutates the one it was given, so
   React state updates stay predictable. */
export function toggleSelected(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

export function clearSelection(): string[] {
  return [];
}

/* "Select all visible" replaces the selection with exactly the rows on
   screen - never a union with a stale hidden id. */
export function selectAllVisible(rows: readonly BulkRow[]): string[] {
  return rows.map((r) => r.id);
}

/* The selection as rows, in row order, so a review list reads like the page. */
export function visibleSelection(
  selected: readonly string[],
  rows: readonly BulkRow[],
): BulkRow[] {
  return rows.filter((r) => selected.includes(r.id));
}

export function visibleSelectionIds(
  selected: readonly string[],
  rows: readonly BulkRow[],
): string[] {
  return visibleSelection(selected, rows).map((r) => r.id);
}

export function allVisibleSelected(selected: readonly string[], rows: readonly BulkRow[]): boolean {
  return rows.length > 0 && rows.every((r) => selected.includes(r.id));
}

/* true when some, but not all, visible rows are ticked - the indeterminate
   state of the select-all checkbox */
export function someVisibleSelected(selected: readonly string[], rows: readonly BulkRow[]): boolean {
  const n = visibleSelection(selected, rows).length;
  return n > 0 && n < rows.length;
}

/* Called whenever the visible rows change under a filter. Ids that are no
   longer on screen are dropped, so the count in the toolbar always describes
   what the visitor can see. */
export function pruneToVisible(selected: readonly string[], rows: readonly BulkRow[]): string[] {
  const kept = visibleSelectionIds(selected, rows);
  return kept.length === selected.length ? [...selected] : kept;
}

export type RemovalPlan = {
  /** ids the confirm action would pass to the store, in row order */
  ids: string[];
  /** their repository names, for the review step */
  labels: string[];
  count: number;
  /** selected ids dropped because they are not visible - expected to be 0 */
  dropped: number;
  /** the empty-selection guard: the confirm action is disabled without it */
  canRemove: boolean;
};

export function planRemoval(selected: readonly string[], rows: readonly BulkRow[]): RemovalPlan {
  const visible = visibleSelection(selected, rows);
  return {
    ids: visible.map((r) => r.id),
    labels: visible.map((r) => r.label),
    count: visible.length,
    dropped: selected.length - visible.length,
    canRemove: visible.length > 0,
  };
}

export type RemovalOutcome =
  | { id: string; label: string; ok: true }
  | { id: string; label: string; ok: false; reason: string };

export const STILL_FOLLOWED = "It is still in your followed repositories.";

/* The store answers with the ids it could not drop. Anything in that list is
   reported as a failure on its own row - it is never folded into a success
   count. */
export function describeOutcomes(
  plan: RemovalPlan,
  failedIds: readonly string[],
  reason: string = STILL_FOLLOWED,
): RemovalOutcome[] {
  const failed = new Set(failedIds);
  return plan.ids.map((id, i) =>
    failed.has(id)
      ? { id, label: plan.labels[i] ?? id, ok: false, reason }
      : { id, label: plan.labels[i] ?? id, ok: true },
  );
}

/* The guard and the write in one place, with the store injected, so the
   empty-selection behaviour is testable without React: nothing is removed
   and the store is never called when the plan is empty. */
export function runRemoval(
  plan: RemovalPlan,
  remove: (ids: string[]) => string[],
  reason?: string,
): RemovalOutcome[] | null {
  if (!plan.canRemove) return null;
  return describeOutcomes(plan, remove([...plan.ids]), reason);
}

/* Retrying rebuilds a plan from the failed rows only and merges the answers
   back into the same list, so a row that failed once and then succeeded
   changes state in place. */
export function retryPlan(outcomes: readonly RemovalOutcome[]): { plan: RemovalPlan; rows: BulkRow[] } {
  const rows = outcomes.filter((o) => !o.ok).map((o) => ({ id: o.id, label: o.label }));
  return { plan: planRemoval(rows.map((r) => r.id), rows), rows };
}

export function mergeOutcomes(
  previous: readonly RemovalOutcome[],
  next: readonly RemovalOutcome[],
): RemovalOutcome[] {
  const byId = new Map(next.map((o) => [o.id, o]));
  return previous.map((o) => byId.get(o.id) ?? o);
}

export type FailedRemoval = Extract<RemovalOutcome, { ok: false }>;

export type RemovalSummary = {
  total: number;
  removed: number;
  failed: FailedRemoval[];
  tone: "ok" | "warn" | "error";
  text: string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function summariseOutcomes(outcomes: readonly RemovalOutcome[]): RemovalSummary {
  const total = outcomes.length;
  const failed = outcomes.filter((o): o is FailedRemoval => !o.ok);
  const removed = total - failed.length;
  if (total === 0) return { total: 0, removed: 0, failed: [], tone: "ok", text: "" };
  if (failed.length === 0) {
    return {
      total, removed, failed, tone: "ok",
      text: `Removed ${removed} ${plural(removed, "repository", "repositories")}.`,
    };
  }
  if (removed === 0) {
    return {
      total, removed, failed, tone: "error",
      text: `Nothing was removed. ${failed.length} ${plural(failed.length, "removal", "removals")} failed - retry ${plural(failed.length, "it", "them")} below.`,
    };
  }
  return {
    total, removed, failed, tone: "warn",
    text: `Removed ${removed} of ${total}. ${failed.length} ${plural(failed.length, "repository", "repositories")} could not be removed - retry below.`,
  };
}
