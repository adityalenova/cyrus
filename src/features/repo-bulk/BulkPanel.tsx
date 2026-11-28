"use client"
/* ══ repo-bulk/BulkPanel.tsx — bulk removal for My Repositories ═══════
   The selection lives here, not in the page: the page renders one
   checkbox per card and one toolbar above the grid, and both read the
   same controller. Everything that decides anything is in ./model.

   Accessibility is the deliverable: labelled checkboxes, a select-all
   that can be indeterminate, role="status" for the count and the
   success summary, role="alert" for anything that failed, plain button
   focus rings, and no focus stealing anywhere.                        ══ */
import { useEffect, useMemo, useRef, useState } from "react";
import { btn } from "@/components/ui";
import { Card, Ic } from "@/lib/dash/shell";
import { DP } from "@/lib/dash/shared";
import {
  allVisibleSelected, mergeOutcomes, planRemoval, pruneToVisible, runRemoval,
  selectAllVisible, someVisibleSelected, summariseOutcomes, toggleSelected,
  type BulkRow, type RemovalOutcome, type RemovalPlan, type RemovalSummary,
} from "./model";

/** the store's own answer: the ids it could not drop (empty means all gone) */
export type RemoveRepos = (ids: string[]) => string[];

export type RepoBulk = {
  rows: BulkRow[];
  selected: string[];
  plan: RemovalPlan;
  allVisible: boolean;
  someVisible: boolean;
  reviewing: boolean;
  outcomes: RemovalOutcome[] | null;
  summary: RemovalSummary | null;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clearAll: () => void;
  openReview: () => void;
  cancelReview: () => void;
  confirm: () => void;
  retry: (only?: string) => void;
  dismiss: () => void;
};

export function useRepoBulk(rows: BulkRow[], remove: RemoveRepos): RepoBulk {
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [outcomes, setOutcomes] = useState<RemovalOutcome[] | null>(null);

  /* the write path is read through a ref: a retry must call the store this
     render sees, not the one captured when the row first failed */
  const removeRef = useRef(remove);
  removeRef.current = remove;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /* A filter change can hide selected rows. They are dropped here so the
     toolbar count always describes what is on screen and a later confirm
     cannot reach a hidden repository. Keyed on the visible ids because the
     row array itself is a fresh reference on every render. */
  const visibleKey = rows.map((r) => r.id).join("\n");
  useEffect(() => {
    setSelected((cur) => pruneToVisible(cur, rowsRef.current));
  }, [visibleKey]);

  const plan = planRemoval(selected, rows);
  const summary = useMemo(() => (outcomes ? summariseOutcomes(outcomes) : null), [outcomes]);
  const allVisible = allVisibleSelected(selected, rows);
  const someVisible = someVisibleSelected(selected, rows);

  const toggle = (id: string) => setSelected((cur) => toggleSelected(cur, id));
  const toggleAll = () => {
    setReviewing(false);
    setSelected((cur) => (allVisibleSelected(cur, rowsRef.current) ? [] : selectAllVisible(rowsRef.current)));
  };
  const openReview = () => { if (plan.canRemove) setReviewing(true); };
  const cancelReview = () => setReviewing(false);

  const confirm = () => {
    const next = runRemoval(plan, removeRef.current);
    if (!next) return; /* empty-selection guard: the store is never called */
    setOutcomes(next);
    setSelected([]);
    setReviewing(false);
  };

  const retry = (only?: string) => {
    const failed = (outcomes ?? []).filter((o) => !o.ok && (!only || o.id === only));
    const retryRows = failed.map((o) => ({ id: o.id, label: o.label }));
    const next = runRemoval(planRemoval(retryRows.map((r) => r.id), retryRows), removeRef.current);
    if (!next) return;
    setOutcomes((cur) => (cur ? mergeOutcomes(cur, next) : next));
  };

  return {
    rows, selected, plan, allVisible, someVisible, reviewing, outcomes, summary,
    isSelected: (id) => selected.includes(id),
    toggle, toggleAll, clearAll: () => setSelected([]), openReview, cancelReview, confirm, retry,
    dismiss: () => setOutcomes(null),
  };
}

/* ── per-row checkbox: the only control a card gains ─────────────── */
export function RepoBulkCheckbox({ bulk, id, label }: { bulk: RepoBulk; id: string; label: string }) {
  return (
    <span className="shrink-0 mt-0.5 grid place-items-center">
      <input type="checkbox" checked={bulk.isSelected(id)} onChange={() => bulk.toggle(id)}
        aria-label={`Select ${label} for removal`}
        className="w-[17px] h-[17px] rounded-[4px] accent-accent cursor-pointer" />
    </span>
  );
}

const MICRO = "font-mono text-[10.5px] uppercase tracking-[.1em] text-dim";

