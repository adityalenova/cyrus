"use client"
/* ══ OrgAnalytics.tsx — the analytics dashboard ════════════════════
   Issue #187. Two real sources, each panel says which one it reads:

   · "your recorded events in this browser, since <date>" — the tracker
     stream captured by storage.ts, the issue ledger and saved searches;
   · "crawl snapshot, crawled 2026-10-21" — src/data/issueSignals.ts and
     crawlStats.ts.

   The time series, the period comparison and the live "last event" line
   come only from the first. The snapshot is one point in time, so it is
   shown as counts, never as a trend. Charts are hand-rolled SVG, each with
   a table alternative; the CSV buttons export exactly the visible rows. ═ */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/dash/shell";
import { btn } from "@/components/ui";
import { exportToCsv, type CsvColumn } from "@/lib/exportCsv";
import { CRAWL } from "@/data/crawlStats";
import { ISSUE_SIGNALS } from "@/data/issueSignals";
import {
  RANGE_DAYS, bucketEvents, beginnerShare, cumulativeSeries, elapsedLabel, historyStart,
  historyState, languageMix, lastEvent, nameCounts, orgAggregates, orgCsvRows, percent,
  periodComparison, repoAggregates, repoCsvRows, seriesCsvRows, utcDay, windowDays,
  type DayBucket, type OrgAggregate, type OrgCsvRow, type RangeDays, type RecordedEvent,
  type RepoCsvRow, type SeriesCsvRow, type SeriesPoint, type SnapshotIssue, type SnapshotTotals,
} from "./model";
import { readRecordedEvents, startAnalyticsRecorder } from "./storage";

const W = "max-w-[1240px] mx-auto px-6";

const SNAPSHOT_TOTALS: SnapshotTotals = {
  issues: CRAWL.issues,
  reposWithIssues: CRAWL.reposWithIssues,
  orgs: CRAWL.orgs,
  languages: CRAWL.languages,
  beginnerLabelled: CRAWL.beginnerLabelled,
  crawledAt: CRAWL.crawledAt,
};
const SNAPSHOT = ISSUE_SIGNALS as SnapshotIssue[];
const SNAPSHOT_LINE = `crawl snapshot, crawled ${SNAPSHOT_TOTALS.crawledAt}`;

const shortDay = (day: string) => day.slice(5);
const prettyDay = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

/* ── charts (hand-rolled SVG, one table alternative each) ─────────── */

const AXIS = "var(--color-line)";
const AXIS_TEXT = "var(--color-dim)";

function BarChart({ buckets, label }: { buckets: DayBucket[]; label: string }) {
  const total = buckets.reduce((n, b) => n + b.count, 0);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const W = 720, H = 190, L = 34, R = 8, T = 12, B = 24;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const step = plotW / Math.max(1, buckets.length);
  const barW = Math.max(1, step - (buckets.length > 40 ? 0.6 : 2));
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const marks = [0, Math.ceil(max / 2), max];
  const xLab = buckets.length > 2 ? [0, Math.floor(buckets.length / 2), buckets.length - 1] : [0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={`${label}: ${total} recorded events over ${buckets.length} days; busiest day ${max}. A table of the same values follows.`}>
      {marks.map((m) => (
        <g key={m}>
          <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke={AXIS} strokeWidth={1} />
          <text x={L - 6} y={y(m) + 3.5} textAnchor="end" fontSize={9} fill={AXIS_TEXT} fontFamily="var(--font-mono)">{m}</text>
        </g>
      ))}
      {buckets.map((b, i) => (
        <rect key={b.day}
          x={L + i * step + (step - barW) / 2}
          y={b.count ? y(b.count) : y(0)}
          width={barW}
          height={b.count ? y(0) - y(b.count) : 0}
          fill="var(--color-accent)" rx={1}
          opacity={b.count ? 0.9 : 0} />
      ))}
      {xLab.map((i) => (
        <text key={i} x={L + i * step + step / 2} y={H - 7} fontSize={9} fill={AXIS_TEXT} fontFamily="var(--font-mono)"
          textAnchor={i === 0 ? "start" : i === buckets.length - 1 ? "end" : "middle"}>
          {buckets[i] ? shortDay(buckets[i].day) : ""}
        </text>
      ))}
    </svg>
  );
}

