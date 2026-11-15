"use client"
/* ══ demand.tsx — Demand radar ══════════════════════════════════════
   Five years of accepted projects, read for what they actually asked
   for. The archives for GSoC, LFX, Outreachy and Summer of Bitcoin carry
   the skill tags each organizer wrote on every project they took; this
   folds them into named technologies and counts real projects, so the
   answer to "is there demand for Rust here" is a number you can check
   rather than an opinion. Coverage is reported, not hidden.         ══ */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { buildDemand, pulse, type ArchRow } from "../demand";
import { fmtCompact } from "../util";
import { btn } from "../../components/ui";
import { Card, DashHead, Ic } from "./shell";
import { DP } from "./shared";
import type { Dash } from "./useDash";

const PROGRAMS_IN = ["GSoC", "LFX", "Outreachy", "Summer of Bitcoin"] as const;
const OWN = ["All four archives", ...PROGRAMS_IN];

const MON = "font-mono text-[9px] uppercase tracking-[.14em] text-dim";

function Spark({ byYear, years, max }: { byYear: Record<number, number>; years: number[]; max: number }) {
  return (
    <span className="flex items-end gap-[3px] h-[26px]" aria-hidden>
      {years.map((y) => {
        const n = byYear[y] ?? 0;
        return <i key={y} className="not-italic block w-[9px] rounded-t-[2px]"
          style={{ height: `${Math.max(2, (n / max) * 100)}%`, background: n ? "var(--color-accent)" : "var(--color-line)" }} />;
      })}
    </span>
  );
}

