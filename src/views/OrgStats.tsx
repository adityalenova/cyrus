"use client"
/* ══ OrgStats.tsx — the statistics of every organization the programs name ═
   One row per distinct organization, folded across the participant records by
   scripts/org-stats.mjs: Contribo's organization list for a program over our
   own copy of that program's archive, then every row joined to every other row
   that carries the same name or the same GitHub account, then unioned with the
   profiles the directory tracks. That fold is the whole point of the page: the
   program pages each count their own list, and only a cross-program fold can
   say how many organizations there actually are, how many of them work with
   more than one program, and where the mentored work is concentrated.

   Nothing here is estimated. A row with no GitHub account shows no stars; a
   program that publishes repositories rather than host organizations is left
   out of the fold and named in the footnote; the chart bars are counts of rows
   in this file. Everything updates when the data is regenerated, not when this
   page is edited.                                                         ═ */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { PROGRAMS } from "../data/orgs";
import { useOrgStats, type OrgStatRow } from "../lib/orgStats";
import { avatarOf, fmtCompact } from "../lib/util";
import { btn, Chip, OrgImg, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";
const PAGE = 60;

/** the headline figures are exact counts of a generated file, so they are
 *  printed as exact numbers; `fmtCompact`'s rounding is for table cells. */
const exact = (n: number) => n.toLocaleString("en-US");

const LABEL: Record<string, string> = Object.fromEntries(PROGRAMS.map((p) => [p.id, p.name]));
const SHORT: Record<string, string> = {
  gsoc: "GSoC", outreachy: "Outreachy", lfx: "LFX", esoc: "ESOC", mlh: "MLH",
  gssoc: "GSSoC", kde: "Season of KDE", sob: "Summer of Bitcoin", nsoc: "NSOC",
  oct: "Hacktoberfest", "24pr": "24 Pull Requests", fossee: "FOSSEE", "vercel-oss": "Vercel OSS",
};
const TONE: Record<string, "blue" | "green" | "cat" | "purple"> = {
  gsoc: "blue", outreachy: "cat", lfx: "green", mlh: "purple", esoc: "green", kde: "blue", sob: "purple",
};

/* ── headline figures ──────────────────────────────────────── */
function Figure({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="bg-card border border-line rounded-[18px] p-5 shadow-soft">
      <p className="font-display font-extrabold text-[30px] leading-none tracking-[-.03em] text-ink tabular-nums">{n}</p>
      <p className="text-[13px] font-semibold text-cocoa mt-2">{label}</p>
      <p className="font-mono text-[10px] uppercase tracking-[.1em] text-dim mt-1">{sub}</p>
    </div>
  );
}

/* ── horizontal share bars ─────────────────────────────────── */
function Bars({ rows, unit }: { rows: [string, number][]; unit: string }) {
  const max = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <ul className="grid gap-2.5 list-none">
      {rows.map(([k, n], i) => (
        <li key={k} className="grid grid-cols-[minmax(0,132px)_1fr_46px] items-center gap-3">
          <span className="text-[12px] text-cocoa truncate" title={k}>{k}</span>
          <span className="h-[9px] rounded-full bg-cream overflow-hidden">
            <i className="grow-x block h-full rounded-full"
              style={{ width: `${Math.max(2, (n / max) * 100)}%`, background: i === 0 ? "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 55%, var(--color-denim)))" : "var(--color-denim)", opacity: 1 - i * 0.035, animationDelay: `${i * 40}ms` }} />
          </span>
          <b className="font-mono text-[11.5px] font-bold text-ink text-right tabular-nums">{fmtCompact(n)}</b>
        </li>
      ))}
      <li className="font-mono text-[10px] uppercase tracking-[.1em] text-dim pt-1">{unit}</li>
    </ul>
  );
}

