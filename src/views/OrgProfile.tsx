"use client"
/* ══ OrgProfile.tsx — one org, stats, contributors, its builds ═ */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { orgByLogin, avatarOf, fmtCompact, LANG_COLORS } from "../lib/util";
import { ORGS } from "../data/orgs";
import { REAL_REPOS, REAL_STATS } from "../data/realOrgs";
import { programsOf } from "../data/programAssoc";
import { useStore } from "../lib/store";
import { btn, Chip, OrgImg, Tag } from "../components/ui";
import { sectorOfOrg } from "../lib/orgClasses";
import NotFound from "./NotFound";

const W = "max-w-[1240px] mx-auto px-6";
const GSOC_URL = "https://summerofcode.withgoogle.com";

/* ── program-archive rows, joined in from the runtime JSON files ── */
interface RawProj { y: number; u: string; t: string; o: string; s: "small" | "medium" | "large"; tt: string[]; tp: string[]; b: string; m: string; url?: string; program?: string }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const PP_BADGE: Record<string, string> = {
  small: "text-leaf border-leaf/40 bg-leaf/10",
  medium: "text-honey border-honey/45 bg-honey/12",
  large: "text-brick border-brick/40 bg-brick/10",
};
const PP_LABEL: Record<string, string> = { small: "BEGINNER", medium: "INTERMEDIATE", large: "ADVANCED" };

