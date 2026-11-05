"use client"
/* ══ Programs.tsx — the program directory.
   All tracked mentored seasons as cards (status, stipend, window, scale),
   plus the five-year archive band: accepted-project counts pulled at
   runtime from the same /data/*.json files the /projects listing reads,
   so every cell is a real number and every cell deep-links into that
   listing with the program and year pre-filtered.

   The organization number on a card and in the band is the merged list that
   /programs/<id>/organizations opens: Contribo's organization record for that
   program folded over our own copy of its archive, name by name, by
   scripts/contribo-summary.mjs. The card's number and the page behind it are
   computed by the same code, so they cannot drift.                        ═ */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { PROGRAMS } from "../data/orgs";
import { avatarOf, fmtCompact } from "../lib/util";
import { useRosterIndex } from "../lib/programRoster";
import type { Evidence, RosterIndex } from "../lib/programRoster";
import { publishesAreas, useProgramStats } from "../lib/contriboOrgs";
import type { ProgramStats } from "../lib/contriboOrgs";
import { useProjectArchives } from "../lib/programProjects";
import type { ArchiveSummary } from "../lib/programProjects";
import { btn, Chip, OrgImg, Word } from "../components/ui";
import type { Program } from "../lib/types";

const W = "max-w-[1240px] mx-auto px-6";

/* The four programs whose full archives /projects reads directly (GSoC's
   5,238-row mirror and the LFX/Outreachy/Summer of Bitcoin file) get their
   season columns from those files. Every other program's row comes from its
   own shard under /data/program-projects/, listed by the index the build step
   writes - so a program with no published record shows "–" instead of a
   invented number. */
const BIG_ARCHIVE_LABEL: Record<string, string> = {
  gsoc: "GSoC", lfx: "LFX", outreachy: "Outreachy", sob: "Summer of Bitcoin",
};

const STATUS_FILTERS: [string, string][] = [
  ["all", "Everything"], ["live", "Live now"], ["upcoming", "Opening soon"], ["closed", "Closed this cycle"],
];

const STATUS_PILL: Record<Program["status"], string> = {
  live: "text-leaf border-leaf/40 bg-leaf/8",
  upcoming: "text-honey border-honey/45 bg-honey/8",
  closed: "text-dim border-line bg-cream",
};

const EVIDENCE_WORD: Record<Evidence, string> = {
  archive: "from its project archive", api: "from its open API",
  listing: "from its published list", topics: "from GitHub topics",
};

/* ── one program card ─────────────────────────────────────────── */
type RosterSlot = { orgs: number; projects: number; source: Evidence };

