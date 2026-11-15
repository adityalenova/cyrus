"use client"
/* ══ calendar.tsx — the season calendar on the board ══════════════
   Every phase window of every program we track, laid on a real month
   grid. Pick a day to see what closes on it, open the agenda for the
   month to add one window to Google Calendar, or take the whole year as
   an .ics and put it in whatever you already use. Dates are the
   organizers' published windows rounded to the nearest few days - the
   page says so rather than pretending to day precision.            ══ */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { PROGRAMS } from "../../data/orgs";
import { btn } from "../../components/ui";
import { googleUrl, ics, monthGrid, overlaps, seasonEvents, spanLabel, yearOf, type SeasonEvent } from "../seasons";
import { Card, DashHead, Ic } from "./shell";
import { DP } from "./shared";
import type { Dash } from "./useDash";

const DAY = 864e5;
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CYCLES = [2026, 2027];

const midnight = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const monthStart = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const monthName = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

function save(file: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = file;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const Dot = ({ c }: { c: string }) => (
  <i className="not-italic block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: c }} aria-hidden />
);

/* ── one agenda row ───────────────────────────────────────────── */
function EventRow({ e, day }: { e: SeasonEvent; day?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-liness last:border-0">
      <span className="mt-1.5 shrink-0"><Dot c={e.color} /></span>
      <span className="min-w-0 flex-1">
        <Link to={`/programs/${e.pid}`} className="block text-[13.5px] font-semibold text-ink hover:text-accent transition-colors truncate">
          {e.program} <span className="text-dim font-normal">· {e.phase}</span>
        </Link>
        <span className="block font-mono text-[9.5px] uppercase tracking-[.1em] text-dim mt-1">
          {day ? "running on" : "runs"} {spanLabel(e)} · {new Date(e.start).getFullYear()}
        </span>
      </span>
      <a href={googleUrl(e)} target="_blank" rel="noopener"
        className={btn("outline", "sm", "shrink-0")} title="Open a prefilled event in Google Calendar">
        <Ic d={DP.calendar} size={13} /> Google
      </a>
    </div>
  );
}

export function CalendarSection({ d }: { d: Dash }) {
  const [ms, setMs] = useState(() => midnight(Date.now()));
  const [pick, setPick] = useState<number | null>(null);
  const [only, setOnly] = useState<string | null>(null);

  const all = useMemo(() => CYCLES.flatMap(seasonEvents), []);
  const live = useMemo(() => (only ? all.filter((e) => e.pid === only) : all), [all, only]);

  const cells = useMemo(() => monthGrid(ms), [ms]);
  /* monthGrid always fills six weeks; drop a sixth row that is entirely next
     month so a five-week month reads as five rows, like a real calendar */
  const rows = useMemo(() => (cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells), [cells]);
  const from = monthStart(ms);
  const to = new Date(new Date(ms).getFullYear(), new Date(ms).getMonth() + 1, 1).getTime();
  const today = midnight(Date.now());

  const inMonth = useMemo(() => live.filter((e) => overlaps(e, from, to)), [live, from, to]);
  /* strictly future openings: the month agenda above already lists what is running */
  const next = useMemo(() => live.filter((e) => e.start > today).sort((a, b) => a.start - b.start).slice(0, 6), [live, today]);
  const onPick = useMemo(() => (pick === null ? [] : live.filter((e) => overlaps(e, pick, pick + DAY))), [live, pick]);

  const shift = (n: number) => {
    const x = new Date(ms);
    setMs(new Date(x.getFullYear(), x.getMonth() + n, 1).getTime());
    setPick(null);
  };

  const yearFile = `cyrus-seasons-${yearOf(ms)}.ics`;
  const download = () => {
    const list = live.filter((e) => yearOf(e.start) === yearOf(ms));
    if (!list.length) { d.toast("No window in that year for this filter - try the other cycle."); return; }
    save(yearFile, ics(list, `cyrus.ai seasons ${yearOf(ms)}`));
    d.toast(`${yearFile} saved - import it into any calendar app.`);
  };

  return (
    <>
      <Card className="p-5 md:p-6">
        <DashHead
          title="Season calendar"
          sub="Application windows, community bondings and coding periods for all thirteen tracked programs, on one grid."
          action={
            <button type="button" onClick={download} className={btn("outline", "sm")}>
              <Ic d={DP.download} size={13} /> {yearOf(ms)} as .ics
            </button>
          }
        />

        {/* program filter - thirteen chips wrap on desktop and scroll as one rail on phones */}
        <div className="no-scrollbar flex gap-1.5 flex-wrap mt-6 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1.5"
          role="group" aria-label="Filter the calendar by program">
          <button type="button" onClick={() => setOnly(null)} aria-pressed={only === null}
            className={`shrink-0 font-mono text-[10px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${!only ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
            All programs
          </button>
          {PROGRAMS.map((p) => {
            const on = only === p.id;
            return (
              <button key={p.id} type="button" onClick={() => setOnly(on ? null : p.id)} aria-pressed={on}
                className={`shrink-0 font-mono text-[10px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer flex items-center gap-1.5 ${on ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                <Dot c={p.phases[0]?.c ?? "var(--color-accent)"} />{p.name}
              </button>
            );
          })}
        </div>

        {/* month nav - arrows at the outer edges, month and Today centered */}
        <div className="relative flex items-center justify-center gap-3 mt-7 mb-4">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
            className="absolute left-0 w-[34px] h-[34px] rounded-full border border-line text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer grid place-items-center font-mono">‹</button>
          <h2 className="font-display font-extrabold text-[21px] tracking-[-.02em]">{monthName(ms)}</h2>
          <button type="button" onClick={() => { setMs(midnight(Date.now())); setPick(null); }} className={btn("outline", "sm")}>Today</button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month"
            className="absolute right-0 w-[34px] h-[34px] rounded-full border border-line text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer grid place-items-center font-mono">›</button>
        </div>

        {/* the grid: hairline walls, one readable chip per window */}
        <div className="rounded-[16px] border border-line bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-cream">
            {WD.map((w) => (
              <span key={w} className="py-2.5 text-center font-mono text-[9px] sm:text-[9.5px] uppercase tracking-[.16em] text-dim">{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {rows.map((c, i) => {
              const evs = live.filter((e) => overlaps(e, c.ms, c.ms + DAY));
              const isToday = c.ms === today;
              const isPick = c.ms === pick;
              const edgeR = (i + 1) % 7 === 0;
              const edgeB = i >= rows.length - 7;
              return (
                <button key={c.ms} type="button"
                  onClick={() => setPick(isPick ? null : (evs.length ? c.ms : null))}
                  disabled={!evs.length} aria-pressed={isPick}
                  aria-label={`${c.day} ${monthName(ms)} - ${evs.map((e) => `${e.program} ${e.phase}`).join(", ") || "no window"}`}
                  className={`relative min-h-[92px] sm:min-h-[128px] p-1.5 sm:p-2 text-left transition-colors ${
                    edgeR ? "" : "border-r border-liness"} ${edgeB ? "" : "border-b border-liness"} ${
                    isPick ? "bg-peach" : evs.length ? "bg-cream/60 cursor-pointer hover:bg-cream" : "bg-transparent"} ${
                    c.inMonth ? "" : "opacity-45"}`}>
                  <span className={`block font-mono text-[11px] leading-none mb-1.5 ${
                    isToday ? "grid place-items-center w-[21px] h-[21px] rounded-full bg-ink text-paper font-bold"
                      : c.inMonth ? "text-cocoa" : "text-dim"}`}>{c.day}</span>
                  <span className="grid gap-1">
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} title={`${e.program} - ${e.phase}`}
                        className="flex items-center gap-1.5 min-w-0 rounded-full border border-line bg-card pl-[5px] pr-2 py-[3px]">
                        <Dot c={e.color} />
                        <span className="font-mono text-[9px] sm:text-[9.5px] text-cocoa truncate">{e.program}</span>
                      </span>
                    ))}
                    {evs.length > 3 && (
                      <span className="font-mono text-[9px] text-dim pl-1">+{evs.length - 3} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim mt-2.5">
          {inMonth.length} window{inMonth.length === 1 ? "" : "s"} · {new Set(inMonth.map((e) => e.pid)).size} program{new Set(inMonth.map((e) => e.pid)).size === 1 ? "" : "s"} this month · tap a day for its full list
        </p>

        {pick !== null && (
          <div className="mt-4 rounded-[12px] border border-line bg-cream p-4">
            <b className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-1">
              On {new Date(pick).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              <button type="button" onClick={() => setPick(null)} className="ml-auto text-dim hover:text-accent cursor-pointer" aria-label="Clear the picked day">
                <Ic d={DP.x} size={13} />
              </button>
            </b>
            {onPick.map((e) => <EventRow key={e.id} e={e} day />)}
          </div>
        )}
      </Card>

      {/* agenda for the month */}
      <Card className="p-5 md:p-6">
        <h2 className="panel-h text-[17px]">Windows touching <span className="text-accent">{monthName(ms)}</span></h2>
        {inMonth.length ? (
          <div className="mt-2">{inMonth.map((e) => <EventRow key={e.id} e={e} />)}</div>
        ) : (
          <p className="text-[13.5px] text-dim mt-3">
            Nothing opens or closes this month for {only ? PROGRAMS.find((p) => p.id === only)?.name : "any tracked program"}.
            The next window is below.
          </p>
        )}
      </Card>

      {/* what is coming */}
      <Card className="p-5 md:p-6">
        <h2 className="panel-h text-[17px] mb-1">Next up</h2>
        <p className="text-cocoa text-[12.5px] mb-2">The six windows that have not opened yet, closest first.</p>
        {next.length ? (
          <div>{next.map((e) => <EventRow key={e.id} e={e} />)}</div>
        ) : (
          <p className="text-[13.5px] text-dim">
            Nothing is queued ahead of today for {only ? PROGRAMS.find((p) => p.id === only)?.name : "these programs"}.
            Use the arrows above to look at a later month, or clear the program filter.
          </p>
        )}
        <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-[1.8] mt-4">
          Windows come from each organizer&apos;s published calendar and are rounded to the nearest few days, so treat a date here as
          good to within about three days and confirm on the program page before you plan around it. The .ics file is a whole year of
          them and imports into Google, Apple and Outlook; the Google button opens one prefilled event you can edit before you save.
        </p>
      </Card>
    </>
  );
}
