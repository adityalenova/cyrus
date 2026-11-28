"use client"
/* ══ ProgramCalendar.tsx — month, week and day over the catalog's windows ══
   The dashboard already draws the season board; this is the standalone page
   a visitor can keep open while planning. Three rules drive it:

   1. only stated dates appear. Phase windows come from src/data/orgs.ts and
      are labelled as the rounded month windows they are; nothing else is
      preloaded, and a visitor's own dates are named as theirs;
   2. the URL is the whole view state - view, anchor day, week start and the
      three filters - so a filtered calendar can be pasted to a friend;
   3. the table is the desktop reading and the stacked list is the mobile one
      of the same filtered set. Nothing is rendered twice from two sources.
   ═══════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { Card } from "../../lib/dash/shell";
import { btn, Chip } from "../../components/ui";
import { useStored } from "../../lib/util";
import { PROGRAMS } from "../../data/orgs";
import {
  AWARD_META,
  CUSTOM_STORAGE_KEY,
  CYCLE_YEARS,
  DATA_AS_OF,
  DAY_NAMES,
  LEVEL_LABEL,
  PROGRAM_SOURCE,
  PROGRAM_SOURCE_NOTE,
  STATUS_LABEL,
  VIEWS,
  WEEK_START_OPTIONS,
  addDays,
  catalogEvents,
  eventDays,
  eventsInRange,
  eventsOnDay,
  filterEvents,
  icsFileName,
  makeCustomEvent,
  monthCells,
  monthOf,
  parseCustomEvents,
  parseIso,
  parseQuery,
  queryOf,
  shiftDay,
  shiftMonth,
  todayIso,
  toIcs,
  weekCells,
  type AwardType,
  type CalendarEvent,
  type CalendarQuery,
  type CalendarView,
  type GridCell,
  type WeekStart,
} from "./model";
import type { Level, Program } from "../../lib/types";

const W = "max-w-[1240px] mx-auto px-6";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions): string => {
  const t = parseIso(iso);
  if (t === null) return iso;
  return new Date(t).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
};

const monthTitle = (iso: string) => fmt(iso, { month: "long", year: "numeric" });
const dayTitle = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDay = (iso: string) => fmt(iso, { day: "numeric", month: "short" });
const fullDay = (iso: string) => fmt(iso, { day: "numeric", month: "short", year: "numeric" });

/** the inclusive end date a reader expects: the .ics end is exclusive */
function spanText(e: CalendarEvent): string {
  const last = addDays(e.end, -1);
  if (last === e.start) return fullDay(e.start);
  return `${shortDay(e.start)} - ${fullDay(last)}`;
}

const TYPE_ORDER: AwardType[] = ["stipend", "prize", "grant", "unpaid", "learning"];

/* ── one event, as a button that opens the details panel ───────────── */
function EventButton({ e, onOpen, full = false }: { e: CalendarEvent; onOpen: (e: CalendarEvent, trigger: HTMLElement) => void; full?: boolean }) {
  const meta = AWARD_META[e.type];
  return (
    <button
      type="button"
      onClick={(ev) => onOpen(e, ev.currentTarget)}
      className={`group flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left font-mono text-[10px] leading-[1.25] transition-colors hover:brightness-110 ${meta.cls} ${FOCUS}`}
      aria-label={`${e.title}, ${spanText(e)} - open details`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.dot }} aria-hidden />
      <span className="truncate">{full ? e.title : e.phase}</span>
    </button>
  );
}