export function DemandSection({ d }: { d: Dash }) {
  const [rows, setRows] = useState<ArchRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [prog, setProg] = useState(0);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/data/gsoc-projects.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/data/otherProjects.json").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([g, o]) => {
        if (!live) return;
        const gsoc: ArchRow[] = (g?.projects ?? []).map((p: ArchRow) => ({ ...p, program: "GSoC" }));
        const other: ArchRow[] = o?.projects ?? [];
        setRows([...gsoc, ...other]);
      })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  const scoped = useMemo(() => {
    if (!rows) return null;
    return prog === 0 ? rows : rows.filter((r) => (r.program ?? "GSoC") === OWN[prog]);
  }, [rows, prog]);

  const idx = useMemo(() => (scoped ? buildDemand(scoped) : null), [scoped]);

  const list = useMemo(() => {
    if (!idx) return [];
    const needle = q.trim().toLowerCase();
    return needle ? idx.techs.filter((t) => t.tech.toLowerCase().includes(needle)) : idx.techs;
  }, [idx, q]);

  const detail = useMemo(() => (idx && pick ? idx.techs.find((t) => t.tech === pick) ?? null : null), [idx, pick]);
  const movers = useMemo(() => {
    if (!idx || idx.years.length < 2) return { up: [], down: [] };
    const scored = idx.techs.filter((t) => t.projects >= 25)
      .map((t) => ({ t, ...pulse(t, idx.years, idx.yearTotals) }));
    const byDelta = [...scored].sort((a, b) => b.delta - a.delta);
    return { up: byDelta.slice(0, 4), down: byDelta.slice(-4).filter((x) => x.delta < 0).reverse() };
  }, [idx]);

  if (failed) {
    return (
      <Card>
        <DashHead title="Demand radar" sub="The archive files did not load." />
        <p className="text-[13.5px] text-cocoa mt-3">The two project archives are static files in this site, so a failed read is a network or deployment problem, not missing data. Reload the page; if it keeps failing the archive is not in the build.</p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <DashHead title="Demand radar"
          sub={idx ? `${fmtCompact(idx.projects)} accepted projects, ${fmtCompact(idx.tags)} organizer skill tags folded into ${idx.techs.length} named technologies.` : "Reading the five-year archives."} />
        <div className="flex flex-wrap gap-1.5 mt-5" role="group" aria-label="Which archive to read">
          {OWN.map((label, i) => (
            <button key={label} type="button" onClick={() => { setProg(i); setPick(null); }} aria-pressed={prog === i}
              className={`font-mono text-[10px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${prog === i ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
              {label}
            </button>
          ))}
        </div>
        {idx && (
          <p className={`${MON} mt-4 leading-[1.8]`}>
            {fmtCompact(idx.matched)} of {fmtCompact(idx.tags)} tags named a technology we could fold ({Math.round((idx.matched / idx.tags) * 100)}%).
            The other {fmtCompact(idx.unmatched)} are soft skills, project-specific tooling or typos, and are left out of every count below.
            A project counts once per technology, no matter how many tags mention it.
          </p>
        )}
      </Card>

      {!idx ? (
        <Card><div className="grid gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[38px] rounded-[10px] border border-line bg-cream/40 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />)}</div></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-3 flex-wrap px-4 md:px-5 py-3.5 border-b border-line bg-sand">
            <h2 className="panel-h text-[15.5px]">Technologies, by projects that asked for them</h2>
            <div className="relative ml-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"><Ic d={DP.search} size={13} /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter - rust, security, docs…" aria-label="Filter technologies"
                className="w-[200px] max-[520px]:w-full bg-card border border-line rounded-[9px] pl-8 pr-3 py-2 text-[12.5px] outline-none focus:border-accent/60 transition-colors" />
            </div>
            <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">{idx.years[0]}-{idx.years[idx.years.length - 1]}</span>
          </div>

          {/* five columns do not fit a phone, so the table scrolls sideways inside the card */}
          <div className="max-h-[420px] overflow-y-auto overflow-x-auto panel-scroll">
            <table className="w-full min-w-[560px] border-collapse">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-line">
                  <th className={`${MON} text-left font-medium py-2.5 px-4 md:px-5`}>Technology</th>
                  <th className={`${MON} text-right font-medium py-2.5`}>Projects</th>
                  <th className={`${MON} text-right font-medium py-2.5`}>Share</th>
                  <th className={`${MON} text-left font-medium py-2.5 pl-4`}>By cycle</th>
                  <th className={`${MON} text-right font-medium py-2.5 px-4 md:px-5`}>Share trend</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 60).map((t) => {
                  const p = pulse(t, idx.years, idx.yearTotals);
                  const max = Math.max(...idx.years.map((y) => t.byYear[y] ?? 0), 1);
                  return (
                    <tr key={t.tech} onClick={() => setPick(pick === t.tech ? null : t.tech)}
                      className={`border-b border-liness last:border-0 cursor-pointer transition-colors ${pick === t.tech ? "bg-peach" : "hover:bg-cream"}`}>
                      <td className="py-2.5 px-4 md:px-5 text-[13px] font-semibold text-ink">{t.tech}</td>
                      <td className="text-right font-mono text-[12.5px] text-cocoa tabular-nums">{fmtCompact(t.projects)}</td>
                      <td className="text-right font-mono text-[11px] text-dim tabular-nums">{((t.projects / idx.projects) * 100).toFixed(1)}%</td>
                      <td className="py-2.5 pl-4"><Spark byYear={t.byYear} years={idx.years} max={max} /></td>
                      <td className={`py-2.5 px-4 md:px-5 text-right font-mono text-[11.5px] tabular-nums ${p.delta > 0 ? "text-leaf" : p.delta < 0 ? "text-rust" : "text-dim"}`}>
                        {p.delta > 0 ? `+${p.delta}` : p.delta} pts
                      </td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={5} className="py-8 text-center text-[13.5px] text-dim">Nothing in the archive spells that tag.</td></tr>}
              </tbody>
            </table>
          </div>
          {list.length > 60 && (
            <p className="px-4 md:px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-[.12em] text-dim border-t border-line">
              Showing the top 60 of {list.length}. Type to narrow it.
            </p>
          )}
        </Card>
      )}

      {detail && (
        <Card>
          <div className="flex items-end gap-3 flex-wrap">
            <h2 className="panel-h text-[17px]">{detail.tech} in this archive</h2>
            <button type="button" onClick={() => setPick(null)} className="ml-auto font-mono text-[10px] uppercase tracking-[.1em] text-dim hover:text-accent cursor-pointer" aria-label="Close the technology detail">
              <Ic d={DP.x} size={12} /> close
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
            {[
              ["Projects", fmtCompact(detail.projects)],
              ["Cycles it appears in", String(Object.keys(detail.byYear).length)],
              ["Top cycle", (() => { const y = Object.entries(detail.byYear).sort((a, b) => b[1] - a[1])[0]; return y ? `${y[0]} · ${y[1]}` : "-"; })()],
              ["Share of the archive", `${((detail.projects / (idx?.projects ?? 1)) * 100).toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[10px] border border-line bg-cream px-3.5 py-2.5">
                <b className={`${MON} block`}>{k}</b>
                <span className="block font-display font-extrabold text-[18px] tracking-[-.02em] mt-1">{v}</span>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            <div>
              <b className={`${MON} block mb-2`}>Per cycle</b>
              <ul className="grid gap-1.5 list-none">
                {idx!.years.map((y) => {
                  const n = detail.byYear[y] ?? 0;
                  const max = Math.max(...idx!.years.map((k) => detail.byYear[k] ?? 0), 1);
                  return (
                    <li key={y} className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-dim w-[38px] shrink-0">{y}</span>
                      <span className="h-[8px] rounded-full bg-clay flex-1 overflow-hidden"><i className="not-italic block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: "linear-gradient(90deg, var(--color-accent), var(--color-ember))" }} /></span>
                      <span className="font-mono text-[11.5px] text-cocoa w-[36px] text-right tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <b className={`${MON} block mb-2`}>Organizations that asked for it</b>
              <ul className="grid gap-1.5 list-none">
                {detail.orgs.map((o) => (
                  <li key={o.name} className="flex items-center gap-2.5 text-[12.5px]">
                    <Link to={`/projects?prog=${encodeURIComponent(Object.keys(detail.byProgram)[0] ?? "GSoC")}`} className="text-ink hover:text-accent transition-colors truncate">{o.name}</Link>
                    <span className="ml-auto font-mono text-[10.5px] text-dim shrink-0">{o.n}</span>
                  </li>
                ))}
              </ul>
              <b className={`${MON} block mt-4 mb-2`}>Which archive</b>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(detail.byProgram).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <span key={k} className="font-mono text-[10px] rounded-full border border-line bg-cream px-2.5 py-1 text-cocoa">{k} · {fmtCompact(n)}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <Link to={`/issues?q=${encodeURIComponent(detail.tech.split(" & ")[0])}`} className={btn("primary", "sm")}>
              <Ic d={DP.search} size={13} /> Open issues asking for {detail.tech}
            </Link>
            <Link to={`/projects?prog=${encodeURIComponent(Object.keys(detail.byProgram)[0] ?? "GSoC")}`} className={btn("outline", "sm")}>See the accepted projects</Link>
          </div>
        </Card>
      )}

      {idx && (movers.up.length > 0 || movers.down.length > 0) && (
        <div className="grid md:grid-cols-2 gap-5">
          <Card>
            <h2 className="panel-h text-[15.5px] mb-1">Grew in the later cycles</h2>
            <p className="text-cocoa text-[12px] mb-3">Share of each cycle&apos;s accepted projects, back half against front half, for technologies named on at least 25 projects. A share, not a raw count, because the running cycle is always a smaller crawl than the settled ones behind it.</p>
            <ul className="grid gap-2 list-none">
              {movers.up.map((x) => (
                <li key={x.t.tech} className="flex items-center gap-3 py-1.5 border-b border-liness last:border-0">
                  <span className="text-[13px] font-semibold text-ink min-w-0 truncate">{x.t.tech}</span>
                  <span className="ml-auto font-mono text-[11px] text-dim shrink-0">{fmtCompact(x.t.projects)} total · {x.share}% now</span>
                  <span className="font-mono text-[11.5px] font-bold text-leaf shrink-0 w-[58px] text-right">+{x.delta} pts</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="panel-h text-[15.5px] mb-1">Quieted down</h2>
            <p className="text-cocoa text-[12px] mb-3">The same share arithmetic, other direction. A fall here is often a tag rename, not a dying language - check the per-cycle bars.</p>
            {movers.down.length ? (
              <ul className="grid gap-2 list-none">
                {movers.down.map((x) => (
                  <li key={x.t.tech} className="flex items-center gap-3 py-1.5 border-b border-liness last:border-0">
                    <span className="text-[13px] font-semibold text-ink min-w-0 truncate">{x.t.tech}</span>
                    <span className="ml-auto font-mono text-[11px] text-dim shrink-0">{fmtCompact(x.t.projects)} total · {x.share}% now</span>
                    <span className="font-mono text-[11.5px] font-bold text-rust shrink-0 w-[58px] text-right">{x.delta} pts</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-dim">No technology with real volume lost share between the two halves of this window.</p>}
          </Card>
        </div>
      )}

      <Card>
        <h2 className="panel-h text-[15.5px] mb-2">How to read this</h2>
        <p className="text-cocoa text-[13px] leading-[1.7]">
          Every row counts accepted projects, so demand here means &quot;an organizer chose a project that needed this and wrote the tag
          down&quot;. It is not a job market and it is not what contributors used - it is what the people funding the work asked for.
          The trend column is that count as a share of its own cycle, in percentage points, so a thin crawl of the running year moves the
          number the same way it moves the archive total.
          Outreachy and LFX rows carry fewer tags than GSoC rows, so switching archives changes the coverage line as well as the counts.
          {d.saved.length > 0 ? ` You follow ${d.saved.length} repositories; the issue finder filter is the live counterpart of this table.` : " The live counterpart is the issue finder, which counts open issues rather than accepted projects."}
        </p>
      </Card>
    </>
  );
}