function LineChart({ series }: { series: SeriesPoint[] }) {
  const W = 720, H = 190, L = 34, R = 8, T = 12, B = 24;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const n = series.length;
  const max = Math.max(1, ...series.map((p) => Math.max(p.current, p.previous)));
  const x = (i: number) => (n <= 1 ? L + plotW / 2 : L + (i / (n - 1)) * plotW);
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const pathOf = (key: "current" | "previous") =>
    series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const last = series[n - 1];
  const marks = [0, Math.ceil(max / 2), max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={`Cumulative events, this period against the one before: ${last?.current ?? 0} now versus ${last?.previous ?? 0} before. A table of the same values follows.`}>
      {marks.map((m) => (
        <g key={m}>
          <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke={AXIS} strokeWidth={1} />
          <text x={L - 6} y={y(m) + 3.5} textAnchor="end" fontSize={9} fill={AXIS_TEXT} fontFamily="var(--font-mono)">{m}</text>
        </g>
      ))}
      <path d={pathOf("previous")} fill="none" stroke="var(--color-rule)" strokeWidth={1.6} strokeDasharray="4 3" />
      <path d={pathOf("current")} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      {series.length > 0 && (
        <circle cx={x(n - 1)} cy={y(last.current)} r={3} fill="var(--color-accent)" />
      )}
      {n > 2 && [0, Math.floor(n / 2), n - 1].map((i) => (
        <text key={i} x={x(i)} y={H - 7} fontSize={9} fill={AXIS_TEXT} fontFamily="var(--font-mono)"
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{shortDay(series[i].day)}</text>
      ))}
    </svg>
  );
}

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3">
      <summary className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim cursor-pointer hover:text-accent focus-visible:ring-2 focus-visible:ring-accent rounded">
        Table of values ({rows.length} rows)
      </summary>
      <div className="mt-2 max-h-[240px] overflow-y-auto panel-scroll border border-line rounded-[12px]">
        <table className="w-full text-left text-[12.5px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-sand">
            <tr className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">
              {head.map((h, i) => <th key={h} scope="col" className={`px-3 py-2 ${i ? "text-right" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={String(row[0]) + ri} className="border-t border-line">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-1.5 font-mono text-[11.5px] ${ci ? "text-right" : ""}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* CSV column maps: the shapes come from model.ts so the export and the
   chart cannot drift apart. */
const SERIES_COLUMNS: CsvColumn<SeriesCsvRow>[] = [
  { header: "day (UTC)", accessor: (r) => r.day },
  { header: "recorded events", accessor: (r) => r.events },
];
const ORG_COLUMNS: CsvColumn<OrgCsvRow>[] = [
  { header: "organisation", accessor: (r) => r.organisation },
  { header: "repositories (crawl detail)", accessor: (r) => r.repositories },
  { header: "open issues (crawl detail)", accessor: (r) => r.openIssues },
  { header: "beginner-labelled", accessor: (r) => r.beginnerLabelled },
  { header: "beginner share", accessor: (r) => r.beginnerShare },
  { header: "languages", accessor: (r) => r.languages },
];
const REPO_COLUMNS: CsvColumn<RepoCsvRow>[] = [
  { header: "repository", accessor: (r) => r.repository },
  { header: "organisation", accessor: (r) => r.organisation },
  { header: "open issues (crawl detail)", accessor: (r) => r.openIssues },
  { header: "language", accessor: (r) => r.language },
  { header: "beginner-labelled", accessor: (r) => r.beginnerLabelled },
];

/* ── small panels ─────────────────────────────────────────── */

const Provenance = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim">{children}</p>
);

function OrgTable({ rows }: { rows: OrgAggregate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Organisations in the crawl detail rows</caption>
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">
            <th scope="col" className="py-2 pr-3">Organisation</th>
            <th scope="col" className="py-2 px-3 text-right">Repos</th>
            <th scope="col" className="py-2 px-3 text-right">Open issues</th>
            <th scope="col" className="py-2 px-3 text-right">Beginner</th>
            <th scope="col" className="py-2 pl-3">Languages</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.org} className="border-t border-line align-top">
              <th scope="row" className="py-2 pr-3 font-semibold text-ink whitespace-nowrap">{o.org}</th>
              <td className="py-2 px-3 text-right font-mono text-[12px]">{o.repos}</td>
              <td className="py-2 px-3 text-right font-mono text-[12px]">{o.issues}</td>
              <td className="py-2 px-3 text-right font-mono text-[12px]">
                {o.beginner} <span className="text-dim">({percent(o.beginnerShare, 0)})</span>
              </td>
              <td className="py-2 pl-3 text-cocoa text-[12.5px]">{o.languages.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepoTable({ rows }: { rows: ReturnType<typeof repoAggregates> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Repositories in the crawl detail rows</caption>
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">
            <th scope="col" className="py-2 pr-3">Repository</th>
            <th scope="col" className="py-2 px-3 text-right">Open issues</th>
            <th scope="col" className="py-2 px-3">Language</th>
            <th scope="col" className="py-2 pl-3 text-right">Beginner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.repo} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-semibold text-ink whitespace-nowrap">{r.repo}</th>
              <td className="py-2 px-3 text-right font-mono text-[12px]">{r.issues}</td>
              <td className="py-2 px-3 text-cocoa text-[12.5px]">{r.lang}</td>
              <td className="py-2 pl-3 text-right font-mono text-[12px]">{r.beginner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── the page ─────────────────────────────────────────────── */

export default function OrgAnalytics() {
  const [range, setRange] = useState<RangeDays>(30);
  const [view, setView] = useState<"organisations" | "repositories">("organisations");
  const [events, setEvents] = useState<RecordedEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  /* read the stores once, then keep listening while this page is open */
  useEffect(() => {
    const refresh = () => setEvents(readRecordedEvents());
    refresh();
    setReady(true);
    const stop = startAnalyticsRecorder(refresh);
    window.addEventListener("storage", refresh);
    return () => {
      stop();
      window.removeEventListener("storage", refresh);
    };
  }, []);

  /* one tick per second drives the "last event Ns ago" line - and only that
     line, because the chart memos key on the UTC day, not the clock */
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = utcDay(clock);
  const anchor = useMemo(() => new Date(`${today}T12:00:00Z`), [today]);

  const buckets = useMemo(() => bucketEvents(events, range, anchor), [events, range, anchor]);
  const series = useMemo(() => cumulativeSeries(events, range, anchor), [events, range, anchor]);
  const comparison = useMemo(() => periodComparison(events, range, anchor), [events, range, anchor]);
  const state = useMemo(() => historyState(events, range, anchor), [events, range, anchor]);
  const recent = useMemo(() => lastEvent(events, clock), [events, clock]);
  const names = useMemo(() => nameCounts(events), [events]);
  const start = useMemo(() => historyStart(events), [events]);

  const orgs = useMemo(() => orgAggregates(SNAPSHOT), []);
  const repos = useMemo(() => repoAggregates(SNAPSHOT), []);
  const langs = useMemo(() => languageMix(SNAPSHOT), []);
  const detailBeginner = useMemo(() => beginnerShare(SNAPSHOT), []);
  const snapshotBeginner = SNAPSHOT_TOTALS.beginnerLabelled / SNAPSHOT_TOTALS.issues;
  const langMax = Math.max(1, ...langs.map((l) => l.issues));

  const historyLine = start
    ? `your recorded events in this browser, since ${prettyDay(start)}`
    : "your recorded events in this browser - none yet";

  const exportSeries = () =>
    exportToCsv(seriesCsvRows(buckets), SERIES_COLUMNS, `cyrus-recorded-events-${range}d.csv`);
  const exportSnapshot = () =>
    view === "organisations"
      ? exportToCsv(orgCsvRows(orgs), ORG_COLUMNS, "cyrus-crawl-organisations.csv")
      : exportToCsv(repoCsvRows(repos), REPO_COLUMNS, "cyrus-crawl-repositories.csv");

  return (
    <div className={`${W} pt-14 pb-16`}>
      <p className="eyebrow mb-4">Analytics</p>
      <h1 className="font-display font-extrabold tracking-[-.03em] text-[clamp(30px,4.4vw,50px)] leading-[1.06]">
        Organization analytics
      </h1>
      <p className="text-cocoa text-[15.5px] leading-[1.65] mt-3 max-w-[660px]">
        Two sources, named on every panel: what this browser recorded for you, and the crawl snapshot
        taken on {SNAPSHOT_TOTALS.crawledAt}. No server analytics, no sampled traffic, and no line drawn
        through a single snapshot.
      </p>

      {/* ── controls ── */}
      <div className="flex items-end gap-4 flex-wrap mt-7">
        <div role="group" aria-label="Time range" className="flex gap-1.5">
          {RANGE_DAYS.map((d) => (
            <button key={d} type="button" onClick={() => setRange(d)} aria-pressed={range === d}
              className={`font-mono text-[11px] font-semibold rounded-full px-3 py-1.5 border transition-colors cursor-pointer ${
                range === d ? "bg-accent text-accentfg border-accent" : "bg-card text-cocoa border-line hover:text-ink"
              }`}>
              Last {d} days
            </button>
          ))}
        </div>
        <button type="button" className={btn("outline", "sm") + " ml-auto"} onClick={exportSeries} disabled={buckets.length === 0}>
          Export range CSV
        </button>
      </div>

      {/* ── live-ish line ── */}
      <Card className="mt-6 reveal" style={{ animationDelay: "40ms" }}>
        <div className="flex items-baseline gap-4 flex-wrap">
          <p className="panel-h-lg">This browser</p>
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-dim">
            one visitor - you. There is no server-side visitor count.
          </span>
          <p className="ml-auto font-mono text-[12px] text-cocoa" role="status" aria-live="polite">
            {recent.seconds === null
              ? "no event recorded yet"
              : <>last event <b className="text-ink">{elapsedLabel(recent.seconds)}</b> ago</>}
          </p>
        </div>
        <p className="card-desc mt-2">
          {ready && events.length > 0
            ? <>{events.length} event{events.length === 1 ? "" : "s"} recorded. The newest is stamped{" "}
                <span className="font-mono text-[12px] text-ink">{recent.at?.replace("T", " ").slice(0, 19)} UTC</span>.
                This ticks over when the app emits an analytics event or when a store changes; there is no socket
                pretending otherwise.</>
            : ready
              ? <>Nothing recorded yet. The app records analytics events, the issue ledger and saved searches
                  in this browser - none of the three holds a row here. The panels below will stay empty until
                  one does.</>
              : <>Reading this browser&apos;s stores…</>}
        </p>
        <div className="mt-3 pt-3 border-t border-dashed border-line">
          <Provenance>{historyLine}</Provenance>
        </div>
      </Card>

      {/* ── period comparison ── */}
      <Card className="mt-6 reveal" style={{ animationDelay: "90ms" }}>
        <div className="flex items-baseline gap-3 flex-wrap mb-1">
          <h2 className="panel-h-lg">Period over period</h2>
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-dim">
            last {range} days vs the {range} before
          </span>
        </div>
        {state === "no-history" ? (
          <p className="card-desc" role="status">
            No history yet. There is nothing to compare: this browser has not recorded an event, an issue or
            a saved search. Saving an issue from the finder is the quickest way to start a real series.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {[
                ["This period", String(comparison.current)],
                ["Previous period", String(comparison.previous)],
                ["Change", `${comparison.delta >= 0 ? "+" : ""}${comparison.delta}`],
                ["Percent", comparison.pct === null ? "—" : `${comparison.pct > 0 ? "+" : ""}${comparison.pct}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[12px] border border-line bg-cream px-3 py-2.5">
                  <p className="font-mono text-[9.5px] uppercase tracking-[.13em] text-dim">{label}</p>
                  <p className="font-display font-bold text-[22px] tracking-[-.02em] mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <p className="card-desc mt-3">
              {comparison.pct === null
                ? "No events in the previous window, so a percent change would be division by zero; the raw counts are shown instead."
                : comparison.delta === 0
                  ? "The two windows hold the same number of recorded events."
                  : comparison.delta > 0
                    ? `This window holds ${comparison.delta} more recorded event${comparison.delta === 1 ? "" : "s"} than the one before it.`
                    : `This window holds ${Math.abs(comparison.delta)} fewer recorded event${Math.abs(comparison.delta) === 1 ? "" : "s"} than the one before it.`}
            </p>
            {state === "no-events-in-range" && (
              <p className="mt-2 font-mono text-[11px] text-honey" role="status">
                Nothing inside the last {range} days, or the {range} before it. Widen the range to reach the history
                that starts at {prettyDay(start)}.
              </p>
            )}
          </>
        )}
        <div className="mt-3 pt-3 border-t border-dashed border-line">
          <Provenance>{historyLine}</Provenance>
        </div>
      </Card>

      {/* ── charts ── */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6 items-start">
        <Card className="reveal" style={{ animationDelay: "140ms" }}>
          <h2 className="panel-h-lg">Recorded events per day</h2>
          <p className="card-desc mt-1 mb-2">
            A calendar of the selected window, zero days included. UTC days, so the bars line up with the
            timestamps below rather than with any one timezone.
          </p>
          {state === "ready" ? (
            <>
              <BarChart buckets={buckets} label={`Recorded events per day, last ${range} days`} />
              <DataTable caption="Recorded events per UTC day" head={["Day (UTC)", "Events"]}
                rows={buckets.map((b) => [b.day, b.count])} />
            </>
          ) : (
            <p className="card-desc py-6" role="status">
              {state === "no-history"
                ? "No history yet - a bar chart of nothing would be a blank axis, so none is drawn."
                : `No recorded event in the last ${range} days. The chart stays empty rather than padding the window.`}
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-dashed border-line">
            <Provenance>{historyLine}</Provenance>
          </div>
        </Card>

        <Card className="reveal" style={{ animationDelay: "200ms" }}>
          <h2 className="panel-h-lg">Cumulative: this period vs the last</h2>
          <p className="card-desc mt-1 mb-2">
            Running totals, aligned by day number. The dashed line is the equally long window immediately
            before; neither line is smoothed.
          </p>
          {state === "ready" ? (
            <>
              <LineChart series={series} />
              <div className="flex gap-4 flex-wrap font-mono text-[10px] uppercase tracking-[.12em] text-dim mt-1">
                <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] bg-accent inline-block" aria-hidden /> this period</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] bg-rule inline-block" aria-hidden /> previous period</span>
              </div>
              <DataTable caption="Cumulative recorded events, this period and the previous one"
                head={["Day (UTC)", "This period", "Previous"]}
                rows={series.map((p) => [p.day, p.current, p.previous])} />
            </>
          ) : (
            <p className="card-desc py-6" role="status">No recorded events in this window to accumulate.</p>
          )}
          <div className="mt-3 pt-3 border-t border-dashed border-line">
            <Provenance>{historyLine}</Provenance>
          </div>
        </Card>
      </div>

      {/* ── event names ── */}
      {state === "ready" && (
        <Card className="mt-6 reveal" style={{ animationDelay: "240ms" }}>
          <h2 className="panel-h-lg">What this browser recorded</h2>
          <p className="card-desc mt-1 mb-3">
            Event names exactly as they were stored - tracker names, plus <code className="font-mono text-[12px]">issue.&lt;stage&gt;</code>{" "}
            from the ledger and <code className="font-mono text-[12px]">search.saved</code> from saved searches.
          </p>
          <div className="grid gap-1.5">
            {names.slice(0, 12).map((n) => (
              <div key={n.name} className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-ink">{n.name}</span>
                <span className="flex-1 border-t border-dotted border-line self-center" aria-hidden />
                <b className="font-mono text-[12px]">{n.count}</b>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-dashed border-line">
            <Provenance>{historyLine}</Provenance>
          </div>
        </Card>
      )}

      {/* ── snapshot: totals ── */}
      <Card className="mt-6 reveal" style={{ animationDelay: "280ms" }}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="panel-h-lg">Snapshot at a glance</h2>
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-dim">
            one point in time - no trend can be computed from it
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {[
            ["Open issues", SNAPSHOT_TOTALS.issues],
            ["Repositories with issues", SNAPSHOT_TOTALS.reposWithIssues],
            ["Organisations", SNAPSHOT_TOTALS.orgs],
            ["Languages", SNAPSHOT_TOTALS.languages],
            ["Beginner-labelled", SNAPSHOT_TOTALS.beginnerLabelled],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-[12px] border border-line bg-cream px-3 py-2.5">
              <p className="font-mono text-[9.5px] uppercase tracking-[.13em] text-dim">{label}</p>
              <p className="font-display font-bold text-[20px] tracking-[-.02em] mt-0.5">{value.toLocaleString("en-US")}</p>
            </div>
          ))}
        </div>
        <p className="card-desc mt-3">
          {SNAPSHOT_TOTALS.beginnerLabelled.toLocaleString("en-US")} of{" "}
          {SNAPSHOT_TOTALS.issues.toLocaleString("en-US")} open issues carry a beginner label -{" "}
          {percent(snapshotBeginner)} of the snapshot. The snapshot was taken once, so there is no earlier
          snapshot to difference it against; that is why no growth line appears here.
        </p>
        <div className="mt-3 pt-3 border-t border-dashed border-line">
          <Provenance>{SNAPSHOT_LINE}</Provenance>
        </div>
      </Card>

      {/* ── snapshot: organisations / repositories ── */}
      <Card className="mt-6 reveal" style={{ animationDelay: "320ms" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="panel-h-lg">By {view === "organisations" ? "organisation" : "repository"}</h2>
          <div role="group" aria-label="Aggregate by" className="flex gap-1.5">
            {(["organisations", "repositories"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={`font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-1 border transition-colors cursor-pointer ${
                  view === v ? "bg-accent text-accentfg border-accent" : "bg-cream text-cocoa border-line hover:text-ink"
                }`}>
                {v === "organisations" ? "Organisations" : "Repositories"}
              </button>
            ))}
          </div>
          <button type="button" className={btn("outline", "sm") + " ml-auto"} onClick={exportSnapshot}>
            Export {view} CSV
          </button>
        </div>

        <p className="card-desc mt-2">
          Counted over the {SNAPSHOT.length} crawled issues that carry labels and a language
          ({orgs.length} organisations, {repos.length} repositories). The crawl&apos;s full index holds{" "}
          {SNAPSHOT_TOTALS.issues.toLocaleString("en-US")} issues across {SNAPSHOT_TOTALS.reposWithIssues}{" "}
          repositories; only these detail rows ship with the site, which is why the table is smaller than the
          totals above.
        </p>

        <div className="mt-4">
          {view === "organisations" ? <OrgTable rows={orgs} /> : <RepoTable rows={repos} />}
        </div>

        <p className="mt-3 font-mono text-[11px] text-honey" role="status">
          Every detail row is beginner-labelled ({percent(detailBeginner, 0)}), because the crawl kept issues
          whose labels read as beginner-friendly. The org-level shares below are therefore 100% by
          construction and say nothing about other issues in those repositories.
        </p>

        <div className="mt-3 pt-3 border-t border-dashed border-line">
          <Provenance>{SNAPSHOT_LINE} · detail rows from src/data/issueSignals.ts</Provenance>
        </div>
      </Card>

      {/* ── snapshot: language mix ── */}
      <Card className="mt-6 reveal" style={{ animationDelay: "360ms" }}>
        <h2 className="panel-h-lg">Languages in the detail rows</h2>
        <p className="card-desc mt-1 mb-3">
          Each repository&apos;s primary language as GitHub reported it in the snapshot. Bars are scaled to the
          largest count; the numbers are beside them so the chart is not the only way to read it.
        </p>
        <div className="grid gap-2">
          {langs.map((l) => (
            <div key={l.lang} className="grid grid-cols-[92px_minmax(0,1fr)_40px] items-center gap-3">
              <span className="font-mono text-[11.5px] text-cocoa truncate">{l.lang}</span>
              <span className="h-[8px] rounded-full bg-clay overflow-hidden" aria-hidden>
                <span className="block h-full bg-accent" style={{ width: `${(l.issues / langMax) * 100}%` }} />
              </span>
              <span className="font-mono text-[11.5px] text-ink text-right">{l.issues}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-dashed border-line">
          <Provenance>{SNAPSHOT_LINE} · {langs.length} languages in detail</Provenance>
        </div>
      </Card>

      {/* ── provenance note ── */}
      <Card className="mt-6 reveal" style={{ animationDelay: "400ms" }}>
        <h2 className="panel-h-lg">What this dashboard cannot tell you</h2>
        <ul className="card-desc mt-2 grid gap-1.5 list-none p-0">
          <li>- It cannot count other visitors. Everything in the left-hand panels is this browser alone.</li>
          <li>- It cannot show a snapshot trend. The crawl was taken once ({SNAPSHOT_TOTALS.crawledAt}); a second
            crawl is what a trend would need.</li>
          <li>- It cannot attribute the tracked events to a person or a team. The ledger and saved searches store
            no tenant, so org-level analytics here are the snapshot&apos;s, not a visitor&apos;s.</li>
          <li>- It cannot backfill history: the recorder only holds what was recorded while an analytics page
            was open. The ledger and saved searches reach further back, because they were written as you used
            those pages.</li>
        </ul>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[.13em] text-dim">
          {ready
            ? <>window: last {range} days ({windowDays(range, anchor)[0]} → {today}) UTC</>
            : <>window: last {range} days, UTC</>}
        </p>
      </Card>
    </div>
  );
}
