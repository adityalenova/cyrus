"use client"
/* ══ Projects.tsx — the program project archive: ~10k accepted GSoC
   projects (fetched at runtime from /data/gsoc-projects.json), the other
   four big archives' rows in /data/otherProjects.json, and one shard per
   remaining program under /data/program-projects/ - listed Contribo-style
   with a filter rail. Cards never open an internal page: they go to the
   project's own page, and a row only ever carries what its source said. ═ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { ORGS, PROGRAMS } from "../data/orgs";
import { PROGRAM_REPOS, PROGRAM_META } from "../data/programRepos";
import type { ProgramName } from "../data/programRepos";
import { useProjectArchives } from "../lib/programProjects";
import { fmtFull } from "../lib/siteStats";
import { fmtCompact } from "../lib/util";
import { useStore } from "../lib/store";
import { btn, Chip, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";
const GSOC_URL = "https://summerofcode.withgoogle.com";

/* ── one row type for everything this page lists ──────────── */
interface Proj {
  key: string;
  title: string;
  org: string;
  orgUrl: string;
  program: string;            // the program's own display label
  year: number;
  /** project scope, only where the archive states it - GSoC publishes this */
  size?: "small" | "medium" | "large";
  /** the round or cohort the source names on this row, when it names one */
  season?: string;
  tags: string[];
  body: string;
  mentor: string;
  url: string;                // external project / repo page
  stars: number;
  orgTo?: string;             // in-platform org page (cyrus.ai /organizations/…)
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* our live GitHub directory, keyed by normalised name AND login */
const DIR_LOGIN = new Map<string, string>();
for (const o of ORGS) { DIR_LOGIN.set(norm(o.login), o.login); DIR_LOGIN.set(norm(o.name), o.login); }

/* where the Org button goes: a cyrus.ai directory profile when we have one
   (real GitHub data), otherwise the org's own official page via orgUrl. */
function orgTarget(p: Proj): Pick<Proj, "orgTo"> {
  const dir = DIR_LOGIN.get(norm(p.org));
  return dir ? { orgTo: `/organizations/${dir}` } : {};
}

interface RawGsoc { y: number; u: string; t: string; o: string; s: string; tt: string[]; tp: string[]; b: string; m: string }
interface RawFile { projects: RawGsoc[]; orgs: Record<string, { url?: string; category?: string }> }

/* One program reaches this grid under several spellings: the flagship shelf
   carries the ProgramName key ("GSSoc"), its archive shard carries the edition
   ("GSSoC'26"). progLabel is what a card prints and what the rail offers,
   progKey is what a filter compares, so the two spellings are one option and a
   ?prog= link from a program page still matches either kind of row. */
const stripSeason = (s: string) => s.replace(/['’]?\d{2,4}$/, "");
const progLabel = (s: string) => PROGRAM_META[s as ProgramName]?.label ?? stripSeason(s);
const progKey = (s: string) => stripSeason(s).toLowerCase();

/* What a project's published scope means for a newcomer. GSoC states
   small/medium/large per row; that is the only difficulty figure any card
   shows, and the badge says who it is easy for rather than inventing a score. */
type Size = "small" | "medium" | "large";
const DIFF: Record<Size, string> = { small: "Easy", medium: "Medium", large: "Hard" };
const DIFF_CLS: Record<Size, string> = {
  small: "text-leaf border-leaf/40 bg-leaf/10",
  medium: "text-honey border-honey/45 bg-honey/12",
  large: "text-brick border-brick/40 bg-brick/10",
};

/* the 87 flagship program repos, mapped into the same shape */
const flagships: Proj[] = PROGRAM_REPOS.map((r) => {
  const [owner] = r.repo.split("/");
  return {
    key: r.repo, title: r.repo.split("/")[1].replace(/[-_]/g, " "), org: owner,
    orgUrl: `https://github.com/${owner}`, program: r.programs[0], year: 2026,
    size: (["small", "medium", "large"] as const)[r.stars > 4000 ? 2 : r.stars > 500 ? 1 : 0],
    tags: [r.lang, ...r.tags.slice(0, 3)], body: r.desc, mentor: "",
    url: `https://github.com/${r.repo}`, stars: r.stars,
  };
});

/* ── card - external redirect only, no internal detail page ── */
function ProjCard({ p }: { p: Proj }) {
  const { saved, toggleSaved, toast } = useStore();
  const on = saved.includes(p.url);
  return (
    <article className="group bg-card border border-line rounded-[18px] p-[18px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/45">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="card-title text-[16px] line-clamp-2">{p.title}</h3>
          <p className="font-mono text-[10px] tracking-[.09em] uppercase text-dim mt-1.5 truncate">{p.org}{p.year ? ` • ${p.year}` : ""}{p.season ? ` • ${p.season}` : ""}</p>
        </div>
        {p.size && (
          <span className={`font-mono text-[9px] font-bold uppercase tracking-[.09em] px-2 py-1 rounded-md border shrink-0 ${DIFF_CLS[p.size]}`}>{DIFF[p.size] === "Easy" ? "BEGINNER" : DIFF[p.size] === "Medium" ? "INTERMEDIATE" : "ADVANCED"}</span>
        )}
      </div>
      {/* the program's own name, on every card. These rows used to carry a
          stipend range and an hours figure read off a band for the project's
          size rather than off the archive, so a GSoC card showed money and no
          program name while every other card showed the name. The scope badge
          above is what the source actually publishes. */}
      <div className="flex gap-1.5 flex-wrap mt-3">
        <Chip tone="cat">{progLabel(p.program)}</Chip>
        {p.stars > 0 && <Chip tone="stars">★ {fmtCompact(p.stars)}</Chip>}
      </div>
      <p className="text-cocoa text-[12.5px] leading-[1.55] mt-2.5 line-clamp-3">{p.body}</p>
      <div className="flex gap-1.5 flex-wrap mt-3 items-center">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-dim shrink-0"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6" /></svg>
        {p.tags.slice(0, 3).map((t) => <Chip key={t} tone="lang">{t}</Chip>)}
        {p.tags.length > 3 && <span className="text-[11.5px] text-dim">+{p.tags.length - 3}</span>}
      </div>
      {p.mentor && (
        <p className="text-[11.5px] text-dim mt-2.5 truncate flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-4 12.5-4 14 0" /></svg>
          <span className="font-mono text-[10px] uppercase tracking-[.06em]">Mentors:</span> {p.mentor}
        </p>
      )}
      <div className="flex items-center gap-2 mt-auto pt-3.5 border-t border-liness mt-4">
        <a href={p.url} target="_blank" rel="noreferrer" className="text-[12.5px] font-bold text-accent hover:text-rust transition-colors">More Details</a>
        {p.orgTo ? (
          <Link to={p.orgTo} title={`View ${p.org} on cyrus.ai`}
            className="font-mono text-[10px] font-bold tracking-[.08em] uppercase text-cocoa border border-line rounded-[9px] px-2.5 py-1.5 hover:border-accent hover:text-rust transition-colors">Org</Link>
        ) : p.orgUrl && (
          <a href={p.orgUrl} target="_blank" rel="noreferrer" title={`${p.org} on the web`}
            className="font-mono text-[10px] font-bold tracking-[.08em] uppercase text-cocoa border border-line rounded-[9px] px-2.5 py-1.5 hover:border-accent hover:text-rust transition-colors">Org</a>
        )}
        <button aria-label={on ? "Stop tracking" : "Track project"} title={on ? "Stop tracking" : "Track on dashboard"} onClick={() => {
          const added = toggleSaved(p.url);
          toast(added ? "Added to your dashboard" : "Removed from dashboard");
        }} className={`ml-auto w-[30px] h-[30px] rounded-[9px] border grid place-items-center text-[13px] transition-all cursor-pointer ${on ? "bg-accent border-accent text-accentfg" : "bg-cream border-line text-dim hover:border-accent hover:text-accent"}`}>
          {on ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default function Projects() {
  const [raw, setRaw] = useState<RawFile | null>(null);
  const [other, setOther] = useState<RawFile | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  const [params, setParams] = useSearchParams();
  const SORT_VALUES = ["recent", "org", "title"] as const;
  const rawSort = params.get("sort");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [prog, setProg] = useState(params.get("prog") ?? "all");
  const [diff, setDiff] = useState(params.get("diff") ?? "all");
  const [year, setYear] = useState(params.get("year") ?? "all");
  const [tech, setTech] = useState(params.get("tech") ?? "all");
  const [sort, setSort] = useState<"recent" | "org" | "title">(
    SORT_VALUES.includes(rawSort as any) ? (rawSort as "recent" | "org" | "title") : "recent"
  );
  const [shown, setShown] = useState(60);
  /* per-program shards + the honest list of programs that publish no archive */
  const arc = useProjectArchives(PROGRAMS);

  /* every filter change rewrites the whole query so stacked facets
     survive, and the sync effect below never sees a partial URL */
  const write = (over: Partial<{ q: string; prog: string; diff: string; year: string; tech: string; sort: string }>) => {
    const m = { q, prog, diff, year, tech, sort, ...over };
    const rec: Record<string, string> = {};
    if (m.q) rec.q = m.q;
    if (m.prog !== "all") rec.prog = m.prog;
    if (m.diff !== "all") rec.diff = m.diff;
    if (m.year !== "all") rec.year = m.year;
    if (m.tech !== "all") rec.tech = m.tech;
    if (m.sort !== "recent") rec.sort = m.sort;
    setParams(rec);
  };
  const setQUrl = (v: string) => { setQ(v); write({ q: v }); };
  /* programs are chosen from the sidebar; a /programs link can still arrive
     with ?prog=…, so that facet stays honoured - this only clears it */
  const clearProg = () => { setProg("all"); write({ prog: "all" }); };
  /* the rail can also set it, which is how you get from the whole archive to
     one program's rows without leaving the page */
  const setProgUrl = (v: string) => { setProg(v); write({ prog: v }); setShown(60); };
  const setDiffUrl = (v: string) => { setDiff(v); write({ diff: v }); };
  const setYearUrl = (v: string) => { setYear(v); write({ year: v }); };
  const setTechUrl = (v: string) => { setTech(v); write({ tech: v }); };
  const setSortUrl = (v: "recent" | "org" | "title") => { setSort(v); write({ sort: v }); };
  const clearUrl = () => { setQ(""); setProg("all"); setDiff("all"); setYear("all"); setTech("all"); setParams({}); };

  /* search arrives one effect after mount, so deep links from /programs
     (?prog=LFX&year=2024) are invisible to the useState initialisers -
     mirror the URL into state whenever it changes */
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setProg(params.get("prog") ?? "all");
    setDiff(params.get("diff") ?? "all");
    setYear(params.get("year") ?? "all");
    setTech(params.get("tech") ?? "all");
    setSort(SORT_VALUES.includes(params.get("sort") as any) ? (params.get("sort") as "recent" | "org" | "title") : "recent");
  }, [params]);

  useEffect(() => {
    let go = true;
    fetch("/data/gsoc-projects.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing"))))
      .then((d: RawFile) => { if (go && Array.isArray(d?.projects)) setRaw(d); else if (go) setLoadErr(true); })
      .catch(() => { if (go) setLoadErr(true); });
    /* LFX · Outreachy · Summer of Bitcoin rows - absent until npm run refresh adds them */
    fetch("/data/otherProjects.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing"))))
      .then((d: RawFile) => { if (go && Array.isArray(d?.projects)) setOther(d); })
      .catch(() => { /* optional shelf */ });
    return () => { go = false; };
  }, []);

  const all = useMemo<Proj[]>(() => {
    const orgs = { ...(raw?.orgs ?? {}), ...(other?.orgs ?? {}) };
    const gsoc: Proj[] = (raw?.projects ?? []).map((p) => ({
      key: `g${p.u}`, title: p.t, org: p.o,
      orgUrl: orgs[p.o]?.url || `${GSOC_URL}/programs/${p.y}/organizations/${slugOf(p.o)}`,
      program: "GSoC", year: p.y, size: (["small", "medium", "large"].includes(p.s) ? p.s : "medium") as Proj["size"],
      tags: [...p.tt, ...p.tp].slice(0, 4), body: p.b, mentor: p.m,
      url: `${GSOC_URL}/programs/${p.y}/projects/${p.u}`, stars: 0,
    }));
    const extra: Proj[] = (other?.projects ?? []).map((p) => ({
      key: `${(p as { program?: string }).program ?? "x"}${p.u}`, title: p.t, org: p.o,
      orgUrl: orgs[p.o]?.url || `https://github.com/search?q=${encodeURIComponent(p.o)}&type=organizations`,
      program: (p as { program?: string }).program ?? "LFX",
      year: p.y, size: (["small", "medium", "large"].includes(p.s) ? p.s : undefined) as Proj["size"] | undefined,
      /* these three carry their round in the same cell GSoC uses for scope, so
         only a value that reads like a season is shown as one */
      season: /\d{4}|round|cohort|term/i.test(p.s) ? p.s : undefined,
      tags: [...p.tt, ...p.tp].slice(0, 4), body: p.b, mentor: p.m,
      url: (p as { url?: string }).url || `https://mentorship.lfx.linuxfoundation.org/#all_all_all`, stars: 0,
    }));
    /* one shard per remaining program - GSSoC, Season of KDE, 24 Pull Requests,
       MLH, NSoC, Hacktoberfest, FOSSEE, Vercel OSS - each labelled with the
       evidence its build step recorded, so a chip never overclaims */
    const shards: Proj[] = arc.rows.map((r) => ({
      key: r.key, title: r.title, org: r.org, orgUrl: r.orgUrl,
      program: r.program,
      year: r.year, season: r.season,
      tags: r.tags, body: r.body, mentor: r.mentor, url: r.url, stars: r.stars,
    }));
    return [...gsoc, ...extra, ...shards, ...flagships];
  }, [raw, other, arc.rows]);

  /* filter option lists derived from what actually loaded.
     A shard row whose program publishes no date per project keeps year 0 -
     Hacktoberfest, MLH and 24 Pull Requests all do - and a "0" chip in a row of
     years reads as a season, so it is left out of the option list. */
  const years = useMemo(() => [...new Set(all.map((p) => p.year))].filter((y) => y > 0).sort((a, b) => b - a), [all]);

  /* the programs this listing really holds, biggest archive first; the chips
     carry the name only, never a row count, because the count changes with
     every filter already applied above it.
     One program can reach the grid under two spellings - the GSSoC shard says
     "GSSoC'26" and the flagship shelf says "GSSoc" - so rows are grouped on the
     name with its trailing season digits removed and the most frequent spelling
     becomes the option. Without this the rail offers the same program twice and
     each half looks like a thin archive. The grouping key is the module-level
     progKey, the same one the filter predicate compares against, so the option a
     rail shows and the match a click makes can never disagree. */
  const progOptions = useMemo(() => {
    /* key -> (spelling -> how many rows use it) */
    const g = new Map<string, Map<string, number>>();
    for (const p of all) {
      const k = progKey(p.program);
      const byLabel = g.get(k) ?? new Map<string, number>();
      byLabel.set(p.program, (byLabel.get(p.program) ?? 0) + 1);
      g.set(k, byLabel);
    }
    const size = (m: Map<string, number>) => [...m.values()].reduce((s, n) => s + n, 0);
    return [...g.entries()]
      .map(([k, byLabel]) => ({
        k,
        /* the spelling most of its rows already carry */
        label: [...byLabel.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
        n: size(byLabel),
      }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
      .map((x) => x.label);
  }, [all]);

  const stacks = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of all) for (const t of p.tags) c.set(t, (c.get(t) || 0) + (p.program === "GSoC" ? 1 : 2));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [all]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const progK = prog === "all" ? "" : progKey(prog);
    const r = all.filter((p) =>
      (prog === "all" || progKey(p.program) === progK) &&
      (diff === "all" || p.size === diff) &&
      (year === "all" || String(p.year) === year) &&
      (tech === "all" || p.tags.some((t) => t.toLowerCase() === tech.toLowerCase())) &&
      (!needle || (p.title + " " + p.org + " " + p.body + " " + p.tags.join(" ")).toLowerCase().includes(needle))
    );
    r.sort((a, b) => sort === "recent" ? b.year - a.year || a.org.localeCompare(b.org)
      : sort === "org" ? a.org.localeCompare(b.org) || b.year - a.year
      : a.title.localeCompare(b.title));
    return r.map((p) => Object.assign({}, p, orgTarget(p)));
  }, [all, q, prog, diff, year, tech, sort]);

  const visible = list.slice(0, shown);

  const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.12)]";
  const lbl = "block font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2.5";
  const clearAll = () => { clearUrl(); setShown(60); };
  const anyFilter = q || prog !== "all" || diff !== "all" || year !== "all" || tech !== "all";

  return (
    <div className={`${W} pt-14 pb-4`}>
      {/* header - reference "Explore Projects" style */}
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span> <span className="text-cocoa">Projects</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Explore <Word>Projects</Word>
      </h1>
      <p className="text-ink font-medium max-w-[720px] text-[16.5px] leading-[1.6]">
        Find open source projects actively accepting contributors. Search repositories, then filter by difficulty tag, year, or tech stack.
      </p>

      {/* how to work the archive */}
      <div className="mt-8 bg-gradient-to-br from-clay to-peach/60 border border-line rounded-[22px] px-8 py-7 flex items-center gap-6 flex-wrap max-[700px]:px-5">
        <div className="min-w-[280px] flex-1">
          <h2 className="card-title-xl">Not sure which project to take?</h2>
          <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2 max-w-[600px]">
            Narrow the archive with the filters on the left - difficulty, year, language - then track the issues
            worth your week on your own board. cyrus shows the public record; the choice stays yours.
          </p>
        </div>
        <Link to="/dashboard/issues" className={btn("primary", "lg") + " shrink-0"}>Track it on your board</Link>
      </div>

      {/* rail + results */}
      <div className="grid grid-cols-[280px_1fr] gap-7 items-start mt-8 max-[980px]:grid-cols-1">
        <aside className="sticky top-[86px] max-[980px]:static bg-card border border-line rounded-[22px] p-[22px] shadow-soft grid gap-5">
          <div className="flex items-center gap-2.5">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink"><path d="M4 6h16M4 12h10M4 18h5" /><circle cx="19" cy="18" r="2.5" /></svg>
            <span className="font-display font-bold text-[15px] tracking-[-.01em]">Filters</span>
          </div>
          <div>
            <span className={lbl}>Search</span>
            <input className={fin} placeholder="Title, tech, org..." value={q} onChange={(e) => { setQUrl(e.target.value); setShown(60); }} aria-label="Search projects" />
          </div>
          <div>
            <span className={lbl}>Program</span>
            <select className={`${fin} select-warm pr-8`} value={prog} onChange={(e) => setProgUrl(e.target.value)} aria-label="Filter by program">
              <option value="all">All Programs</option>
              {/* a ?prog= link can name a program this listing has no rows for
                  yet - the archive shards stream in after the URL is read. Keep
                  the facet selected rather than silently dropping it back to
                  "All Programs", so the count below still says what was asked. */}
              {prog !== "all" && !progOptions.includes(prog) && <option value={prog}>{prog}</option>}
              {progOptions.map((l) => (
                <option key={l} value={l}>{l === "GSoC" ? "Google Summer of Code" : l}</option>
              ))}
            </select>
          </div>
          <div>
            <span className={lbl}>Difficulty</span>
            <select className={`${fin} select-warm pr-8`} value={diff} onChange={(e) => { setDiffUrl(e.target.value); setShown(60); }} aria-label="Filter by difficulty">
              <option value="all">All Difficulties</option>
              <option value="small">Easy · small (~175h)</option>
              <option value="medium">Medium · ~350h</option>
              <option value="large">Hard · large (~450h)</option>
            </select>
          </div>
          <div>
            <span className={lbl}>Popular stacks</span>
            <div className="flex flex-wrap gap-[7px]">
              {stacks.map((l) => (
                <button key={l} onClick={() => { setTechUrl(tech === l ? "all" : l); setShown(60); }}
                  className={`text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${tech === l ? "bg-coffee border-coffee text-foam" : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button className={btn("primary", "md", "w-full")} onClick={() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Apply filters</button>
          {anyFilter && <button className="text-[12.5px] font-semibold text-cocoa hover:text-rust cursor-pointer -mt-2" onClick={clearAll}>Reset filters</button>}
        </aside>

        <section id="results" className="scroll-mt-24">
          {prog !== "all" && (
            <p className="font-mono text-[11px] font-bold tracking-[.05em] text-cocoa pb-4">
              <span className="rounded-full border border-line bg-card px-3.5 py-2">
                {prog === "GSoC" ? "Google Summer of Code" : PROGRAM_META[prog as ProgramName]?.label ?? prog}
                <button onClick={clearProg} className="ml-2.5 text-accent font-bold hover:underline cursor-pointer">Show every program</button>
              </span>
            </p>
          )}
          <div className="flex gap-2 flex-wrap pb-4">
            {[["all", "All Years"], ...years.map((y) => [String(y), String(y)] as [string, string])].map(([v, l]) => (
              <button key={v} onClick={() => { setYearUrl(v); setShown(60); }}
                className={`font-mono text-[11.5px] font-bold tracking-[.05em] rounded-full px-4 py-2 border transition-all cursor-pointer ${year === v ? "bg-coffee border-coffee text-foam" : "bg-card border-line text-cocoa hover:border-accent hover:text-rust"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3.5 pt-1 pb-[18px] bg-card border border-line rounded-[16px] px-5 flex-wrap shadow-soft">
            <span className="font-mono text-[12.5px] tracking-[.1em] uppercase text-cocoa">
              <b className="text-ink">{fmtFull(list.length)}</b>&nbsp; projects found
              {loadErr && <span className="normal-case tracking-normal text-brick ml-3">Archive file missing - run npm run refresh</span>}
            </span>
            <span className="ml-auto font-mono text-[10.5px] tracking-[.12em] uppercase text-dim">Sort by</span>
            <select className={`${fin} select-warm !w-auto rounded-full pr-8 py-2 text-[13px] font-semibold`} value={sort} onChange={(e) => setSortUrl(e.target.value as typeof sort)} aria-label="Sort projects">
              <option value="recent">Newest Added</option>
              <option value="org">Organization A-Z</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>

          {list.length ? (
            <>
              <div className="grid grid-cols-3 gap-4 max-[1150px]:grid-cols-2 max-[700px]:grid-cols-1">
                {visible.map((p) => <ProjCard key={p.key} p={p} />)}
              </div>
              {shown < list.length && (
                <div className="flex justify-center mt-8">
                  <button onClick={() => setShown(shown + 60)} className={btn("outline", "lg") + " cursor-pointer"}>
                    Show {Math.min(60, list.length - shown)} of {fmtFull(list.length - shown)} more
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-dim border border-dashed border-line rounded-[22px] bg-cream">
              {!raw && !loadErr ? (
                <p className="font-display text-[20px] text-cocoa">Loading the GSoC archive…</p>
              ) : (
                <>
                  <p className="font-display text-[20px] text-cocoa mb-2">Nothing matches that combination.</p>
                  <p>Loosen a filter - or the archive is a hint to <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={clearAll}>reset them</button>.</p>
                </>
              )}
            </div>
          )}

          {anyFilter && list.length > 0 && (
            <p className="font-mono text-[10.5px] text-dim mt-5">
              Showing {visible.length} of {fmtFull(list.length)} · <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={clearAll}>Clear filters</button>
            </p>
          )}

          <div className="flex justify-center gap-3 mt-12 flex-wrap">
            <Link to="/#timeline" className={btn("dark", "md")}>See the 12-month program timeline</Link>
            <Link to="/organizations" className={btn("outline", "md")}>Browse the program orgs</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