function ProgCard({ p, s, arc }: { p: Program; s?: ProgramStats; arc?: ArchiveSummary }) {
  const archived = arc?.filter;
  return (
    <article className="group bg-card border border-line rounded-[20px] overflow-hidden flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/45">
      <Link to={`/programs/${p.id}`} className="relative block aspect-[16/7] bg-clay">
        <OrgImg src={p.img} name={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <span className={`absolute top-3 left-3 font-mono text-[9.5px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full border backdrop-blur-[2px] ${STATUS_PILL[p.status]}`}>
          {p.status}
        </span>
      </Link>
      <div className="p-[18px] flex flex-col gap-2.5 flex-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <OrgImg src={avatarOf(p.owner, 64)} name={p.owner} className="w-7 h-7 rounded-[8px] object-cover bg-white border border-line shrink-0" />
          <h3 className="card-title text-[15.5px] truncate">{p.name}</h3>
        </div>
        <p className="text-cocoa text-[12.5px] leading-[1.55] line-clamp-2">{p.tag}</p>
        {/* one chip, the stipend. The org and project counts used to sit here as
            well, which turned the shelf into a wall of statistics and duplicated
            the record table below - both numbers now live on the program's own
            page and in its organization explorer. */}
        <div className="flex gap-1.5 flex-wrap">
          <Chip tone="green">{p.pay}</Chip>
        </div>
        <p className="font-mono text-[10px] tracking-[.09em] uppercase text-dim">{p.window}</p>
        <div className="flex items-center gap-3 mt-auto pt-3 border-t border-liness">
          <Link to={`/programs/${p.id}`} className="text-[12.5px] font-bold text-accent hover:text-rust transition-colors">Program page</Link>
          <Link to={s ? `/programs/${p.id}/organizations` : archived ? `/projects?prog=${encodeURIComponent(archived)}` : "/projects"}
            className="ml-auto text-[12px] font-semibold text-cocoa border-b border-dashed border-dim pb-0.5 hover:text-accent hover:border-accent transition-colors">
            {s ? "Organization list" : archived ? "Project archive" : "Related projects"}
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ── the participation record for all thirteen programs ─────── */
type YearGrid = Map<string, Map<number, number>>;

function ArchiveBand({ grid, loading, roster, idx, stats, arcs }: {
  grid: YearGrid | null; loading: boolean; roster: Record<string, RosterSlot>;
  idx: RosterIndex; stats: Record<string, ProgramStats>; arcs: Record<string, ArchiveSummary>;
}) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const byYear of grid?.values() ?? []) for (const y of byYear.keys()) set.add(y);
    for (const a of Object.values(arcs)) for (const y of Object.keys(a.byYear)) {
      const n = Number(y);
      if (n > 2000) set.add(n);
    }
    return [...set].sort((a, b) => b - a).slice(0, 6);
  }, [grid, arcs]);

  /** one program's season counts: the full mirror where we hold it, otherwise
      the rows its own shard carries */
  const byYearOf = (id: string): Map<number, number> => {
    const big = BIG_ARCHIVE_LABEL[id];
    if (big && grid?.get(big)) return grid.get(big)!;
    const m = new Map<number, number>();
    for (const [y, n] of Object.entries(arcs[id]?.byYear ?? {})) {
      const k = Number(y);
      if (k > 2000) m.set(k, n);
    }
    return m;
  };

  return (
    <section className="bg-card border border-line rounded-[22px] p-[22px] shadow-soft overflow-x-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="panel-h text-[18px]">The <Word>participation record</Word></h2>
          <p className="text-cocoa text-[12.5px] mt-1.5 max-w-[660px] leading-[1.6]">
            Every program we track, one row each. Pick a number to open that slice of the archive; the
            organization count opens that program's organization explorer. Where an organizer publishes
            nothing we can read, the row shows a dash instead of a guess.
          </p>
        </div>
        <Link to="/projects" className={btn("outline", "sm")}>Browse the whole archive</Link>
      </div>
      <table className="w-full border-collapse min-w-[680px]">
        <thead>
          <tr>
            <th className="text-left font-mono text-[9.5px] uppercase tracking-[.12em] text-dim pb-2.5 font-medium">Program</th>
            <th className="font-mono text-[9.5px] uppercase tracking-[.12em] text-accent pb-2.5 font-medium text-right">Orgs</th>
            {years.map((y) => (
              <th key={y} className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim pb-2.5 font-medium text-right">
                {loading ? "…" : y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROGRAMS.map((p) => {
            const arc = arcs[p.id];
            const name = BIG_ARCHIVE_LABEL[p.id] ?? arc?.filter;
            const byYear = byYearOf(p.id);
            const r = roster[p.id];
            const s = stats[p.id];
            const orgs = s?.orgs ?? r?.orgs;
            return (
              <tr key={p.id} className="border-t border-liness">
                <td className="py-2.5 pr-3">
                  <Link to={`/programs/${p.id}`} className="text-[13px] font-semibold text-ink hover:text-accent transition-colors">
                    {p.name}
                  </Link>
                </td>
                <td className="text-right py-2.5">
                  {orgs ? (
                    <Link to={s ? `/programs/${p.id}/organizations` : `/programs/${p.id}`}
                      title={publishesAreas(p.id) ? "Season of KDE groups its projects by area, so this counts areas, not host organizations"
                        : s ? "Organizations this program's record names - open the explorer for each one"
                        : r ? EVIDENCE_WORD[r.source] : ""}
                      className="font-mono text-[12.5px] font-bold text-accent hover:text-rust transition-colors tabular-nums">
                      {fmtCompact(orgs)}
                    </Link>
                  ) : <span className="font-mono text-[10px] uppercase tracking-[.08em] text-dim/70">none</span>}
                </td>
                {years.map((y) => {
                  const n = byYear.get(y) ?? 0;
                  return (
                    <td key={y} className="text-right py-2.5">
                      {n > 0 && name ? (
                        <Link to={`/projects?prog=${encodeURIComponent(name)}&year=${y}`}
                          className="font-mono text-[12.5px] text-cocoa hover:text-accent transition-colors tabular-nums">
                          {fmtCompact(n)}
                        </Link>
                      ) : <span className="font-mono text-[12.5px] text-dim/60">–</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="font-mono text-[10px] uppercase tracking-[.11em] text-dim mt-4 leading-[1.9]">
        {loading
          ? "Reading the archive…"
          : <>
            Each year column counts the rows in the browsable listing for that
            season. Every figure comes from the archive, API or
            published list the program itself puts out. Where a program's record is
            built from GitHub topics rather than an organizer list, the Orgs column
            counts the repositories in that season, not host organizations.
            {idx.generated ? <> Record built {idx.generated}.</> : null}
          </>}
      </p>
    </section>
  );
}

export default function Programs() {
  const [status, setStatus] = useState("all");
  const [grid, setGrid] = useState<YearGrid | null>(null);
  const rst = useRosterIndex();
  const cs = useProgramStats();
  const arc = useProjectArchives(PROGRAMS);

  useEffect(() => {
    let go = true;
    const bump = (rows: { program?: string; y: number }[], fallback: string) => {
      setGrid((prev) => {
        const next: YearGrid = new Map(prev);
        for (const r of rows) {
          const name = r.program ?? fallback;
          const byYear = next.get(name) ?? new Map<number, number>();
          byYear.set(r.y, (byYear.get(r.y) ?? 0) + 1);
          next.set(name, byYear);
        }
        return next;
      });
    };
    Promise.all([
      fetch("/data/gsoc-projects.json").then((r) => (r.ok ? r.json() : { projects: [] })),
      fetch("/data/otherProjects.json").then((r) => (r.ok ? r.json() : { projects: [] })),
    ])
      .then(([gsoc, other]) => {
        if (!go) return;
        // fold both files into one grid without clobbering each other
        setGrid(new Map());
        bump((gsoc.projects ?? []).map((p: { y: number }) => ({ ...p, program: "GSoC" })), "GSoC");
        bump(other.projects ?? [], "LFX");
      })
      .catch(() => { if (go) setGrid(new Map()); });
    return () => { go = false; };
  }, []);

  const list = useMemo(
    () => PROGRAMS.filter((p) => status === "all" || p.status === status),
    [status],
  );

  return (
    <div className={`${W} pt-14 pb-16`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span> <span className="text-cocoa">Programs</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Open source <Word>programs</Word>
      </h1>
      <p className="text-ink font-medium max-w-[680px] text-[16.5px] leading-[1.6]">
        Mentored seasons with real stipends and a public record. Filter by where you are in the
        calendar, then open a program for its organizations, its projects and its windows.
      </p>

      {/* status filter */}
      <div className="flex gap-2 flex-wrap mt-7" role="group" aria-label="Filter programs by status">
        {STATUS_FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)}
            className={`font-mono text-[10.5px] font-bold uppercase tracking-[.1em] px-3.5 py-2 rounded-full border transition-colors cursor-pointer ${
              status === v ? "bg-coffee text-foam border-coffee" : "bg-card text-cocoa border-line hover:border-accent/50 hover:text-accent"
            }`}>
            {l}
          </button>
        ))}
      </div>
      {!rst.ready && (
        <p className="font-mono text-[10.5px] uppercase tracking-[.11em] text-dim mt-3">Loading the participation record…</p>
      )}

      {/* the cards */}
      <h2 className="sr-only">Programs</h2>
      <div className="grid grid-cols-3 gap-5 mt-7 max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1">
        {list.map((p) => <ProgCard key={p.id} p={p} s={cs.byId[p.id]} arc={arc.summaries[p.id]} />)}
      </div>
      {list.length === 0 && (
        <p className="text-cocoa text-[14px] mt-10">Nothing in that bucket this cycle - try "Everything".</p>
      )}

      {/* five-year archive */}
      <div className="mt-14">
        <ArchiveBand grid={grid} loading={grid === null} roster={rst.byId} idx={rst} stats={cs.byId} arcs={arc.summaries} />
      </div>

      {/* close */}
      <section className="mt-14 bg-gradient-to-br from-clay to-peach/60 border border-line rounded-[22px] px-8 py-8 flex items-center gap-6 flex-wrap max-[700px]:px-5">
        <div className="min-w-[280px] flex-1">
          <h2 className="card-title-xl">Pick a season, then pick the issues</h2>
          <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2 max-w-[600px]">
            Programs decide the calendar; the work is still real repositories with open issues.
            The finder indexes tens of thousands of them, filterable down to one week of effort.
          </p>
        </div>
        <Link to="/issues" className={btn("primary", "lg") + " shrink-0"}>Open the issue finder</Link>
      </section>
    </div>
  );
}