/* ── the details popover ───────────────────────────────────────────── */
function EventDetails({ e, onClose, onRemove }: { e: CalendarEvent; onClose: () => void; onRemove?: () => void }) {
  const meta = AWARD_META[e.type];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="calendar-popover-title"
      className="reveal fixed right-4 top-20 z-[90] w-[min(370px,calc(100vw-2rem))] rounded-[18px] border border-line bg-card p-5 shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">Event details</p>
        <button ref={closeRef} type="button" onClick={onClose} className={`-mr-1 -mt-1 rounded-md px-2 py-1 text-[16px] leading-none text-dim hover:text-ink ${FOCUS}`} aria-label="Close event details">
          ×
        </button>
      </div>
      <h3 id="calendar-popover-title" className="mt-2.5 font-display text-[17px] font-bold leading-[1.25] text-ink">{e.title}</h3>
      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[.09em] text-dim">{e.custom ? "Your date" : e.program}</p>
      <dl className="mt-4 space-y-2 text-[13px]">
        <div className="flex justify-between gap-4"><dt className="text-dim">Dates</dt><dd className="text-right font-medium text-ink">{spanText(e)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-dim">Days</dt><dd className="text-right text-cocoa">{eventDays(e)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-dim">Status</dt><dd className="text-right text-cocoa">{STATUS_LABEL[e.status]}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-dim">Difficulty</dt><dd className="text-right text-cocoa">{e.level ? LEVEL_LABEL[e.level] : "Not published"}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-dim">Award type</dt><dd className="text-right"><span className={`rounded-md border px-2 py-[2px] font-mono text-[10px] ${meta.cls}`}>{meta.label}</span></dd></div>
      </dl>
      <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] leading-[1.6] text-dim">
        Source: {e.source.label}
        <br />
        As of {DATA_AS_OF}
      </p>
      {e.note && <p className="mt-2 text-[12px] leading-[1.5] text-cocoa">{e.note}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!e.custom && e.source.url && (
          <a href={e.source.url} target="_blank" rel="noreferrer noopener" className={btn("outline", "sm")}>Program page</a>
        )}
        {!e.custom && e.programId !== "custom" && (
          <Link to={`/programs/${e.programId}`} className={btn("ghost", "sm")}>Calendar page</Link>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className={`${btn("ghost", "sm")} text-brick`}>Remove this date</button>
        )}
      </div>
    </div>
  );
}