/* ── svg icon set (no emoji in the UI) ─────────────────────── */
const SW = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Ic = ({ d, extra, size = 17 }: { d: string; extra?: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d={d} {...SW} />{extra}
  </svg>
);
const STAR_D = "M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z";
const IC_FORK = <Ic d="M6 3a2.5 2.5 0 1 0 2.4 3.3h7.2A2.5 2.5 0 1 0 16 9a2.5 2.5 0 0 0-2.4-1.7H8.4a4.4 4.4 0 0 1-.9 2.2c-.8 1-1.5 1.5-1.5 3v1.3A2.5 2.5 0 1 0 7.5 18 2.5 2.5 0 0 0 6 15.7V12.5c0-.8.4-1.4 1-2.1a6 6 0 0 0 1.2-3.1h4.6a2.5 2.5 0 0 0 4.9.7" extra={<circle cx="18" cy="6.5" r="2.5" {...SW} />} />;
const IC_REPO = <Ic d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 16.5v-12zM5 16.5A1.5 1.5 0 0 1 6.5 15H19M9 7.5h6" />;
const IC_SPARK = <Ic d="M12 4l1.7 4.9L18.6 10l-4.9 1.7L12 16.6l-1.7-4.9L5.4 10l4.9-1.4L12 4zM18 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />;
const IC_TERMINAL = <Ic d="M4.5 5.5h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM7 10l2.5 2L7 14M12.5 14.5H17" />;

/* The directory is live GitHub data (scripts/fetch-orgs.mjs); unknown logins 404. */

export default function OrgProfile() {
  const { login } = useParams();
  const { savedOrgs, toggleSavedOrg, toast } = useStore();

  const org = orgByLogin(login ?? "");
  const real = org ? REAL_REPOS[org.login] ?? [] : [];
  const stats = org ? REAL_STATS[org.login] : undefined;

  /* the program-project archive, fetched at runtime like the Projects page */
  const [archive, setArchive] = useState<RawProj[]>([]);
  const [ppYear, setPpYear] = useState("all");
  const [ppDiff, setPpDiff] = useState("all");
  const [ppQ, setPpQ] = useState("");
  useEffect(() => {
    let go = true;
    const read = (url: string, tag: (p: RawProj) => RawProj) =>
      fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing"))))
        .then((d) => { if (go && Array.isArray(d?.projects)) setArchive((a) => [...a, ...d.projects.map(tag)]); })
        .catch(() => {}); // otherProjects.json may not exist yet - fine
    read("/data/gsoc-projects.json", (p) => ({ ...p, program: p.program ?? "GSoC", url: p.url ?? `${GSOC_URL}/programs/${p.y}/projects/${p.u}` }));
    read("/data/otherProjects.json", (p) => ({ ...p, program: p.program ?? "LFX", url: p.url }));
    return () => { go = false; };
  }, []);

  const orgProjects = useMemo<RawProj[]>(() => {
    if (!org) return [];
    const nName = norm(org.name);
    const nLogin = norm(org.login);
    const hit = (o: string) => {
      const n = norm(o);
      if (!n || !nName) return false;
      return n === nName || n === nLogin
        || (nName.length >= 5 && (n.includes(nName) || nName.includes(n)))
        || (nLogin.length >= 5 && (n.includes(nLogin) || nLogin.includes(n)));
    };
    return archive.filter((p) => hit(p.o)).sort((a, b) => b.y - a.y || a.t.localeCompare(b.t));
  }, [archive, org]);

  const similar = useMemo(() => org ? ORGS.filter((o) => o.login !== org.login)
    .map((o) => ({ o, shared: o.tags.filter((t) => org.tags.includes(t)).length }))
    .sort((a, b) => b.shared - a.shared || b.o.stars - a.o.stars).slice(0, 4) : [], [org]);

  if (!org) return <NotFound />;

  const projYears = [...new Set(orgProjects.map((p) => p.y))].sort((a, b) => b - a);
  const projTechs = Object.entries(orgProjects.reduce<Record<string, number>>((acc, p) => {
    (p.tt ?? []).slice(0, 3).forEach((t) => { if (t) acc[t] = (acc[t] ?? 0) + 1; }); return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  const projTopics = Object.entries(orgProjects.reduce<Record<string, number>>((acc, p) => {
    (p.tp ?? []).slice(0, 2).forEach((t) => { if (t) acc[t] = (acc[t] ?? 0) + 1; }); return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  const dist = [...new Set(orgProjects.map((p) => p.y))].sort();
  const distMax = Math.max(1, ...dist.map((y) => orgProjects.filter((p) => p.y === y).length));
  const tier = orgProjects.length >= 150 ? "Tier 1" : orgProjects.length >= 40 ? "Tier 2" : orgProjects.length ? "Tier 3" : "Newcomer";
  const active2026 = orgProjects.some((p) => p.y >= 2026);

  const on = savedOrgs.includes(org.login);
  /* honest program badges: what the archive proves + what their repos' GitHub topics say */
  const archiveProgs = [...new Set(orgProjects.map((p) => p.program ?? "GSoC"))].map((name) => ({
    name, n: orgProjects.filter((p) => (p.program ?? "GSoC") === name).length,
  })).sort((a, b) => b.n - a.n);
  const ARCHIVE_ID: Record<string, string> = { GSoC: "gsoc", LFX: "lfx", Outreachy: "outreachy", "Summer of Bitcoin": "sob", GSSoc: "gssoc" };
  const assocExtra = programsOf(org.login).filter((a) => !Object.values(ARCHIVE_ID).includes(a.id));

  const ppList = orgProjects.filter((p) =>
    (ppYear === "all" || String(p.y) === ppYear) &&
    (ppDiff === "all" || p.s === ppDiff) &&
    (!ppQ.trim() || (p.t + " " + (p.b ?? "") + " " + (p.tt ?? []).join(" ")).toLowerCase().includes(ppQ.trim().toLowerCase())));
  const projTechTop = projTechs[0] ?? org.tags[0] ?? "-";
  /* the same field label the directory filters on, from the same table */
  const sector = sectorOfOrg(org.login) ?? "Other";

  return (
    <>
      {/* ── org header, reference style ── */}
      <header className="border-b border-liness">
        <div className={`${W} py-10`}>
          <p className="font-mono text-[10.5px] tracking-[.16em] uppercase text-dim mb-4">
            <Link to="/" className="hover:text-accent">Home</Link> <span className="px-1.5">›</span>
            <Link to="/organizations" className="hover:text-accent">Organizations</Link> <span className="px-1.5">›</span>
            <span className="text-cocoa">{org.login}</span>
          </p>
          <div className="flex gap-2 flex-wrap mb-4">
            {archiveProgs.map(({ name, n }) => (ARCHIVE_ID[name]
              ? <Link key={name} to={`/programs/${ARCHIVE_ID[name]}`}
                  className="font-mono text-[10px] font-bold uppercase tracking-[.12em] px-2.5 py-1.5 rounded-lg border text-denim border-denim/35 bg-denim/8 hover:bg-denim/15 transition-colors">
                  {name} · {fmtCompact(n)}
                </Link>
              : <span key={name} className="font-mono text-[10px] font-bold uppercase tracking-[.12em] px-2.5 py-1.5 rounded-lg border text-denim border-denim/35 bg-denim/8">
                  {name} · {fmtCompact(n)}
                </span>))}
            {assocExtra.map((a) => (
              <Link key={a.id} to={`/programs/${a.id}`}
                className="font-mono text-[10px] font-bold uppercase tracking-[.12em] px-2.5 py-1.5 rounded-lg border text-honey border-honey/40 bg-honey/8 hover:bg-honey/15 transition-colors">
                {a.label} topic · {fmtCompact(a.n)}
              </Link>
            ))}
            {archiveProgs.length === 0 && assocExtra.length === 0 && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] px-2.5 py-1.5 rounded-lg border text-cocoa border-line bg-cream">
                Not in the program archive yet
              </span>
            )}
            {orgProjects.length > 0 && <>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] px-2.5 py-1.5 rounded-lg border text-leaf border-leaf/35 bg-leaf/8">{active2026 ? "● Active 2026" : `● ${projYears[0] ?? "Archive"} archive`}</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] px-2.5 py-1.5 rounded-lg border text-cocoa border-line bg-cream">{fmtCompact(orgProjects.length)} archived projects</span>
            </>}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-[clamp(27px,3.4vw,40px)] tracking-[-.02em] leading-[1.05]">
                {org.name} <small className="text-dim font-medium text-[.52em]">@{org.login}</small>
              </h1>
              <p className="text-cocoa mt-2 max-w-[700px] text-[14.5px] leading-[1.6]">{org.tagline}</p>
            </div>
            <div className="ml-auto flex gap-2.5 items-center">
              {sector !== "Other" && (
                <Link to={`/organizations?sector=${encodeURIComponent(sector)}`}
                  title={`Every ${sector} organization in the directory`}
                  className="font-mono text-[10px] font-semibold uppercase tracking-[.1em] px-2.5 py-1.5 rounded-lg border border-plum/30 bg-plum/6 text-plum hover:border-plum/60 transition-colors">
                  {sector}
                </Link>
              )}
              <button onClick={async () => {
                const share = { title: `${org.name} · cyrus.ai`, text: org.tagline, url: window.location.href };
                try { if (navigator.share) await navigator.share(share); else { await navigator.clipboard.writeText(share.url); toast("Profile link copied"); } } catch { /* dismissed */ }
              }} className={btn("outline", "md")}>Share</button>
              <button onClick={() => { const added = toggleSavedOrg(org.login); toast(added ? `Saved ${org.login}` : `Removed ${org.login}`); }}
                className={btn(on ? "primary" : "outline", "md")}>{on ? "★ Saved" : "☆ Save"}</button>
            </div>
          </div>
        </div>
      </header>

      <div className={`${W} pt-9 pb-8 grid gap-5`}>
        {/* ── overview: main card + right rail, like the reference ── */}
        <div className="grid grid-cols-[minmax(0,1fr)_388px] gap-6 items-start max-[1080px]:grid-cols-1">
          {/* left: organization card */}
          <section className="bg-card border border-line rounded-[22px] p-6 md:p-7 shadow-soft">
            <div className="flex items-start gap-5 flex-wrap">
              <span className="w-[84px] h-[84px] rounded-[20px] bg-cream border border-line grid place-items-center overflow-hidden shrink-0 shadow-soft">
                <OrgImg src={avatarOf(org.login, 168)} name={org.login} className="w-[56px] h-[56px] object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex gap-1.5 flex-wrap mb-2.5">
                  {(org.tags ?? []).slice(0, 3).map((t) => <Chip key={t} tone="cat">{String(t).toUpperCase()}</Chip>)}
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-cocoa border border-line rounded-full px-2.5 py-1">
                    {projYears.length} program years
                  </span>
                </div>
                <h2 className="card-title text-[24px] md:text-[28px] leading-[1.15]">{org.name}</h2>
                <p className="font-mono text-[11px] uppercase tracking-[.12em] text-dim mt-1.5">@{org.login} · {org.domain}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0 ml-auto">
                <a href={`https://github.com/${org.login}`} target="_blank" rel="noopener" className={btn("dark", "sm")}>Visit official site</a>
                <Link to={`/projects?q=${encodeURIComponent(org.login)}`} className={btn("outline", "sm")}>Projects from {org.login}</Link>
              </div>
            </div>

            <div className="grid gap-5 mt-6">
              <div>
                <p className="panel-h">About the organization</p>
                <p className="card-desc text-[14px] leading-[1.7] mt-2 max-w-[700px]">{org.tagline}</p>
              </div>
              <div>
                <p className="panel-h">Primary technologies &amp; languages</p>
                <div className="flex gap-1.5 flex-wrap mt-2.5">
                  {(projTechs.length ? projTechs : org.tags).slice(0, 6).map((t) => <Chip key={t} tone="cat">{t}</Chip>)}
                </div>
              </div>
              <div>
                <p className="panel-h">Technical topics &amp; focus areas</p>
                <div className="flex gap-1.5 flex-wrap mt-2.5">
                  {(projTopics.length ? projTopics : org.tags).slice(0, 6).map((t) => <Tag key={t}>{t}</Tag>)}
                </div>
              </div>
              <div>
                <p className="panel-h">Participation years</p>
                <div className="flex gap-1.5 flex-wrap mt-2.5 font-mono text-[11.5px]">
                  {(projYears.length ? projYears : [2023, 2024, 2025]).map((y) => (
                    <span key={y} className={`px-2.5 py-1 rounded-lg border ${y >= 2025 ? "border-leaf/40 bg-leaf/10 text-leaf font-bold" : "border-line bg-cream text-cocoa"}`}>{y}</span>
                  ))}
                </div>
              </div>
            </div>

            <Link to="/dashboard/repos" className="block mt-6 bg-cream border border-line rounded-[16px] px-5 py-4 flex items-center gap-3 hover:border-accent/45 hover:shadow-lift transition-all">
              <span className="w-[34px] h-[34px] rounded-[10px] bg-peach text-rust grid place-items-center shrink-0">{IC_SPARK}</span>
              <span className="min-w-0">
                <b className="block text-ink text-[14px] font-display font-extrabold leading-snug">Work the {org.name} repositories</b>
                <span className="block text-cocoa text-[12px] mt-0.5">Follow the repos you care about and track the issues you take, stage by stage, on your own board.</span>
              </span>
              <span className="ml-auto font-mono text-[10.5px] font-bold uppercase tracking-[.1em] text-accent shrink-0">Open board</span>
            </Link>
          </section>

          {/* right rail */}
          <aside className="grid gap-5 max-[1080px]:grid-cols-2">
            <div className="bg-card border border-line rounded-[20px] p-5 shadow-soft">
              <p className="panel-h">{orgProjects.length ? "Completed projects distribution" : "GitHub signal"}</p>
              {orgProjects.length ? (
                <div className="flex items-end gap-2.5 h-[112px] mt-4">
                  {dist.map((y) => {
                    const n = orgProjects.filter((p) => p.y === y).length;
                    return (
                      <div key={y} className="flex-1 flex flex-col items-center gap-1.5 justify-end h-full" title={`${y}: ${n} projects`}>
                        <span className="font-mono text-[9.5px] font-bold text-cocoa">{n}</span>
                        <span className="w-full rounded-t-[6px] pulse-bar bg-accent/75" style={{ height: `${Math.max(8, (n / distMax) * 82)}px`, animationDelay: `-${y % 5}s` }} />
                        <span className="font-mono text-[9.5px] text-dim">{String(y).slice(2)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="card-desc mt-3 text-[12.5px] leading-[1.6]">
                  {fmtCompact(org.stars)} GitHub stars across the top-10 repos · {fmtCompact(org.repos)} public repos{stats ? ` · ${fmtCompact(stats.followers)} followers` : ""}.
                  The project archive has no rows for this org yet - browse its flagship repos below.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-cream border border-line rounded-[14px] px-4 py-3.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[.11em] text-dim">Projects</p>
                <b className="block font-display text-[19px] tracking-[-.02em] mt-1">{fmtCompact(orgProjects.length)}</b>
              </div>
              <div className="bg-cream border border-accent/25 rounded-[14px] px-4 py-3.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[.11em] text-accent">Years active</p>
                <b className="block font-display text-[19px] tracking-[-.02em] text-accent mt-1">{projYears.length}</b>
              </div>
              <div className="bg-cream border border-line rounded-[14px] px-4 py-3.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[.11em] text-dim">Top stack</p>
                <b className="block font-display text-[15px] tracking-[-.02em] mt-1.5 truncate">{projTechTop}</b>
              </div>
              <div className="bg-cream border border-leaf/25 rounded-[14px] px-4 py-3.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[.11em] text-leaf">Tier</p>
                <b className="block font-display text-[19px] tracking-[-.02em] text-leaf mt-1">{tier}</b>
              </div>
            </div>

            <div className="bg-card border border-line rounded-[20px] p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <p className="panel-h !mb-0">Similar organizations</p>
                <Link to="/organizations" className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-accent hover:underline">All</Link>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {similar.map(({ o }) => (
                  <Link key={o.login} to={`/organizations/${o.login}`} title={o.tagline}
                    className="bg-cream border border-line rounded-[13px] p-3 flex flex-col gap-2 hover:border-accent/45 transition-colors">
                    <span className="w-8 h-8 rounded-[9px] bg-white border border-line grid place-items-center overflow-hidden shrink-0">
                      <OrgImg src={avatarOf(o.login, 64)} name={o.login} className="w-5 h-5 object-contain" />
                    </span>
                    <b className="text-ink text-[12px] font-display font-extrabold leading-tight line-clamp-1">{o.name}</b>
                    <span className="font-mono text-[9.5px] text-dim">{fmtCompact(o.stars)} stars</span>
                  </Link>
                ))}
              </div>
            </div>

            <a href={`https://github.com/${org.login}?tab=repositories`} target="_blank" rel="noopener"
              className="bg-cream border border-line rounded-[16px] px-4 py-3.5 flex items-center gap-3 hover:border-accent/45 transition-colors">
              <span className="min-w-0">
                <b className="block text-ink text-[12.5px] font-display font-extrabold leading-snug">Official project ideas list</b>
                <span className="block text-cocoa text-[11px] mt-0.5">Maintainer wishlists on GitHub.</span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] font-bold uppercase tracking-[.1em] text-accent">Ideas</span>
            </a>
          </aside>
        </div>

        {/* ── past projects, from the program archive ── */}
        {orgProjects.length > 0 && (
          <section className="pt-4">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
              <h2 className="font-display font-extrabold text-[24px] tracking-[-.02em]">Past Projects</h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[.12em] text-cocoa bg-cream border border-line rounded-full px-3 py-1.5">{fmtCompact(orgProjects.length)} total projects</span>
            </div>
            <p className="text-cocoa text-[13px] leading-[1.6] mb-5 max-w-[680px]">
              Showing {fmtCompact(ppList.length)} of {fmtCompact(orgProjects.length)} projects. Click any project card for scope, mentors and the accepted-project record.
            </p>
            <div className="flex gap-2 flex-wrap items-center mb-4">
              <button onClick={() => setPpYear("all")}
                className={`text-[12px] font-semibold rounded-full px-3.5 py-1.5 border transition-all cursor-pointer ${ppYear === "all" ? "bg-coffee border-coffee text-foam" : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"}`}>All Years</button>
              {projYears.map((y) => (
                <button key={y} onClick={() => setPpYear(String(y))}
                  className={`text-[12px] font-semibold rounded-full px-3.5 py-1.5 border transition-all cursor-pointer ${ppYear === String(y) ? "bg-coffee border-coffee text-foam" : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"}`}>{y}</button>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap items-center mb-6">
              <input value={ppQ} onChange={(e) => setPpQ(e.target.value)} placeholder="Search this org's projects…" aria-label="Search projects"
                className="flex-1 min-w-[220px] max-w-[360px] bg-card border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.16)]" />
              <select value={ppDiff} onChange={(e) => setPpDiff(e.target.value)} aria-label="Filter by difficulty"
                className="bg-card border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none select-warm pr-8 cursor-pointer">
                <option value="all">All Difficulties</option>
                <option value="small">Beginner · small</option>
                <option value="medium">Intermediate · medium</option>
                <option value="large">Advanced · large</option>
              </select>
              {(ppYear !== "all" || ppDiff !== "all" || ppQ) && (
                <button onClick={() => { setPpYear("all"); setPpDiff("all"); setPpQ(""); }}
                  className="font-mono text-[10.5px] font-bold uppercase tracking-[.1em] text-accent hover:underline cursor-pointer">Clear</button>
              )}
            </div>
            {ppList.length ? (
              <div className="grid grid-cols-3 gap-4 max-[1150px]:grid-cols-2 max-[700px]:grid-cols-1">
                {ppList.slice(0, 30).map((p) => {
                  const hours = p.s === "small" ? 175 : p.s === "large" ? 450 : 350;
                  return (
                    <a key={`${p.program ?? "g"}-${p.u}`} href={p.url ?? `${GSOC_URL}/programs/${p.y}/projects/${p.u}`} target="_blank" rel="noreferrer"
                      className="group bg-card border border-line rounded-[18px] p-[18px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/45">
                      <div className="flex items-start gap-3">
                        <h3 className="card-title text-[14.5px] leading-snug line-clamp-2 flex-1">{p.t}</h3>
                        <span className={`font-mono text-[9px] font-bold uppercase tracking-[.08em] px-2 py-1 rounded-full border shrink-0 ${PP_BADGE[p.s] ?? PP_BADGE.medium}`}>{PP_LABEL[p.s] ?? "MEDIUM"}</span>
                      </div>
                      <p className="font-mono text-[10px] tracking-[.06em] uppercase text-dim mt-2">{p.program ?? "GSoC"} • {p.y}{p.m ? ` • Mentors: ${p.m}` : ""}</p>
                      <p className="card-desc text-[12.5px] leading-[1.55] mt-2 line-clamp-3">{p.b}</p>
                      <div className="flex gap-1.5 flex-wrap mt-3">
                        <span className="font-mono text-[9.5px] font-bold text-rust bg-peach border border-accent/35 rounded-full px-2 py-1">◷ {hours}h ({p.s})</span>
                        <span className="font-mono text-[9.5px] font-bold text-leaf bg-leaf/10 border border-leaf/40 rounded-full px-2 py-1">$ 3.4k–6.0k</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap mt-3">
                        {(p.tt ?? []).slice(0, 3).map((t) => <Chip key={t} tone="lang">{t}</Chip>)}
                      </div>
                      <div className="flex items-center gap-2 mt-auto pt-3.5 border-t border-line/70">
                        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.08em] text-accent group-hover:underline">More Details</span>
                        <span className="ml-auto text-dim group-hover:text-accent transition-colors">{IC_TERMINAL}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-cocoa text-[13.5px] border border-dashed border-line rounded-[18px] bg-cream py-10 text-center">
                Nothing matches those filters - <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={() => { setPpYear("all"); setPpDiff("all"); setPpQ(""); }}>clear them</button>.
              </p>
            )}
            {ppList.length > 30 && (
              <p className="font-mono text-[10.5px] text-dim mt-4">Showing the 30 newest matches of {fmtCompact(ppList.length)} - narrow with a year or search.</p>
            )}
          </section>
        )}

        {/* ── the project list is the end of the page; this panel only covers orgs the archive has no rows for ── */}
        {orgProjects.length === 0 && real.length > 0 && (
          <section className="bg-card border border-line rounded-[18px] overflow-hidden shadow-soft">
            <h2 className="px-[18px] py-3.5 border-b border-liness panel-h flex items-center gap-2.5">
              Repositories on GitHub
              <span className="font-mono text-[11px] text-dim font-medium">live from github.com/{org.login}, ranked by stars</span>
              <a href={`https://github.com/${org.login}?tab=repositories`} target="_blank" rel="noopener"
                className="ml-auto font-mono text-[10.5px] font-bold uppercase tracking-[.1em] text-accent hover:underline">All {fmtCompact(org.repos)} repos</a>
            </h2>
            <div className="p-[18px] grid grid-cols-2 gap-3.5 max-[840px]:grid-cols-1">
              {real.map((r) => (
                <a key={r.repo} href={r.url} target="_blank" rel="noopener"
                  className="bg-cream border border-line rounded-[14px] p-4 flex flex-col gap-2 transition-all hover:-translate-y-px hover:border-accent/40">
                  <div className="flex items-center gap-2.5">
                    <span className="text-accent shrink-0">{IC_REPO}</span>
                    <b className="card-title text-[14px] truncate">{r.repo.split("/")[1]}</b>
                    <span className="ml-auto flex items-center gap-3 font-mono text-[10.5px] text-dim shrink-0">
                      <span className="flex items-center gap-1.5">
                        <i className="w-[9px] h-[9px] rounded-full not-italic" style={{ background: LANG_COLORS[r.lang] ?? "#a09282" }} />
                        {r.lang}
                      </span>
                      <span className="flex items-center gap-1 text-honey"><Ic d={STAR_D} size={12} extra={<path d={STAR_D} fill="currentColor" stroke="none" opacity=".9" />} />{fmtCompact(r.stars)}</span>
                      <span className="flex items-center gap-1">{IC_FORK}{fmtCompact(r.forks)}</span>
                    </span>
                  </div>
                  <p className="text-cocoa text-[12.5px] leading-[1.6] line-clamp-2">{r.desc || "No description set on GitHub."}</p>
                  {r.issues > 0 && (
                    <span className="font-mono text-[10px] text-dim">{fmtCompact(r.issues)} open issues · good place to start if you want to contribute</span>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── the page ends with the project list; this only speaks when there was no list ── */}
        {orgProjects.length === 0 && real.length === 0 && (
          <p className="text-cocoa text-[13.5px] border border-dashed border-line rounded-[18px] bg-cream py-10 text-center">
            {org.name} has no accepted projects in the five-year archive and no live repository snapshot yet.
          </p>
        )}
      </div>
    </>
  );
}
