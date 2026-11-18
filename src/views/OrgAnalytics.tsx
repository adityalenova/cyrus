"use client"
/* ══ OrgAnalytics.tsx — the organization analytics board (#187) ═══════
   One organization's season record read three ways: the whole archive over
   time, the top performers inside a chosen window, and a single
   organization drilled down to its program split and its absent years.
   Everything comes from /data/org-stats.json - the same file the public
   statistics page reads - so the board needs no backend and no schema to
   be honest about what it shows. Charts are hand-rolled SVG and every
   figure on the page can be exported as CSV. Page views and live visitor
   counts are deliberately absent: nothing collects them yet, and an
   analytics board that invents traffic is worse than one that says so.
   ═ */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { btn } from "@/components/ui";
import { exportToCsv } from "@/lib/exportCsv";
import { Card, DashHead, Ic, StatRow } from "@/lib/dash/shell";
import { DP } from "@/lib/dash/shared";
import { useOrgStats } from "@/lib/orgStats";
import {
  RANGES, compare, orgDetail, orgSlices, priorYears, rangeYears, sectorMix,
  statsFor, techMix, topOrgs, yearSeries,
  type OrgSlice, type RangeKey, type RankBy, type Slice,
} from "@/lib/orgAnalytics";

const HUE = [
  "var(--color-accent)", "var(--color-denim)", "var(--color-plum)", "var(--color-honey)",
  "var(--color-brick)", "var(--color-ember)", "var(--color-rule)", "var(--color-dim)", "var(--color-cocoa)",
];

const num = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);
const pc = (v: number) => `${Math.round(v * 100)}%`;

const SORTS: { key: RankBy; label: string }[] = [
  { key: "projects", label: "Projects" },
  { key: "stars", label: "Stars" },
  { key: "issues", label: "Open issues" },
];

/* ── change chip: the number plus how it moved against the prior period ── */
function Change({ now, before, pct, one }: { now: number; before: number; pct: number | null; one: string }) {
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;
  return (
    <div className="rounded-[12px] border border-line bg-cream px-4 py-3">
      <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim">{one}</b>
      <span className="block font-display font-extrabold text-[22px] tracking-[-.02em] mt-1">{num(now)}</span>
      <span className={`block font-mono text-[10.5px] mt-0.5 ${up ? "text-leaf" : down ? "text-brick" : "text-dim"}`}>
        {pct === null ? "nothing recorded in the window before" : `${up ? "▲" : down ? "▼" : "■"} ${pc(Math.abs(pct))} from ${num(before)}`}
      </span>
    </div>
  );
}

