"use client";
/* ══ ProgramWindowsPanel.tsx — eligibility and application windows ══════
   The comparison matrix added to /programs/compare. It is fed by the URL
   selection the page owns (`?p=`), and it prints only what each program's
   published record states: the eligibility sentence as written, the
   application window as written, and "Not published" everywhere else.

   Two layouts, one dataset: a real <table> on wide screens and a stacked
   list of cards below 760px. The picker uses a roving tabindex so arrow
   keys, Home and End move between programs without tabbing through all of
   them; remove buttons and program links are ordinary focusable controls. ══ */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Card } from "@/lib/dash/shell";
import { btn } from "@/components/ui";
import { Link } from "@/lib/router";
import {
  CELL_UNPUBLISHED as NOT_PUBLISHED_ROW_LABEL,
  MAX_SELECTION,
  comparableIds,
  compareRows,
  canAdd,
  type Cell,
  type ProgramRow,
  type WindowCell,
} from "./model";

export type ProgramOption = { id: string; name: string };

const ROWS: { key: keyof ProgramRow; label: string }[] = [
  { key: "eligibility", label: "Eligibility (published)" },
  { key: "window", label: "Application window" },
  { key: "duration", label: "Duration" },
  { key: "tier", label: "Tier" },
  { key: "difficulty", label: "Mentoring shape" },
];

function cellFor(row: ProgramRow, key: keyof ProgramRow): Cell | WindowCell {
  return row[key] as Cell | WindowCell;
}

function CellBody({ cell }: { cell: Cell | WindowCell }) {
  if (!cell.published) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[.09em] text-dim border border-line rounded-md px-2 py-[3px] bg-cream">
        {cell.text}
      </span>
    );
  }
  return (
    <span className="block">
      <span className="text-[12.5px] leading-[1.55] text-ink">{cell.text}</span>
      {cell.source && <span className="block text-[10.5px] leading-[1.5] text-dim mt-1">Source: {cell.source}</span>}
    </span>
  );
}

/** the stage-only case: the program names a step but publishes no dates */
function WindowBody({ cell }: { cell: WindowCell }) {
  if (!cell.label) return <CellBody cell={cell} />;
  return (
    <span className="block">
      <span className="text-[12.5px] leading-[1.55] text-ink">{cell.label}</span>
      <span className="block mt-1">
        {cell.period ? (
          <span className="text-[12px] text-cocoa">{cell.period}</span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[.09em] text-dim border border-line rounded-md px-2 py-[3px] bg-cream">
            dates {NOT_PUBLISHED_ROW_LABEL.toLowerCase()}
          </span>
        )}
      </span>
      {cell.note && <span className="block text-[10.5px] leading-[1.5] text-dim mt-1">{cell.note}</span>}
      {cell.source && <span className="block text-[10.5px] leading-[1.5] text-dim mt-1">Source: {cell.source}</span>}
    </span>
  );
}

function Body({ row, field }: { row: ProgramRow; field: keyof ProgramRow }) {
  const cell = cellFor(row, field);
  return field === "window" ? <WindowBody cell={cell as WindowCell} /> : <CellBody cell={cell} />;
}