/* ── the year column chart ─────────────────────────────────── */
function YearBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <div className="flex items-end gap-1.5 h-[132px]">
      {rows.map(([y, n], i) => (
        <div key={y} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full min-w-0" title={`${y}: ${fmtCompact(n)} organizations in the record`}>
          <span className="font-mono text-[9.5px] font-bold text-cocoa tabular-nums">{fmtCompact(n)}</span>
          <i className="w-full rounded-t-[5px] pulse-bar block"
            style={{ height: `${Math.max(5, (n / max) * 100)}%`, background: i === rows.length - 1 ? "linear-gradient(180deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 16%, var(--color-card)))" : "linear-gradient(180deg, var(--color-denim), color-mix(in srgb, var(--color-denim) 14%, var(--color-card)))", animationDelay: `${i * 45}ms` }} />
          <span className="font-mono text-[9.5px] text-dim">{y}</span>
        </div>
      ))}
    </div>
  );
}

/* ── the leaderboard ───────────────────────────────────────── */
function Leader({ rows }: { rows: OrgStatRow[] }) {
  const top = rows.slice(0, 12);
  return (
    <div className="bg-card border border-line rounded-[20px] shadow-soft overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-cream">
            {["#", "Organization", "Programs it hosted", "Projects", "Stars"].map((h, i) => (
              <th key={h} scope="col" className={`font-mono text-[9.5px] uppercase tracking-[.11em] text-dim font-bold py-2.5 px-3.5 ${i > 2 ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map((o, i) => (
            <tr key={o.key} className="border-t border-line hover:bg-cream/70 transition-colors">
              <td className="py-3 px-3.5 font-mono text-[11px] text-dim tabular-nums">{String(i + 1).padStart(2, "0")}</td>
              <td className="py-3 px-3.5">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-[30px] h-[30px] rounded-[9px] overflow-hidden shrink-0 bg-cream border border-line grid place-items-center">
                    <OrgImg src={o.logo || avatarOf(o.login || o.name, 60)} name={o.name} className="w-full h-full object-cover" />
                  </span>
                  <span className="min-w-0">
                    <b className="card-title text-[13.5px] block truncate">{o.name}</b>
                    {o.login && <span className="font-mono text-[9.5px] text-dim block truncate">@{o.login}</span>}
                  </span>
                </span>
              </td>
              <td className="py-3 px-3.5">
                <span className="flex gap-1.5 flex-wrap">
                  {o.programs.slice(0, 3).map((p) => (
                    <Link key={p.id} to={`/programs/${p.id}/organizations`} title={`${fmtCompact(p.projects)} accepted projects in ${LABEL[p.id] ?? p.id}`}>
                      <Chip tone={TONE[p.id] ?? "cat"}>{SHORT[p.id] ?? p.id}</Chip>
                    </Link>
                  ))}
                  {o.programs.length > 3 && <span className="font-mono text-[9.5px] text-dim self-center">+{o.programs.length - 3}</span>}
                </span>
              </td>
              <td className="py-3 px-3.5 text-right font-mono text-[12.5px] font-bold text-ink tabular-nums">{fmtCompact(o.projects)}</td>
              <td className="py-3 px-3.5 text-right font-mono text-[12px] text-honey font-bold tabular-nums">{o.stars ? fmtCompact(o.stars) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── one browsable organization card ───────────────────────── */
function Card({ o }: { o: OrgStatRow }) {
  return (
    <article className="bg-card border border-line rounded-[18px] p-[16px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="w-[38px] h-[38px] rounded-[11px] overflow-hidden shrink-0 bg-cream border border-line grid place-items-center">
          <OrgImg src={o.logo || avatarOf(o.login || o.name, 76)} name={o.name} className="w-full h-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="card-title text-[13.5px] block truncate">{o.name}</b>
          <span className="font-mono text-[9px] uppercase tracking-[.11em] text-dim block truncate mt-[3px]">{o.sector}</span>
        </div>
        {o.nprograms > 1 && (
          <span className="shrink-0 font-mono text-[9.5px] font-bold text-leaf bg-leaf/10 border border-leaf/30 rounded-full px-2 py-[3px]" title={`Named by ${o.nprograms} program records`}>
            {o.nprograms}x
          </span>
        )}
      </div>

      <p className="text-cocoa text-[12px] leading-[1.55] mt-2.5 line-clamp-2 min-h-[38px]">{o.desc || "No blurb in the record - counted here by what its programs published."}</p>

      <div className="flex items-center gap-2.5 flex-wrap mt-2.5 font-mono text-[10px] text-dim">
        <b className="text-accent font-bold">{fmtCompact(o.projects)}</b>
        <span>project{o.projects === 1 ? "" : "s"}</span>
        {o.stars > 0 && <span className="text-honey font-bold">★ {fmtCompact(o.stars)}</span>}
        {o.repos > 0 && <span>{fmtCompact(o.repos)} repos</span>}
      </div>

      <div className="flex gap-1.5 flex-wrap mt-2.5">
        {o.programs.slice(0, 4).map((p) => (
          <Link key={p.id} to={`/programs/${p.id}/organizations`}><Chip tone={TONE[p.id] ?? "cat"}>{SHORT[p.id] ?? p.id}</Chip></Link>
        ))}
      </div>

      <div className="mt-auto pt-3.5">
        {o.login
          ? <Link to={`/organizations/${o.login}`} className="font-semibold text-[12.5px] text-rust inline-flex items-center gap-1.5">
              View organization
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
            </Link>
          : <span className="font-mono text-[9px] uppercase tracking-[.1em] text-dim" title="No GitHub account could be confirmed for this organization, so it shows no stars or repositories.">program record only</span>}
      </div>
    </article>
  );
}

/* ── the page ──────────────────────────────────────────────── */
export default function OrgStats() {
  const { ready, file } = useOrgStats();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [prog, setProg] = useState("all");
  const [sort, setSort] = useState<"projects" | "stars" | "name">("projects");
  const [shown, setShown] = useState(PAGE);

  const s = file.stats;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = file.orgs;
    if (needle) out = out.filter((o) => (o.name + " " + o.desc + " " + (o.login ?? "")).toLowerCase().includes(needle));
    if (sector !== "all") out = out.filter((o) => o.sector === sector);
    if (prog !== "all") out = out.filter((o) => o.programs.some((p) => p.id === prog));
    if (sort === "name") return [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "stars") return [...out].sort((a, b) => b.stars - a.stars || b.projects - a.projects);
    return [...out].sort((a, b) => b.projects - a.projects || b.stars - a.stars);
  }, [file.orgs, q, sector, prog, sort]);

  const wall = useMemo(() => file.orgs.filter((o) => o.login).slice(0, 60), [file.orgs]);
  const fin = "bg-card border border-line rounded-xl px-3 py-2.5 text-[13px] text-ink outline-none transition-all focus:border-accent cursor-pointer";

  return (
    <>
      <header className="on-dark bg-coffee text-foam">
        <div className={`${W} py-12`}>
          <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-foam/55 mb-5">
            <Link to="/" className="hover:text-white">Home</Link> /{" "}
            <Link to="/organizations" className="hover:text-white">Organizations</Link> / <span className="text-foam/80">Statistics</span>
          </p>
          <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] text-[clamp(28px,3.8vw,46px)] text-white max-w-[860px]">
            Every organization across the programs, <Word>counted once</Word>.
          </h1>
          <p className="text-foam/70 mt-4 max-w-[720px] text-[14.5px] leading-[1.65]">
            {ready
              ? <>We fold each program's own participant record into one list: {exact(s.orgs)} distinct organizations,
                  {" "}{exact(s.projects)} accepted projects, {exact(s.inMany)} of them working with more than one program.
                  {" "}{exact(s.withLogin)} have a GitHub account we could confirm, and those cards carry live stars and repositories.</>
              : "Reading the folded participant records..."}
          </p>
          <div className="flex gap-2.5 mt-6 flex-wrap">
            <Link to="/organizations" className={btn("primary", "md")}>Browse the directory</Link>
            <Link to="/programs" className={btn("outline", "md", "bg-transparent! text-foam! border-white/25! hover:border-white/60!")}>All programs</Link>
          </div>
        </div>
      </header>

      <div className={`${W} pt-9 pb-16`}>
        {!ready && <p className="text-cocoa text-[13.5px]">Loading the statistics...</p>}

        {ready && (<>
          {/* ── headline figures ─────────────────────────────── */}
          <div className="grid grid-cols-5 gap-3.5 max-[1000px]:grid-cols-3 max-[620px]:grid-cols-2">
            <Figure n={exact(s.orgs)} label="Organizations" sub="folded across records" />
            <Figure n={exact(s.projects)} label="Accepted projects" sub="from the program archives" />
            <Figure n={exact(s.inMany)} label="In more than one" sub="same name or account" />
            <Figure n={exact(s.withLogin)} label="With a GitHub account" sub={`${exact(s.orgs - s.withLogin)} without`} />
            <Figure n={String(s.programs)} label="Program records folded" sub={`${PROGRAMS.length - s.programs} list projects, not hosts`} />
          </div>

          {/* ── charts ───────────────────────────────────────── */}
          <div className="grid grid-cols-[1.05fr_1fr] gap-4 mt-4 max-[980px]:grid-cols-1">
            <section className="bg-card border border-line rounded-[20px] p-[22px] shadow-soft">
              <h2 className="panel-h-lg">Where the <Word>work</Word> is</h2>
              <p className="text-cocoa text-[12.5px] leading-[1.6] mt-1.5 mb-5 max-w-[440px]">
                Each organization is placed in one field, read from the category its program published and the
                technologies it listed - never chosen by hand.
              </p>
              <Bars rows={s.sectors.slice(0, 12)} unit="organizations by field" />
            </section>

            <div className="grid gap-4">
              <section className="bg-card border border-line rounded-[20px] p-[22px] shadow-soft">
                <h2 className="panel-h-lg">Organizations in the record, by <Word>year</Word></h2>
                <p className="text-cocoa text-[12.5px] mt-1.5 mb-5">
                  Counting each organization once per season it took part in.
                </p>
                <YearBars rows={s.years} />
              </section>

              <section className="bg-card border border-line rounded-[20px] p-[22px] shadow-soft">
                <h2 className="panel-h-lg">How far the records <Word>overlap</Word></h2>
                <div className="flex items-end gap-2 mt-4">
                  {s.spread.filter(([n]) => n !== "0").map(([n, c]) => (
                    <div key={n} className="flex-1 bg-cream border border-line rounded-[14px] px-3 py-3.5 text-center">
                      <p className="font-display font-extrabold text-[22px] tracking-[-.02em] text-ink tabular-nums">{fmtCompact(c)}</p>
                      <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim mt-1">
                        {n === "1" ? "one program" : `${n} programs`}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-dim text-[11.5px] leading-[1.6] mt-3.5">
                  A row counted in two programs is one organization that hosted work in both, not two organizations.
                </p>
              </section>
            </div>
          </div>

          {/* ── leaderboard ──────────────────────────────────── */}
          <section className="mt-10">
            <h2 className="panel-h-lg mb-1.5">The organizations that host the <Word>most</Word> projects</h2>
            <p className="text-cocoa text-[12.5px] mb-5 max-w-[640px] leading-[1.6]">
              Ordered by accepted projects across every folded record. A program chip opens that program's own
              organization list with this host in it.
            </p>
            <Leader rows={file.orgs} />
          </section>

          {/* ── the logo wall ────────────────────────────────── */}
          <section className="mt-10">
            <h2 className="panel-h-lg mb-1.5">The <Word>marks</Word></h2>
            <p className="text-cocoa text-[12.5px] mb-5 max-w-[640px] leading-[1.6]">
              The first {fmtCompact(wall.length)} organizations by accepted projects that run a GitHub account - each image is
              the avatar that account publishes.
            </p>
            <div className="grid grid-cols-10 gap-2.5 max-[1100px]:grid-cols-8 max-[860px]:grid-cols-6 max-[560px]:grid-cols-4">
              {wall.map((o) => (
                <Link key={o.key} to={`/organizations/${o.login}`} title={`${o.name} - ${fmtCompact(o.projects)} projects`}
                  className="aspect-square bg-card border border-line rounded-[14px] grid place-items-center p-2.5 transition-all hover:-translate-y-1 hover:border-accent/50 hover:shadow-soft">
                  <OrgImg src={o.logo} name={o.login ?? o.name} className="w-full h-full object-contain" />
                </Link>
              ))}
            </div>
          </section>

          {/* ── technologies ─────────────────────────────────── */}
          <section className="mt-10 grid grid-cols-[1fr_1.05fr] gap-4 max-[980px]:grid-cols-1">
            <div className="bg-card border border-line rounded-[20px] p-[22px] shadow-soft">
              <h2 className="panel-h-lg mb-1.5">Stacks the organizations <Word>list</Word></h2>
              <p className="text-cocoa text-[12.5px] mb-4 leading-[1.6]">
                Counted from the technologies each program published for its hosts.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.techs.slice(0, 34).map(([t, n]) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-denim/25 bg-denim/6 text-denim px-2.5 py-[5px] font-mono text-[10.5px]">
                    {t}<b className="text-[9.5px] tabular-nums opacity-70">{fmtCompact(n)}</b>
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-card border border-line rounded-[20px] shadow-soft overflow-hidden">
              <div className="px-[22px] pt-5 pb-4">
                <h2 className="panel-h-lg">What each <Word>record</Word> contributes</h2>
                <p className="text-cocoa text-[12.5px] mt-1.5">Only the programs that publish a host-organization list are folded in.</p>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-cream border-y border-line">
                    {["Program", "Organizations", "Projects"].map((h, i) => (
                      <th key={h} scope="col" className={`font-mono text-[9.5px] uppercase tracking-[.11em] text-dim font-bold py-2.5 px-3.5 ${i ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(s.perProgram).map(([id, v]) => (
                    <tr key={id} className="border-b border-line last:border-b-0 hover:bg-cream/70 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <Link to={`/programs/${id}/organizations`} className="text-[13px] font-semibold text-ink hover:text-accent transition-colors">
                          {LABEL[id] ?? SHORT[id] ?? id}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-[12.5px] font-bold text-accent tabular-nums">{fmtCompact(v.orgs)}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-[12px] text-cocoa tabular-nums">{fmtCompact(v.projects)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── browse every folded organization ─────────────── */}
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="panel-h-lg">Browse the <Word>folded</Word> list</h2>
                <p className="text-cocoa text-[12.5px] mt-1.5">Search {exact(s.orgs)} organizations, or filter to a field or a program.</p>
              </div>
              <div className="flex gap-2.5 flex-wrap items-center">
                <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search organizations"
                  aria-label="Search organizations" className="bg-card border border-line rounded-xl px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-accent w-[220px]" />
                <select className={fin} value={sector} onChange={(e) => { setSector(e.target.value); setShown(PAGE); }} aria-label="Field">
                  <option value="all">All fields</option>
                  {s.sectors.map(([k, n]) => <option key={k} value={k}>{k} ({fmtCompact(n)})</option>)}
                </select>
                <select className={fin} value={prog} onChange={(e) => { setProg(e.target.value); setShown(PAGE); }} aria-label="Program">
                  <option value="all">Any program</option>
                  {Object.entries(s.programCounts).map(([id, n]) => <option key={id} value={id}>{LABEL[id] ?? id} ({fmtCompact(n)})</option>)}
                </select>
                <select className={fin} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
                  <option value="projects">Most projects</option>
                  <option value="stars">Most stars</option>
                  <option value="name">A to Z</option>
                </select>
              </div>
            </div>

            <p className="font-mono text-[10.5px] uppercase tracking-[.12em] text-dim mb-4" aria-live="polite">
              Showing {fmtCompact(Math.min(shown, rows.length))} of {fmtCompact(rows.length)} organizations
            </p>

            {rows.length ? (
              <>
                <div className="grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-3 max-[840px]:grid-cols-2 max-[540px]:grid-cols-1">
                  {rows.slice(0, shown).map((o) => <Card key={o.key} o={o} />)}
                </div>
                {rows.length > shown && (
                  <div className="flex justify-center mt-7">
                    <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className={btn("outline", "md")}>
                      Show more organizations · {fmtCompact(rows.length - shown)} left
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-card border border-line rounded-[20px] p-10 text-center text-dim">
                No organization matches. <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={() => { setQ(""); setSector("all"); setProg("all"); }}>Clear the filters</button>
              </div>
            )}
          </section>

        </>)}
      </div>
    </>
  );
}
