"use client"
/* ══ Organizations.tsx — searchable org directory + programs ═ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { ORGS, PROGRAMS } from "../data/orgs";
import { programsOf } from "../data/programAssoc";
import { REAL_ORGS } from "../data/realOrgs";
import { ROSTER, ROSTER_LABEL, ROSTER_STATS } from "../data/rosterOrgs";
import { sectorOf } from "../lib/orgTaxonomy";
import { CLASSIFIED, SECTOR_FACETS, TECH_COUNTS, TECH_FACETS } from "../lib/orgClasses";
import { avatarOf, byStars, fmt } from "../lib/util";
import type { Org } from "../lib/types";
import { useStore } from "../lib/store";
import { btn, Chip, OrgImg, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";

/* the directory now carries the whole confirmed roster, so it paginates */
const PAGE = 48;

/* ── page head ─────────────────────────────────────────────── */
function PageHead() {
  return (
    <header className={`${W} pt-14 pb-2`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Home</Link> / <span className="text-cocoa">Organizations</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Find your <Word>people.</Word> Then your<br />first good issue.
      </h1>
      <p className="text-ink font-medium max-w-[600px] text-[16.5px] leading-[1.6]">
        {ORGS.length} open-source organizations, each one named by a program's own record.
        Filter by field or technology; stars, repositories and issues are read live from GitHub.
      </p>
      <p className="mt-3.5">
        <Link to="/organizations/stats" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-rust">
          The statistics across every program's record
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
        </Link>
      </p>
    </header>
  );
}

/* ── featured-org rail ─────────────────────────────────────── */
function PillRail() {
  const top = useMemo(() => [...ORGS].sort(byStars).slice(0, 14), []);
  const slide = (o: Org) => (
    <Link key={o.login} to={`/organizations/${o.login}`}
      className="flex none shrink-0 inline-flex items-center gap-2.5 py-2 pl-2.5 pr-4 bg-card border border-line rounded-full text-[13px] font-semibold text-cocoa transition-all hover:border-accent hover:text-rust hover:-translate-y-0.5">
      <OrgImg src={avatarOf(o.login, 52)} name={o.login} className="w-[26px] h-[26px] rounded-full object-cover bg-clay" />
      {o.login}
      <span className="font-mono text-[10.5px] text-honey font-bold">★ {fmt(o.stars)}</span>
    </Link>
  );
  return (
    <div className="marq-mask overflow-hidden mt-6">
      <div className="marq-track animate-marq-slow">{top.map(slide)}{top.map(slide)}</div>
    </div>
  );
}

/* ── one technology chip, the same spelling the explorer uses ─ */
const TechChip = ({ t }: { t: string }) => (
  <span className="font-mono text-[9.5px] rounded-full border border-denim/25 bg-denim/6 text-denim px-2 py-[3px]">{t}</span>
);

const Bookmark = ({ on }: { on: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
    <path d="M6 4h12v16l-6-4-6 4z" />
  </svg>
);

/* ── org card ──────────────────────────────────────────────── */
function OrgCard({ org, sector, techs }: { org: Org; sector: string; techs: string[] }) {
  const { savedOrgs, toggleSavedOrg, toast } = useStore();
  const on = savedOrgs.includes(org.login);
  const progs = programsOf(org.login);
  return (
    <article className="group bg-card border border-line rounded-[18px] p-[18px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-[44px] h-[44px] rounded-[13px] overflow-hidden shrink-0 bg-cream border border-line grid place-items-center">
          <OrgImg src={avatarOf(org.login, 88)} name={org.login} className="w-full h-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="card-title text-[14.5px] block truncate">{org.name}</b>
          <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim block truncate mt-[3px]">{sector}</span>
        </div>
        <button type="button" onClick={() => {
          const added = toggleSavedOrg(org.login);
          toast(added ? `Saved ${org.login} - see your dashboard` : `Removed ${org.login}`);
        }} aria-pressed={on} title={on ? "Remove from your watchlist" : "Save to your watchlist"} aria-label={on ? `Unsave ${org.login}` : `Save ${org.login}`}
          className={`h-8 px-2.5 shrink-0 grid place-items-center rounded-[9px] border transition-colors ${on ? "bg-peach border-accent/45 text-rust" : "border-line text-dim hover:text-cocoa hover:border-accent/50"}`}>
          <Bookmark on={on} />
        </button>
      </div>

      <p className="text-cocoa text-[12.5px] leading-[1.6] mt-3 line-clamp-3 min-h-[58px]">{org.tagline}</p>

      <div className="flex items-center gap-2.5 flex-wrap mt-3 font-mono text-[10px] text-dim">
        <span className="text-honey font-bold">★ {fmt(org.stars)}</span>
        <span>{fmt(org.repos)} repos</span>
        <span>{fmt(org.issues)} open issues</span>
      </div>

      {progs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center mt-3" aria-label="Programs this organization runs">
          <span className="font-mono text-[9px] uppercase tracking-[.11em] text-dim">runs</span>
          {progs.map((a) => (
            <Link key={a.id} to={`/programs/${a.id}`} title={`${fmt(a.n)} ${a.unit === "project" ? "accepted projects" : "tracked repos"} recorded`}>
              <Chip tone={a.tone}>{a.label}</Chip>
            </Link>
          ))}
        </div>
      )}

      {techs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {techs.slice(0, 5).map((t) => <TechChip key={t} t={t} />)}
          {techs.length > 5 && <span className="font-mono text-[9.5px] text-dim py-[3px]">+{techs.length - 5}</span>}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link to={`/organizations/${org.login}`} className="font-semibold text-[12.5px] text-rust inline-flex items-center gap-1.5 group">
          View organization
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
        </Link>
      </div>
    </article>
  );
}

/* ── the rest of the program roster ───────────────────────────
   The cards above need a GitHub account we could confirm, because every number
   on them is GitHub's. The rest of the archives' organizations appear here:
   the same organization, named and counted by the program that accepted its
   projects, with no invented stars. */
const ROSTER_TONE: Record<string, "blue" | "green" | "cat" | "purple"> = {
  gsoc: "blue", lfx: "green", outreachy: "cat", sob: "purple",
};
const BAND = 24;

/** GitHub's own numbers, for the roster entries that hold a confirmed account. */
const GITHUB_BY_LOGIN = new Map(REAL_ORGS.map((o) => [o.login.toLowerCase(), o]));

function RosterBand() {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(BAND);
  const profiles = useMemo(() => new Set(ORGS.map((o) => o.login.toLowerCase())), []);
  const rest = useMemo(() => ROSTER.filter((r) => !r.login || !profiles.has(r.login.toLowerCase())), [profiles]);
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? rest.filter((r) => r.name.toLowerCase().includes(n) || r.category.toLowerCase().includes(n)) : rest;
  }, [rest, q]);

  const card = (r: (typeof ROSTER)[number]) => {
    const gh = r.login ? GITHUB_BY_LOGIN.get(r.login.toLowerCase()) : undefined;
    const sector = sectorOf(r.category, r.name);
    const span = (p: (typeof r.programs)[number]) => `${p.years[0]}${p.years.length > 1 ? `-${p.years[p.years.length - 1]}` : ""}`;
    return (
      <article key={r.name} className="bg-card border border-line rounded-[18px] p-[16px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-[38px] h-[38px] rounded-[11px] overflow-hidden shrink-0 bg-cream border border-line grid place-items-center">
            {r.login
              ? <OrgImg src={avatarOf(r.login, 76)} name={r.login} className="w-full h-full object-cover" />
              : <span aria-hidden className="font-mono text-[12px] text-dim">{r.name.slice(0, 1)}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <b className="text-[13.5px] font-semibold text-ink block leading-[1.3] line-clamp-2">{r.name}</b>
            {sector !== "Other" && (
              <span className="font-mono text-[9px] uppercase tracking-[.12em] text-dim block mt-1 truncate">{sector}</span>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap mt-3">
          {r.programs.map((p) => (
            <Link key={p.program} to={`/programs/${p.program}/organizations`} title={`${fmt(p.projects)} accepted ${ROSTER_LABEL[p.program] ?? p.program} project${p.projects === 1 ? "" : "s"} (${span(p)})`}>
              <Chip tone={ROSTER_TONE[p.program] ?? "cat"}>{ROSTER_LABEL[p.program] ?? p.program}</Chip>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap mt-3 font-mono text-[10px] text-dim">
          <b className="text-accent font-bold">{fmt(r.projects)}</b>
          <span>accepted project{r.projects === 1 ? "" : "s"}</span>
          {gh && <span className="text-honey font-bold">★ {fmt(gh.stars)}</span>}
          {gh && <span>{fmt(gh.repos)} repos</span>}
        </div>

        <div className="mt-auto pt-3.5 flex items-center justify-between gap-3">
          {r.login ? (
            <a href={`https://github.com/${r.login}`} target="_blank" rel="noopener" className="font-semibold text-[12.5px] text-rust inline-flex items-center gap-1.5">
              On GitHub
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
            </a>
          ) : r.url ? (
            <a href={r.url} target="_blank" rel="noopener" className="font-semibold text-[12.5px] text-rust inline-flex items-center gap-1.5">
              Official page
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
            </a>
          ) : (
            <span className="font-semibold text-[12.5px] text-dim" title="The archive names this organization but publishes no page for it.">Program record</span>
          )}
          {!r.login && (
            <span className="font-mono text-[9px] uppercase tracking-[.1em] text-dim" title="No GitHub account could be confirmed for this organization, so it shows no stars, repositories or profile.">no account</span>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className={`${W} pt-6 pb-2`}>
      <div className="bg-card border border-line rounded-[22px] p-6 shadow-soft max-[700px]:p-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display font-extrabold text-[22px] tracking-[-.02em]">
              The rest of the <Word>program roster</Word>
            </h2>
            <p className="text-cocoa text-[13px] leading-[1.6] mt-1.5 max-w-[720px]">
              {fmt(ROSTER_STATS.orgs)} organizations ran a mentored project across{" "}
              {fmt(ROSTER_STATS.projects)} accepted projects in the four archives that publish one.{" "}
              {fmt(rest.length)} of them have no profile above - either no GitHub account could be
              confirmed, or the account runs no program we track. Each card shows exactly what the
              program recorded, and links to that program's full organization list.
            </p>
          </div>
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(BAND); }}
            aria-label="Search the program roster" placeholder="Search the roster"
            className="w-full max-w-[240px] bg-paper border border-line rounded-xl px-3.5 py-2 text-[13.5px] outline-none transition-all focus:border-accent" />
        </div>

        <div className="grid grid-cols-4 gap-3.5 mt-5 max-[1100px]:grid-cols-3 max-[840px]:grid-cols-2 max-[540px]:grid-cols-1">
          {hits.slice(0, shown).map(card)}
        </div>
        {!hits.length && (
          <p className="text-dim text-[13px] py-8 text-center">No roster organization by that name - the {ORGS.length} profiled above are searched by the box at the top of the page.</p>
        )}
        {hits.length > shown && (
          <div className="flex justify-center mt-6">
            <button type="button" onClick={() => setShown((s) => s + BAND * 2)} className={btn("outline", "sm")}>
              Show more · {fmt(hits.length - shown)} left
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── page ──────────────────────────────────────────────────── */
export default function Organizations() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sector, setSector] = useState(params.get("sector") ?? "all");
  const [tech, setTech] = useState(params.get("tech") ?? "all");
  const [prog, setProg] = useState(params.get("prog") ?? "all");
  const [shown, setShown] = useState(PAGE);

  /* every filter change rewrites the whole query, so stacked facets
     survive and the sync effect below never sees a partial URL */
  const write = (over: Partial<{ q: string; sector: string; tech: string; prog: string }>) => {
    const m = { q, sector, tech, prog, ...over };
    const rec: Record<string, string> = {};
    if (m.q) rec.q = m.q;
    if (m.sector !== "all") rec.sector = m.sector;
    if (m.tech !== "all") rec.tech = m.tech;
    if (m.prog !== "all") rec.prog = m.prog;
    setParams(rec);
  };
  const setQUrl = (v: string) => { setQ(v); write({ q: v }); };
  const setSectorUrl = (v: string) => { setSector(v); write({ sector: v }); };
  const setTechUrl = (v: string) => { setTech(v); write({ tech: v }); };
  const setProgUrl = (v: string) => { setProg(v); write({ prog: v }); };
  const clearUrl = () => { setQ(""); setSector("all"); setTech("all"); setProg("all"); setParams({}); };

  /* the router's search arrives one effect after mount, so a deep link
     (?prog=gsoc) is invisible to the useState initialisers above - mirror
     the URL into state whenever it changes, the way the issue finder does */
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setSector(params.get("sector") ?? "all");
    setTech(params.get("tech") ?? "all");
    setProg(params.get("prog") ?? "all");
  }, [params]);

  /* program options that at least one tracked org really runs */
  const progOptions = useMemo(() => {
    const seen = new Map<string, string>();
    ORGS.forEach((o) => programsOf(o.login).forEach((a) => seen.set(a.id, a.label)));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const list = useMemo(() => CLASSIFIED.filter(({ org, sector: s, techs }) =>
    (sector === "all" || s === sector) &&
    (tech === "all" || techs.includes(tech)) &&
    (prog === "all" || programsOf(org.login).some((a) => a.id === prog)) &&
    (!q.trim() || (org.login + " " + org.name + " " + org.tagline + " " + org.tags.join(" ") + " " + s).toLowerCase().includes(q.trim().toLowerCase()))
  ).sort((a, b) => byStars(a.org, b.org)), [q, sector, tech, prog]);

  /* any filter change goes back to the first page of results */
  useEffect(() => { setShown(PAGE); }, [q, sector, tech, prog]);

  const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.12)]";

  return (
    <>
      <PageHead />

      <section className={`${W} pt-6`}>
        <div className="grid grid-cols-[1fr_210px_210px_190px] gap-3.5 max-[760px]:grid-cols-1">
          <input className={fin} aria-label="Search organizations" placeholder="Search organizations - “kernel”, “ai”, “maps”…" value={q} onChange={(e) => setQUrl(e.target.value)} />
          <select className={`${fin} select-warm pr-8`} value={sector} onChange={(e) => setSectorUrl(e.target.value)} aria-label="Field">
            <option value="all">All fields</option>
            {SECTOR_FACETS.map((s) => <option key={s.value} value={s.value}>{s.value} ({s.n})</option>)}
          </select>
          <select className={`${fin} select-warm pr-8`} value={tech} onChange={(e) => setTechUrl(e.target.value)} aria-label="Technology">
            <option value="all">All technologies</option>
            {TECH_FACETS.map((t) => <option key={t} value={t}>{t} ({TECH_COUNTS.get(t) ?? 0})</option>)}
          </select>
          <select className={`${fin} select-warm pr-8`} value={prog} onChange={(e) => setProgUrl(e.target.value)} aria-label="Program participation">
            <option value="all">Any program</option>
            {progOptions.map(([id, label]) => <option key={id} value={id}>{label} orgs</option>)}
          </select>
        </div>
        <PillRail />
      </section>

      <section className={`${W} pt-10 pb-4`}>
        <p className="font-mono text-[11.5px] tracking-[.1em] uppercase text-cocoa mb-5">
          Showing <b className="text-accent">{Math.min(shown, list.length)}</b> of {fmt(list.length)} organization{list.length === 1 ? "" : "s"}
          {(sector !== "all" || tech !== "all" || prog !== "all" || Boolean(q.trim())) && <span className="text-dim"> · <button className="hover:text-brick cursor-pointer" onClick={clearUrl}>clear filters</button></span>}
        </p>
        {list.length ? (
          <>
            <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[840px]:grid-cols-2 max-[540px]:grid-cols-1">
              {list.slice(0, shown).map((c) => <OrgCard key={c.org.login} org={c.org} sector={c.sector} techs={c.techs} />)}
            </div>
            {list.length > shown && (
              <div className="flex justify-center mt-8">
                <button type="button" onClick={() => setShown((s) => s + PAGE * 2)} className={btn("outline", "md")}>
                  Show more organizations · {fmt(list.length - shown)} left
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-dim">
            No organizations match those filters. <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={clearUrl}>Clear filters</button>
          </div>
        )}
      </section>

      <RosterBand />

      {/* the full program directory moved to /programs - this band is the bridge */}
      <section className={`${W} pt-14 pb-6`}>
        <div className="bg-gradient-to-br from-clay to-peach/60 border border-line rounded-[22px] px-8 py-8 max-[700px]:px-5">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="min-w-[280px] flex-1">
              <h2 className="card-title-xl">Looking for a <Word>season</Word>, not just a repo?</h2>
              <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2 max-w-[620px]">
                {PROGRAMS.length} mentored programs - stipends, calendars, eligibility and every
                organization they accepted - live on their own page.
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap items-center shrink-0">
              {PROGRAMS.filter((p) => p.status === "live").slice(0, 3).map((p) => (
                <Link key={p.id} to={`/programs/${p.id}`}
                  className="font-mono text-[10.5px] font-bold uppercase tracking-[.1em] px-3 py-2 rounded-full border border-leaf/40 bg-leaf/8 text-leaf hover:bg-leaf/15 transition-colors">
                  {p.name} · live
                </Link>
              ))}
              <Link to="/programs" className={btn("primary", "lg")}>All programs</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