export default function ProgramWindowsPanel({
  selection,
  onToggle,
  onReset,
  programs,
}: {
  selection: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  programs: ProgramOption[];
}) {
  const names = useMemo(
    () => Object.fromEntries(programs.map((p) => [p.id, p.name])) as Record<string, string>,
    [programs],
  );
  const ids = useMemo(() => comparableIds(programs.map((p) => p.id)), [programs]);
  const rows = useMemo(() => compareRows(selection, names), [selection, names]);
  const picker = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusAt, setFocusAt] = useState(0);
  const atLimit = selection.length >= MAX_SELECTION;

  /* roving tabindex: one chip is in the tab order, the arrows move between
     the rest - the pattern the WAI-ARIA toolbar guidance describes */
  const move = (to: number) => {
    const next = (to + ids.length) % ids.length;
    setFocusAt(next);
    picker.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); move(index + 1); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); move(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); move(0); }
    else if (event.key === "End") { event.preventDefault(); move(ids.length - 1); }
  };

  return (
    <section className="pb-14" aria-labelledby="windows-heading">
      <p className="eyebrow">Eligibility and windows</p>
      <h2 id="windows-heading" className="panel-h-lg mt-2">
        What each program publishes, side by side
      </h2>
      <p className="card-desc mt-2 max-w-[760px]">
        Eligibility and application windows are quoted from each program's own published record on
        this site. A field that record does not state reads{" "}
        <b className="text-ink font-semibold">{NOT_PUBLISHED_ROW_LABEL}</b> - nothing here is inferred
        from a season, a stipend or a neighbouring programme.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Add or remove programs from the comparison">
        <span className="font-mono text-[10px] uppercase tracking-[.11em] text-dim mr-1">Programs</span>
        {ids.map((id, i) => {
          const active = selection.includes(id);
          const disabled = !active && !canAdd(selection, id);
          return (
            <button
              key={id}
              ref={(el) => { picker.current[i] = el; }}
              type="button"
              aria-pressed={active}
              aria-label={`${active ? "Remove" : "Add"} ${names[id] ?? id} ${active ? "from" : "to"} the comparison`}
              disabled={disabled}
              tabIndex={i === Math.min(focusAt, ids.length - 1) ? 0 : -1}
              onFocus={() => setFocusAt(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={() => onToggle(id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed ${
                active
                  ? "bg-accent text-[#0f1012] border-accent"
                  : "bg-card text-cocoa border-line hover:border-accent/60 hover:text-ink"
              }`}
            >
              {names[id] ?? id} {active ? "−" : "+"}
            </button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="mt-2 font-mono text-[10.5px] uppercase tracking-[.09em] text-dim">
        {atLimit
          ? `Comparison limit reached - ${selection.length} of ${MAX_SELECTION} selected. Remove one to add another.`
          : `${selection.length} of ${MAX_SELECTION} selected`}
      </p>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <p className="panel-h text-[16px]">No programs selected</p>
          <p className="card-desc mt-1.5 max-w-[560px]">
            Pick a program above, or restore the three this page opened with.
          </p>
          <button type="button" className={btn("outline", "sm", "mt-4")} onClick={onReset}>
            Restore the default comparison
          </button>
        </Card>
      ) : (
        <>
          {/* ── wide screens: one row per fact, one column per program ── */}
          <div className="mt-6 hidden md:block overflow-x-auto rounded-[18px] border border-line bg-card shadow-soft">
            <table className="w-full border-collapse min-w-[680px]">
              <caption className="sr-only">
                Published eligibility and application windows for {rows.length} programs. Use the
                remove buttons in the header to change the comparison.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="text-left p-4 font-mono text-[9.5px] uppercase tracking-[.12em] text-dim font-medium align-bottom w-[150px]">
                    Fact
                  </th>
                  {rows.map((row) => (
                    <th key={row.id} scope="col" className="text-left p-4 align-bottom border-l border-liness">
                      <Link to={`/programs/${row.id}`} className="font-display font-bold text-[14px] text-ink hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {row.name}
                      </Link>
                      <span className="block mt-2">
                        <button type="button" onClick={() => onToggle(row.id)} className={btn("ghost", "sm", "!px-2 !py-1 text-[11.5px]")}>
                          Remove
                          <span className="sr-only"> {row.name} from the comparison</span>
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key} className="border-t border-liness align-top">
                    <th scope="row" className="text-left p-4 font-mono text-[9.5px] uppercase tracking-[.11em] text-dim font-medium">
                      {r.label}
                    </th>
                    {rows.map((row) => (
                      <td key={`${row.id}-${r.key}`} className="p-4 border-l border-liness">
                        <Body row={row} field={r.key} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── narrow screens: the same rows as stacked cards ── */}
          <div className="mt-6 grid gap-4 md:hidden">
            {rows.map((row, i) => (
              <Card key={row.id} className="reveal" style={{ animationDelay: `${Math.min(i, 4) * 60}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/programs/${row.id}`} className="font-display font-bold text-[16px] text-ink hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {row.name}
                  </Link>
                  <button type="button" onClick={() => onToggle(row.id)} className={btn("ghost", "sm", "!px-2 !py-1 text-[11.5px] shrink-0")}>
                    Remove
                    <span className="sr-only"> {row.name} from the comparison</span>
                  </button>
                </div>
                <dl className="grid gap-3 mt-4">
                  {ROWS.map((r) => (
                    <div key={r.key} className="grid gap-1 pb-3 border-b border-dashed border-liness last:border-0 last:pb-0">
                      <dt className="font-mono text-[9.5px] uppercase tracking-[.11em] text-dim">{r.label}</dt>
                      <dd className="m-0"><Body row={row} field={r.key} /></dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[.1em] text-dim mt-4 leading-[1.9]">
        Sources are the program records on this site, written from each organizer's published page.
        Where a record states no rule or no date, this table says so instead of filling the gap.
      </p>
    </section>
  );
}