/* ── toolbar + review + results, mounted above the grid ─────────── */
export function RepoBulkPanel({ bulk }: { bulk: RepoBulk }) {
  /* indeterminate is a property, not an attribute: React cannot set it */
  const allRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = bulk.someVisible;
  };

  /* nothing on screen and nothing to report: stay out of the way */
  if (!bulk.rows.length && !bulk.outcomes) return null;

  return (
    <Card className="reveal">
      {bulk.rows.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-3 flex-wrap">
          <label className="flex items-center gap-2.5 text-[13px] font-semibold text-cocoa cursor-pointer select-none">
            <input ref={allRef} type="checkbox" checked={bulk.allVisible} onChange={bulk.toggleAll}
              aria-label={`Select all ${bulk.rows.length} repositories shown`}
              className="w-[17px] h-[17px] rounded-[4px] accent-accent cursor-pointer" />
            Select all shown
            <span className={MICRO + " text-dim"}>{bulk.rows.length} visible</span>
          </label>

          <span role="status" aria-live="polite" className={MICRO + " tabular-nums"}>
            {bulk.plan.count} selected
          </span>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {bulk.plan.count > 0 && (
              <button onClick={bulk.clearAll} className={btn("ghost", "sm")}>Clear selection</button>
            )}
            <button onClick={bulk.openReview} disabled={!bulk.plan.canRemove}
              aria-expanded={bulk.reviewing}
              className={btn("primary", "sm")}>
              Review removal
            </button>
          </div>
        </div>
      )}

      {bulk.reviewing && (
        <div className="mt-4 pt-4 border-t border-dashed border-line" role="group" aria-label="Review removal">
          <p className="font-mono text-[10.5px] uppercase tracking-[.12em] text-cocoa">
            {bulk.plan.count} {bulk.plan.count === 1 ? "repository" : "repositories"} will be removed
          </p>
          <ul className="mt-3 grid gap-1.5 max-h-[220px] overflow-y-auto panel-scroll">
            {bulk.plan.labels.map((label) => (
              <li key={label} className="font-mono text-[12px] text-ink truncate">{label}</li>
            ))}
          </ul>
          <p className="card-desc mt-3">
            They leave the list you follow in this browser. The repositories themselves are not touched.
          </p>
          {bulk.plan.dropped > 0 && (
            <p className="text-honey text-[12px] mt-2">
              {bulk.plan.dropped} selected {bulk.plan.dropped === 1 ? "entry is" : "entries are"} no longer on
              screen, so {bulk.plan.dropped === 1 ? "it is" : "they are"} left alone.
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <button onClick={bulk.confirm} disabled={!bulk.plan.canRemove} className={btn("primary", "sm")}>
              Remove {bulk.plan.count} {bulk.plan.count === 1 ? "repository" : "repositories"}
            </button>
            <button onClick={bulk.cancelReview} className={btn("outline", "sm")}>Keep them</button>
          </div>
        </div>
      )}

      {bulk.outcomes && bulk.summary && (
        <div className="mt-4 pt-4 border-t border-dashed border-line">
          <p role="status" aria-live="polite"
            className={"text-[13px] font-semibold " + (bulk.summary.tone === "ok" ? "text-leaf" : bulk.summary.tone === "warn" ? "text-honey" : "text-brick")}>
            {bulk.summary.text}
          </p>

          <ul className="mt-3 grid gap-1.5">
            {bulk.outcomes.map((o) => (
              <li key={o.id} className="flex items-center gap-2.5 min-w-0">
                <span className={"shrink-0 " + (o.ok ? "text-leaf" : "text-brick")} aria-hidden>
                  <Ic d={o.ok ? DP.check : DP.x} size={12} />
                </span>
                <span className="font-mono text-[11.5px] text-cocoa truncate min-w-0">{o.label}</span>
                <span className={"ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[.08em] " + (o.ok ? "text-leaf" : "text-brick")}>
                  {o.ok ? "removed" : "not removed"}
                </span>
              </li>
            ))}
          </ul>

          {bulk.summary.failed.length > 0 && (
            <div role="alert" className="mt-3 rounded-[12px] border border-brick/35 bg-brick/8 px-3.5 py-3">
              <p className="text-[12.5px] leading-[1.55] text-brick">
                {bulk.summary.failed.length} {bulk.summary.failed.length === 1 ? "removal did" : "removals did"} not
                land. Each row is still followed, so it can be tried again:
              </p>
              <ul className="mt-2 grid gap-1.5">
                {bulk.summary.failed.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-mono text-[11.5px] text-cocoa truncate min-w-0">{f.label}</span>
                    <span className="text-[12px] text-cocoa min-w-0">{f.reason}</span>
                    <button onClick={() => bulk.retry(f.id)}
                      className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[.08em] px-2.5 py-1 rounded-[8px] border border-brick/40 text-brick hover:bg-brick/10 transition-colors cursor-pointer">
                      Retry
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={bulk.dismiss}
            className="mt-3 font-mono text-[10px] uppercase tracking-[.1em] text-dim hover:text-ink transition-colors cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
    </Card>
  );
}