/* ── line: participating organizations, with newcomers behind them ── */
function Trend({ points }: { points: { year: number; orgs: number; newcomers: number }[] }) {
  const W = 100, H = 44, BASE = 38;
  const maxO = Math.max(1, ...points.map((p) => p.orgs));
  const maxN = Math.max(1, ...points.map((p) => p.newcomers));
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number, max: number) => BASE - (v / max) * (BASE - 4);
  const line = points.map((p, i) => `${x(i).toFixed(2)},${y(p.orgs, maxO).toFixed(2)}`).join(" ");
  const area = `0,${BASE} ${line} ${W},${BASE}`;
  const slot = W / Math.max(1, points.length);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[170px]" role="img"
        aria-label={`Organizations taking part per year, peaking at ${num(maxO)}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={BASE - f * (BASE - 4)} y2={BASE - f * (BASE - 4)}
            style={{ stroke: "var(--color-liness)" }} strokeWidth={0.25} />
        ))}
        {points.map((p, i) => {
          const h = ((p.newcomers / maxN) * (BASE - 6));
          return (
            <rect key={`n${p.year}`} x={x(i) - slot * 0.22} y={BASE - h} width={slot * 0.44} height={Math.max(h, p.newcomers ? 0.5 : 0)}
              rx={0.4} style={{ fill: "var(--color-honey)", opacity: p.newcomers ? 0.5 : 0 }}>
              <title>{`${p.year}: ${num(p.newcomers)} organization${p.newcomers === 1 ? "" : "s"} appearing for the first time`}</title>
            </rect>
          );
        })}
        <polygon points={area} style={{ fill: "var(--color-accent)", opacity: 0.1 }} />
        <polyline points={line} fill="none" style={{ stroke: "var(--color-accent)" }} strokeWidth={0.7} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.year} cx={x(i)} cy={y(p.orgs, maxO)} r={0.9} style={{ fill: "var(--color-accent)" }}>
            <title>{`${p.year}: ${num(p.orgs)} organizations active`}</title>
          </circle>
        ))}
        <line x1="0" x2={W} y1={BASE} y2={BASE} style={{ stroke: "var(--color-line)" }} strokeWidth={0.3} />
      </svg>
      <div className="flex justify-between mt-2 font-mono text-[10px] text-dim">
        {points.filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1).map((p) => (
          <span key={p.year}>{p.year}</span>
        ))}
      </div>
      <p className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim mt-2.5">
        <i className="not-italic inline-block w-[9px] h-[9px] rounded-full mr-1.5 align-[-1px]" style={{ background: "var(--color-accent)" }} />
        organizations taking part
        <i className="not-italic inline-block w-[9px] h-[9px] rounded-sm ml-4 mr-1.5 align-[-1px]" style={{ background: "var(--color-honey)" }} />
        first appearance that year
      </p>
    </div>
  );
}

/* ── columns: projects credited to the organizations active each year ── */
function Columns({ points }: { points: { year: number; projects: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.projects));
  const slot = 100 / Math.max(1, points.length);
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-[130px]" role="img"
        aria-label={`Projects per year, highest ${num(max)}`}>
        {points.map((p, i) => {
          const h = (p.projects / max) * 36;
          return (
            <rect key={p.year} x={i * slot + slot * 0.16} y={38 - h} width={slot * 0.68} height={Math.max(h, p.projects ? 0.5 : 0)}
              rx={0.5} style={{ fill: "var(--color-denim)", opacity: p.projects ? 0.9 : 0.15 }}>
              <title>{`${p.year}: ${num(p.projects)} projects credited to organizations active that year`}</title>
            </rect>
          );
        })}
        <line x1="0" y1="38" x2="100" y2="38" style={{ stroke: "var(--color-line)" }} strokeWidth={0.3} />
      </svg>
      <div className="flex justify-between mt-2 font-mono text-[10px] text-dim">
        <span>{points[0]?.year ?? "—"}</span>
        <span>{points[points.length - 1]?.year ?? "—"}</span>
      </div>
    </div>
  );
}

/* ── pie: the mix of the window, drawn as one stroked ring per slice ── */
function Donut({ mix, center }: { mix: Slice[]; center: string }) {
  const R = 42, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 100 100" width={152} height={152} role="img" aria-label={`Mix chart, ${mix.length} groups`}>
        {mix.map((s, i) => {
          const len = Math.max(0, s.share) * C;
          const el = (
            <circle key={s.label} cx="50" cy="50" r={R} fill="none" strokeWidth={15}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 50 50)"
              style={{ stroke: HUE[i % HUE.length] }}>
              <title>{`${s.label}: ${num(s.value)} (${pc(s.share)})`}</title>
            </circle>
          );
          off += len;
          return el;
        })}
        <text x="50" y="53" textAnchor="middle" className="font-mono" fontSize="9" style={{ fill: "var(--color-dim)" }}>{center}</text>
      </svg>
      <ul className="grid gap-1.5 min-w-[180px] flex-1">
        {mix.map((s, i) => (
          <li key={s.label} className="flex items-baseline gap-2 text-[12.5px]">
            <i className="not-italic inline-block w-[8px] h-[8px] rounded-full shrink-0" style={{ background: HUE[i % HUE.length] }} />
            <span className="text-cocoa truncate">{s.label}</span>
            <span className="ml-auto font-mono text-[11px] text-dim shrink-0">{num(s.value)} · {pc(s.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OrgAnalytics() {
  const { ready, file } = useOrgStats();
  const rows = file.orgs;

  const [range, setRange] = useState<RangeKey>("5y");
  const [sort, setSort] = useState<RankBy>("projects");
  const [mixDim, setMixDim] = useState<"sector" | "stack">("sector");
  const [focus, setFocus] = useState<string | null>(null);

  const years = useMemo(() => rangeYears(rows, range), [rows, range]);
  const prev = useMemo(() => priorYears(years), [years]);
  const points = useMemo(() => yearSeries(rows, years), [rows, years]);
  const slices = useMemo(() => orgSlices(rows, years), [rows, years]);
  const ranked = useMemo(() => topOrgs(slices, 12, sort), [slices, sort]);
  const cmp = useMemo(() => compare(rows, years, prev), [rows, years, prev]);
  const win = useMemo(() => statsFor(rows, years), [rows, years]);
  const mix = useMemo(
    () => (mixDim === "sector" ? sectorMix(slices) : techMix(slices, rows)),
    [mixDim, slices, rows],
  );
  const detail = useMemo(() => orgDetail(rows, focus ?? ranked[0]?.key ?? "", years), [rows, focus, ranked, years]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-[1160px] px-4 md:px-7 py-6 md:py-9">
        <DashHead title="Organization analytics" sub="Reading the organization archive…" />
        <Card className="p-5 md:p-6 mt-6"><div className="h-[300px] animate-pulse rounded-[12px] bg-clay" /></Card>
      </div>
    );
  }

  const span = years.length ? `${years[0]} - ${years[years.length - 1]}` : "no years";
  const download = () =>
    exportToCsv(
      topOrgs(slices, slices.length, sort),
      [
        { header: "Organization", accessor: (s: OrgSlice) => s.name },
        { header: "GitHub", accessor: (s: OrgSlice) => s.login ?? "" },
        { header: "Sector", accessor: (s: OrgSlice) => s.sector },
        { header: "Programs", accessor: (s: OrgSlice) => s.programs },
        { header: "Projects", accessor: (s: OrgSlice) => s.projects },
        { header: "Stars", accessor: (s: OrgSlice) => s.stars },
        { header: "Forks repos", accessor: (s: OrgSlice) => s.repos },
        { header: "Open issues", accessor: (s: OrgSlice) => s.issues },
        { header: "Seasons in window", accessor: (s: OrgSlice) => s.active.length },
        { header: "First season", accessor: (s: OrgSlice) => s.first },
        { header: "In window", accessor: (s: OrgSlice) => (s.isNew ? "new" : "returning") },
        { header: "Window", accessor: () => span },
      ],
      `cyrus-org-analytics-${span.replace(/[^0-9]+/g, "-")}.csv`,
    );

  return (
    <div className="mx-auto max-w-[1160px] px-4 md:px-7 py-6 md:py-9">
      <DashHead
        title="Organization analytics"
        tag="ORG BOARD"
        sub="Engagement across every organization in the archive: who takes part, who joined, what they carry and how the window you pick compares with the one before it."
        action={
          <button type="button" onClick={download} className={btn("outline", "sm")} disabled={!slices.length}>
            <Ic d={DP.download} size={13} /> Export CSV
          </button>
        }
      />

      {/* time range + what the window says */}
      <div className="flex flex-wrap items-center gap-2 mt-6">
        <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mr-1">Time range</span>
        {RANGES.map((r) => {
          const on = range === r.key;
          return (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} aria-pressed={on}
              className={`font-mono text-[10px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${on ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
              {r.label}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-dim">{span}</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
        <Change now={cmp.orgs.now} before={cmp.orgs.before} pct={cmp.orgs.pct} one="Organizations" />
        <Change now={cmp.newcomers.now} before={cmp.newcomers.before} pct={cmp.newcomers.pct} one="New in window" />
        <Change now={cmp.projects.now} before={cmp.projects.before} pct={cmp.projects.pct} one="Projects" />
        <Change now={cmp.stars.now} before={cmp.stars.before} pct={cmp.stars.pct} one="GitHub stars" />
        <Change now={cmp.issues.now} before={cmp.issues.before} pct={cmp.issues.pct} one="Open issues" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-5 md:p-6">
          <h2 className="panel-h text-[17px]">Participation over time</h2>
          <p className="text-cocoa text-[12.5px] mt-1 mb-4">
            Each point is one year of the archive: organizations that took part, and the ones the archive had never seen before.
          </p>
          <Trend points={points} />
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="panel-h text-[17px]">Projects per season</h2>
          <p className="text-cocoa text-[12.5px] mt-1 mb-4">
            Mentored projects credited to the organizations active in each year, across every program we track.
          </p>
          <Columns points={points} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* top performers - clicking a row drills into that organization */}
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="panel-h text-[17px]">Top organizations</h2>
            <div className="ml-auto flex gap-1.5">
              {SORTS.map((s) => (
                <button key={s.key} type="button" onClick={() => setSort(s.key)} aria-pressed={sort === s.key}
                  className={`font-mono text-[9.5px] uppercase tracking-[.1em] rounded-full px-2.5 py-[6px] border transition-colors cursor-pointer ${sort === s.key ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-cocoa text-[12.5px] mb-4">Ranked inside {span}. Pick one to open its own record below.</p>
          {ranked.length ? (
            <div className="grid gap-2.5">
              {ranked.map((s) => {
                const on = (focus ?? ranked[0]?.key) === s.key;
                const max = ranked[0][sort] || 1;
                return (
                  <button key={s.key} type="button" onClick={() => setFocus(s.key)} aria-pressed={on}
                    className="block text-left group cursor-pointer">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`text-[13px] font-semibold truncate ${on ? "text-accent" : "text-ink group-hover:text-accent transition-colors"}`}>
                        {s.name}
                        {s.isNew && <span className="ml-2 font-mono text-[9px] uppercase tracking-[.1em] text-honey">new</span>}
                      </span>
                      <span className="font-mono text-[11.5px] text-cocoa shrink-0">{compact(s[sort])}</span>
                    </div>
                    <div className="h-[6px] mt-1.5 rounded-full bg-clay overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, (s[sort] / max) * 100)}%`, background: on ? "var(--color-accent)" : "var(--color-rule)" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-cocoa text-[13.5px] py-8 text-center">No organization record falls in that range.</p>
          )}
        </Card>

        {/* the pie */}
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="panel-h text-[17px]">What they work on</h2>
            <div className="ml-auto flex gap-1.5">
              {(["sector", "stack"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setMixDim(k)} aria-pressed={mixDim === k}
                  className={`font-mono text-[9.5px] uppercase tracking-[.1em] rounded-full px-2.5 py-[6px] border transition-colors cursor-pointer ${mixDim === k ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                  {k === "sector" ? "Sector" : "Stack tags"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-cocoa text-[12.5px] mb-4">
            {mixDim === "sector" ? "Share of the window's projects by sector." : "How many organizations in the window carry each tag."}
          </p>
          {mix.length ? <Donut mix={mix} center={`${slices.length} orgs`} /> : (
            <p className="text-cocoa text-[13.5px] py-8 text-center">Nothing to split in that range.</p>
          )}
        </Card>
      </div>

      {/* project-level view of one organization */}
      {detail && (
        <Card className="p-5 md:p-6 mt-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-[20px] tracking-[-.02em]">{detail.slice.name}</h2>
              <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mt-1">
                {detail.slice.sector} · #{detail.rank} of {detail.of} in {span} · first season {detail.slice.first}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {detail.slice.login && (
                <>
                  <Link to={`/organizations/${detail.slice.login}`} className={btn("outline", "sm")}>Profile</Link>
                  <a href={`https://github.com/${detail.slice.login}`} target="_blank" rel="noopener" className={btn("ghost", "sm")}>GitHub</a>
                </>
              )}
              <button type="button" onClick={() => exportRow(detail.slice)} className={btn("ghost", "sm")}>
                <Ic d={DP.download} size={13} /> CSV
              </button>
            </div>
          </div>

          <div className="mt-5">
            <StatRow items={[
              ["Projects", num(detail.slice.projects)],
              ["Stars", num(detail.slice.stars)],
              ["Repositories", num(detail.slice.repos)],
              ["Open issues", num(detail.slice.issues)],
              ["Programs", num(detail.slice.programs)],
              ["Seasons in window", `${detail.slice.active.length} of ${years.length}`],
            ]} />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-3">Programs it mentors</h3>
              {detail.programs.length ? (
                <div className="grid gap-2">
                  {detail.programs.map((p) => {
                    const max = Math.max(...detail.programs.map((x) => x.projects)) || 1;
                    return (
                      <div key={p.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <code className="font-mono text-[12px] text-ink uppercase">{p.id}</code>
                          <span className="font-mono text-[11px] text-cocoa">{num(p.projects)}</span>
                        </div>
                        <div className="h-[5px] mt-1 rounded-full bg-clay overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(p.projects / max) * 100}%`, background: "var(--color-denim)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-cocoa text-[13px]">The archive names no program split for this organization.</p>}
            </div>

            <div>
              <h3 className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-3">Seasons</h3>
              <div className="flex flex-wrap gap-1.5">
                {knownSeasons(detail.active, years).map((y) => (
                  <span key={y.year} title={y.note}
                    className={`font-mono text-[10.5px] rounded-md px-2 py-[5px] border ${
                      y.in ? "border-accent/40 bg-peach text-accent font-bold" : y.gap ? "border-line bg-cream text-honey" : "border-line bg-cream text-dim"}`}>
                    {y.year}
                  </span>
                ))}
              </div>
              <p className="text-cocoa text-[12.5px] mt-3 leading-[1.7]">
                {detail.gaps.length
                  ? <>Sat out {detail.gaps.slice(0, 6).join(", ")}{detail.gaps.length > 6 ? " and later years" : ""} between its first and last season.</>
                  : "An unbroken run from its first season to its last."}
              </p>
            </div>
          </div>
        </Card>
      )}

      <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-[1.8] mt-6">
        Source: <code className="text-cocoa">/data/org-stats.json</code>, regenerated from the program archives by
        <code className="text-cocoa"> scripts/org-stats.mjs</code> - {num(win.orgs)} organizations, {num(file.stats.orgs)} records in
        total. Projects, stars and issues are lifetime figures for the organizations inside the window, not activity that happened
        only in it. Page views and live visitors need traffic storage this deployment does not have, so the board reports what the
        archive can prove instead of estimating the rest.
      </p>
    </div>
  );

  function exportRow(s: OrgSlice) {
    exportToCsv([s], [
      { header: "Organization", accessor: (x: OrgSlice) => x.name },
      { header: "Seasons", accessor: (x: OrgSlice) => x.active.join(" ") },
      { header: "Projects", accessor: (x: OrgSlice) => x.projects },
      { header: "Stars", accessor: (x: OrgSlice) => x.stars },
      { header: "Open issues", accessor: (x: OrgSlice) => x.issues },
    ], `cyrus-${s.key}.csv`);
  }
}

/** the year strip around a focus row: in-window, absent between seasons, or outside both */
function knownSeasons(active: number[], years: number[]) {
  const lo = Math.min(...active, ...years);
  const hi = Math.max(...active, ...years);
  const out: { year: number; in: boolean; gap: boolean; note: string }[] = [];
  for (let y = lo; y <= hi; y++) {
    const inWin = years.includes(y);
    const gap = inWin && !active.includes(y);
    out.push({
      year: y, in: inWin && active.includes(y), gap,
      note: active.includes(y) ? (inWin ? "took part, inside the window" : "took part, outside the window") : inWin ? "sat this season out" : "outside the window",
    });
  }
  return out;
}