export default function ProgramCalendar() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseQuery(params.toString()), [params]);
  const [stored, setStored, storedReady] = useStored<unknown[]>(CUSTOM_STORAGE_KEY, []);
  const [form, setForm] = useState({ title: "", start: "", end: "", note: "" });
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [popover, setPopover] = useState<{ event: CalendarEvent; trigger: HTMLElement } | null>(null);

  const custom = useMemo(() => parseCustomEvents(stored), [stored]);
  const all = useMemo(() => [...catalogEvents(), ...custom], [custom]);
  const shown = useMemo(() => filterEvents(all, query.filter), [all, query.filter]);

  const anchor = query.date;
  const { year, month } = monthOf(anchor);
  const cells = useMemo(
    () => (query.view === "week" ? weekCells(anchor, query.weekStartsOn) : monthCells(year, month, query.weekStartsOn)),
    [query.view, anchor, year, month, query.weekStartsOn],
  );
  const firstCell = cells[0]?.iso ?? anchor;
  const lastCell = cells[cells.length - 1]?.iso ?? anchor;
  const rangeEnd = addDays(lastCell, 1);
  const visible = useMemo(() => eventsInRange(shown, firstCell, rangeEnd), [shown, firstCell, rangeEnd]);
  const onAnchor = useMemo(() => eventsOnDay(shown, anchor), [shown, anchor]);

  /** today is only ever read on the client; the anchor always comes from the URL */
  const [today, setToday] = useState("");
  useEffect(() => { setToday(todayIso()); }, []);

  /* the popover closes on Escape and on a click outside itself */
  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[role='dialog']") || t?.closest("[data-event-trigger]")) return;
      setPopover(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [popover]);

  function close() {
    const t = popover?.trigger;
    setPopover(null);
    if (t) t.focus();
  }

  const write = (patch: Partial<CalendarQuery>) => {
    const next: CalendarQuery = { ...query, ...patch };
    setParams(new URLSearchParams(queryOf(next)));
  };

  const setView = (view: CalendarView) => write({ view });
  const setDate = (date: string) => write({ date });
  const step = (dir: number) => {
    if (query.view === "month") write({ date: shiftMonth(anchor, dir) });
    else if (query.view === "week") write({ date: shiftDay(anchor, 7 * dir) });
    else write({ date: shiftDay(anchor, dir) });
  };

  const filterBy = (patch: Partial<CalendarQuery["filter"]>) => write({ filter: { ...query.filter, ...patch } });

  const add = (e: FormEvent) => {
    e.preventDefault();
    const result = makeCustomEvent(form);
    if (!result.ok) { setMsg({ kind: "err", text: result.error }); return; }
    setStored([...custom, result.event]);
    setForm({ title: "", start: "", end: "", note: "" });
    setMsg({ kind: "ok", text: `Added “${result.event.title}” on ${fullDay(result.event.start)}. Kept in this browser.` });
    write({ date: result.event.start });
  };

  const removeCustom = (id: string) => {
    setStored(custom.filter((e) => e.id !== id));
    setPopover(null);
    setMsg({ kind: "ok", text: "Removed that date from this browser." });
  };

  const download = () => {
    const text = toIcs(shown, { name: `cyrus.ai program calendar (as of ${DATA_AS_OF})` });
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(anchor);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const resetFilters = () => write({ filter: { programs: [], statuses: [], levels: [] } });
  const filtered = query.filter.programs.length + query.filter.statuses.length + query.filter.levels.length > 0;

  /* the month grid reads best as weeks; a week view is one such row */
  const rows: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className={`${W} pt-14 pb-20`}>
      <p className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span>{" "}
        <Link to="/programs" className="hover:text-accent">Programs</Link> <span className="text-accent">›</span>{" "}
        <span className="text-cocoa">Calendar</span>
      </p>
      <h1 className="mt-3.5 mb-3 font-display text-[clamp(33px,4.2vw,52px)] font-extrabold leading-[1.08] tracking-[-.02em]">
        The program calendar
      </h1>
      <p className="max-w-[760px] text-[16.5px] font-medium leading-[1.6] text-ink">
        Every dated window the catalog states, in a month, week or day view - plus dates you add yourself.
        Program windows are the organizers&apos; published calendars rounded to the nearest few days, never a
        reminder invented by this page.
      </p>

      <Card className="mt-6 reveal" style={{ animationDelay: "40ms" }}>
        <p className="eyebrow mb-2">Provenance</p>
        <p className="card-desc">
          <strong className="font-semibold text-ink">{PROGRAM_SOURCE}</strong>, as of {DATA_AS_OF}. {PROGRAM_SOURCE_NOTE}{" "}
          A {CYCLE_YEARS[1]} entry repeats the same month window because no organizer has published{" "}
          {CYCLE_YEARS[1]} dates yet - it is marked &ldquo;projected&rdquo; everywhere it appears.
        </p>
        <p className="card-desc mt-2">
          Dates you add are kept only in this browser, under <code className="font-mono text-[12px]">cyrus.calendar.events.v1</code>.
          Nothing here contacts GitHub or an organizer.
        </p>
      </Card>

      {/* view + navigation */}
      <section className="mt-8" aria-label="Calendar view">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="panel-h-lg mr-2" aria-live="polite">
              {query.view === "day" ? dayTitle(anchor) : query.view === "week" ? `${shortDay(firstCell)} - ${fullDay(lastCell)}` : monthTitle(anchor)}
            </h2>
            <button type="button" onClick={() => step(-1)} className={`${btn("outline", "sm")} !px-2.5`} aria-label={`Previous ${query.view}`}>‹</button>
            <button type="button" onClick={() => write({ date: today || anchor })} className={btn("outline", "sm")}>Today</button>
            <button type="button" onClick={() => step(1)} className={`${btn("outline", "sm")} !px-2.5`} aria-label={`Next ${query.view}`}>›</button>
          </div>
          <div role="group" aria-label="Calendar view" className="flex rounded-full border border-line bg-card p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={query.view === v.id}
                onClick={() => setView(v.id)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${FOCUS} ${query.view === v.id ? "bg-ink text-paper" : "text-cocoa hover:text-ink"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* filters */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="cal-program" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Program</label>
            <select id="cal-program" value={query.filter.programs[0] ?? ""} onChange={(e) => filterBy({ programs: e.target.value ? [e.target.value] : [] })}
              className={`w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink ${FOCUS}`}>
              <option value="">All programs</option>
              {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cal-status" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Status</label>
            <select id="cal-status" value={query.filter.statuses[0] ?? ""} onChange={(e) => filterBy({ statuses: e.target.value ? [e.target.value as Program["status"]] : [] })}
              className={`w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink ${FOCUS}`}>
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABEL) as Program["status"][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cal-level" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Difficulty</label>
            <select id="cal-level" value={query.filter.levels[0] ?? ""} onChange={(e) => filterBy({ levels: e.target.value ? [e.target.value as Level] : [] })}
              className={`w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink ${FOCUS}`}>
              <option value="">Any level</option>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cal-week-start" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Week starts</label>
            <select id="cal-week-start" value={query.weekStartsOn} onChange={(e) => write({ weekStartsOn: Number(e.target.value) as WeekStart })}
              className={`w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink ${FOCUS}`}>
              {WEEK_START_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">{visible.length} in view · {shown.length} in the filtered set</span>
          {filtered && (
            <button type="button" onClick={resetFilters} className={`${btn("ghost", "sm")} !px-2.5 !py-1 text-[12px]`}>Reset filters</button>
          )}
        </div>

        {/* legend */}
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-label="Colour code by award type">
          {TYPE_ORDER.map((t) => (
            <li key={t} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.08em] text-dim">
              <span className="h-2 w-2 rounded-full" style={{ background: AWARD_META[t].dot }} aria-hidden />
              {AWARD_META[t].label}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 font-mono text-[10px] leading-[1.6] text-dim">
          Colour is the published payNote folded into a bucket: {TYPE_ORDER.map((t) => `${AWARD_META[t].label.toLowerCase()} = ${AWARD_META[t].hint}`).join("; ")}.
        </p>
      </section>

      {/* the grid: table on desktop, stacked list on mobile */}
      <section className="mt-6" aria-label={`${query.view} view`}>
        {shown.length === 0 && (
          <p className="rounded-[18px] border border-dashed border-line px-6 py-8 text-[14px] text-cocoa" role="status">
            No dated window matches those filters. Widen one, or add your own date below.
          </p>
        )}

        {shown.length > 0 && query.view !== "day" && (
          <div className="hidden overflow-x-auto rounded-[18px] border border-line bg-card md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                {query.view === "week" ? "The week starting " + dayTitle(firstCell) : monthTitle(anchor)} - {visible.length} events in view
              </caption>
              <thead>
                <tr>
                  {DAY_NAMES.map((d, i) => (
                    <th key={d} scope="col" className="border-b border-line px-3 py-2.5 font-mono text-[10px] uppercase tracking-[.12em] text-dim">
                      {DAY_NAMES[(i + query.weekStartsOn) % 7]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={row[0]?.iso ?? ri}>
                    {row.map((cell) => {
                      const dayEvents = eventsOnDay(visible, cell.iso);
                      const isAnchor = cell.iso === anchor;
                      return (
                        <td key={cell.iso} className={`h-[104px] w-[14.28%] border-b border-r border-line/70 p-1.5 align-top ${cell.inMonth ? "" : "bg-cream/30"}`}>
                          <button
                            type="button"
                            onClick={() => setDate(cell.iso)}
                            className={`mb-1 flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-mono text-[11px] font-semibold transition-colors ${FOCUS} ${isAnchor ? "bg-accent text-accentfg" : cell.iso === today ? "border border-accent text-accent" : cell.inMonth ? "text-cocoa hover:bg-cream" : "text-dim"}`}
                            aria-label={`Show ${dayTitle(cell.iso)}`}
                            aria-pressed={isAnchor}
                          >
                            {cell.day}
                          </button>
                          <span className="flex flex-wrap gap-1" aria-hidden>
                            {dayEvents.slice(0, 4).map((e) => (
                              <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: AWARD_META[e.type].dot }} />
                            ))}
                            {dayEvents.length > 4 && <span className="font-mono text-[9px] text-dim">+{dayEvents.length - 4}</span>}
                          </span>
                          <span className="mt-1 flex flex-col gap-1">
                            {dayEvents.slice(0, 2).map((e) => (
                              <span key={e.id} data-event-trigger>
                                <EventButton e={e} onOpen={(ev, trigger) => setPopover({ event: ev, trigger })} />
                              </span>
                            ))}
                            {dayEvents.length > 2 && (
                              <button type="button" onClick={() => setDate(cell.iso)} className={`text-left font-mono text-[9.5px] text-dim hover:text-accent ${FOCUS}`}>
                                +{dayEvents.length - 2} more
                              </button>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {shown.length > 0 && query.view === "day" && (
          <div className="rounded-[18px] border border-line bg-card p-5">
            <p className="eyebrow mb-3">{dayTitle(anchor)}</p>
            {onAnchor.length === 0 ? (
              <p className="text-[13.5px] text-dim" role="status">No published window covers this day.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {onAnchor.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="h-2 w-2 rounded-full" style={{ background: AWARD_META[e.type].dot }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-ink">{e.title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[.08em] text-dim">{spanText(e)} · {STATUS_LABEL[e.status]}{e.level ? ` · ${LEVEL_LABEL[e.level]}` : " · difficulty not published"}</span>
                    </span>
                    <span data-event-trigger>
                      <EventButton e={e} onOpen={(ev, trigger) => setPopover({ event: ev, trigger })} full />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* mobile: the same range as a chronological list */}
        {shown.length > 0 && query.view !== "day" && (
          <div className="md:hidden">
            <p className="eyebrow mb-3">{monthTitle(anchor)}</p>
            {visible.length === 0 ? (
              <p className="rounded-[16px] border border-dashed border-line px-4 py-6 text-[13px] text-dim" role="status">No dated window falls in this month.</p>
            ) : (
              <ul className="space-y-2">
                {visible.map((e) => (
                  <li key={e.id} className="rounded-[14px] border border-line bg-card p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[.08em] text-dim">{spanText(e)}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AWARD_META[e.type].dot }} aria-hidden />
                      <span className="text-[13.5px] font-semibold text-ink">{e.title}</span>
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-2">
                      <Chip tone="blue">{e.custom ? "Your date" : e.phase}</Chip>
                      <span data-event-trigger>
                        <button type="button" onClick={(ev) => setPopover({ event: e, trigger: ev.currentTarget })} className={`font-mono text-[10.5px] uppercase tracking-[.08em] text-accent hover:text-accentd ${FOCUS}`} aria-label={`Open details for ${e.title}`}>
                          Details
                        </button>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* the selected day's agenda: month and week views */}
      {query.view !== "day" && (
        <section className="mt-8" aria-label="Selected day">
          <h2 className="card-title">On {dayTitle(anchor)}</h2>
          {onAnchor.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-dim">No published window covers this day. Pick another day in the grid.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70 rounded-[16px] border border-line bg-card px-4">
              {onAnchor.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: AWARD_META[e.type].dot }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">{e.title}</span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[.08em] text-dim">{spanText(e)} · {STATUS_LABEL[e.status]}</span>
                  </span>
                  <span data-event-trigger>
                    <button type="button" onClick={(ev) => setPopover({ event: e, trigger: ev.currentTarget })} className={`font-mono text-[10.5px] uppercase tracking-[.08em] text-accent hover:text-accentd ${FOCUS}`} aria-label={`Open details for ${e.title}`}>
                      Details
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* export */}
      <section className="mt-9 grid gap-6 lg:grid-cols-2" aria-label="Export and add a date">
        <div>
          <h2 className="card-title">Take it with you</h2>
          <p className="card-desc mt-2">
            One .ics file holding the {shown.length} event{shown.length === 1 ? "" : "s"} this filter shows, all-day,
            with the source line in each description. Any calendar app that reads RFC 5545 can open it.
          </p>
          <button type="button" onClick={download} disabled={shown.length === 0} className={`mt-4 ${btn("primary", "md")} disabled:cursor-not-allowed disabled:opacity-50`}>
            Export {shown.length} event{shown.length === 1 ? "" : "s"} as .ics
          </button>
          <p className="mt-2 font-mono text-[10px] leading-[1.6] text-dim">
            File: {icsFileName(anchor)} · data as of {DATA_AS_OF} · dates are dated, not timed.
          </p>
        </div>

        <Card>
          <h2 className="card-title">Add a date</h2>
          <p className="card-desc mt-1.5">
            Most programs publish rolling or unstated dates, so a calendar of only the catalog would be half empty.
            Keep your own deadlines here - they stay in this browser.
          </p>
          <form className="mt-4" onSubmit={add} noValidate>
            <label htmlFor="cal-add-title" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Title</label>
            <input id="cal-add-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Draft proposal for Kubernetes" className={`w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-dim ${FOCUS}`} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cal-add-start" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Start</label>
                <input id="cal-add-start" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={`w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink ${FOCUS}`} />
              </div>
              <div>
                <label htmlFor="cal-add-end" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">End (optional)</label>
                <input id="cal-add-end" type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={`w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink ${FOCUS}`} />
              </div>
            </div>
            <label htmlFor="cal-add-note" className="mt-3 mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Note (optional)</label>
            <input id="cal-add-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Mentor call at 18:00 UTC" className={`w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-dim ${FOCUS}`} />
            <button type="submit" className={`mt-4 ${btn("dark", "md")}`}>Add to this calendar</button>
          </form>
          <p className="mt-3 min-h-[18px] text-[12px] leading-[1.5]" role={msg?.kind === "err" ? "alert" : "status"}>
            {msg && <span className={msg.kind === "err" ? "text-brick" : "text-leaf"}>{msg.text}</span>}
          </p>
          {storedReady && custom.length > 0 && (
            <div className="mt-2 border-t border-line pt-3">
              <p className="eyebrow mb-2">Your dates</p>
              <ul className="space-y-1.5">
                {custom.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px] text-cocoa">{e.title} · {spanText(e)}</span>
                    <button type="button" onClick={() => removeCustom(e.id)} className={`shrink-0 font-mono text-[10px] uppercase tracking-[.08em] text-brick hover:underline ${FOCUS}`} aria-label={`Remove ${e.title}`}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </section>

      {popover && (
        <EventDetails
          key={popover.event.id}
          e={popover.event}
          onClose={close}
          onRemove={popover.event.custom ? () => removeCustom(popover.event.id) : undefined}
        />
      )}

      <p className="mt-10 border-t border-line pt-5 font-mono text-[10px] leading-[1.7] text-dim">
        {PROGRAM_SOURCE} · as of {DATA_AS_OF}. Program pages: {PROGRAMS.map((p) => p.name).join(", ")}.
        Dates are all-day and UTC; an organizer&apos;s own timezone may shift a deadline by a day.
      </p>
    </div>
  );
}
