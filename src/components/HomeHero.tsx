"use client";
/* ══ HomeHero.tsx — the front page opens on the product ════════
   An ossium-style stage, three rectangles deep: a dotted registration frame
   with "+" marks on the page background, the nature landscape inset inside
   it, and the product window sitting on the photograph with a light hairline
   all the way around it so the image shows on every side. The window is not
   a picture of the product, it is the product's own screens drawn from the
   same data the real pages use, and the rail on its left actually works:
   click Organizations and the panel becomes the organizations grid, click
   Leaderboard and it becomes the ranking.

   The landscape is one of two photographs and the theme picks it: the glacier
   under the northern lights in the dark theme, the snow range at dawn in the
   light one. It never rotates on its own.
   ═════════════════════════════════════════════════════════════ */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/lib/router";
import { REPOS } from "../data/repos";
import { ORGS, PROGRAMS } from "../data/orgs";
import { CRAWL } from "../data/crawlStats";
import { ISSUE_SIGNALS } from "../data/issueSignals";
import { LEADERS } from "../data/leaderboard";
import { avatarOf, fmtCompact, byStars } from "../lib/util";
import { STATS } from "../lib/siteStats";
import { DP } from "../lib/dash/shared";
import { useStore } from "../lib/store";
import { Word, btn, OrgImg, Logo } from "./ui";
import { sceneFor } from "./HorizonBackdrop";

/* the orgs whose public data makes up the index */
const PROOF = ["google", "kubernetes", "vercel", "huggingface", "freeCodeCamp"];

const PAGES = Math.ceil(CRAWL.issues / 25);

/* real rows, sliced once at module load so the panels never re-sort */
const TOP_ISSUES = (() => {
  const seen = new Set<string>();
  const picked = [];
  for (const i of ISSUE_SIGNALS) {
    if (seen.has(i.repo)) continue;
    seen.add(i.repo);
    picked.push(i);
    if (picked.length === 3) break;
  }
  return picked;
})();
const TOP_ORGS = ORGS.slice(0, 4);
const TOP_LEADERS = LEADERS.slice(0, 5);
const TOP_PROGS = PROGRAMS.slice(0, 4);
const TOP_REPOS = REPOS.slice().sort(byStars).slice(0, 4);

/* the co-pilot panel: pick skills, get repositories that ask for them */
const SKILLS = ["TypeScript", "Python", "Go", "Rust", "React", "Docs"];
function matches(skills: string[]) {
  if (!skills.length) return TOP_REPOS.slice(0, 3);
  const hit = REPOS.filter((r) =>
    skills.some((s) => r.lang === s || r.tags.includes(s) || (s === "Docs" && /doc|guide|readme/i.test(r.desc))));
  return (hit.length ? hit : REPOS).slice().sort(byStars).slice(0, 3);
}

type PanelId = "issues" | "orgs" | "board" | "programs" | "projects" | "copilot";
const RAIL: { id: PanelId; icon: string; text: string; count?: string }[] = [
  { id: "issues", icon: DP.search, text: "Issue finder", count: fmtCompact(CRAWL.issues) },
  { id: "orgs", icon: DP.building, text: "Organizations", count: fmtCompact(STATS.orgs) },
  { id: "board", icon: DP.flag, text: "Leaderboard", count: "100" },
  { id: "programs", icon: DP.calendar, text: "Programs", count: String(PROGRAMS.length) },
  { id: "projects", icon: DP.layers, text: "Projects", count: fmtCompact(STATS.catalog) },
  { id: "copilot", icon: DP.spark, text: "Co-pilot" },
];

const CHIPS = ["Everything", "Python", "Rust", "Go", "beginner-friendly", "unassigned"];

function Ic({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const Row = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`min-w-0 rounded-[10px] border border-line bg-card px-3 md:px-3.5 py-2.5 ${className}`}>{children}</div>
);

const StatLine = ({ k, v }: { k: string; v: string }) => (
  <span className="flex items-baseline gap-1 font-mono text-[9.5px]">
    <span className="text-dim">{k}</span>
    <b className="text-ink font-semibold">{v}</b>
  </span>
);

/* ── the six panels ─────────────────────────────────────────── */
function IssuesPanel() {
  return (
    <>
      <h2 className="font-display font-extrabold text-[14px] md:text-[15px] tracking-[-.015em]">Issue finder</h2>
      <p className="text-[10.5px] md:text-[11px] leading-[1.55] text-dim mt-1 md:mt-0.5">
        <b className="text-accent font-semibold">{fmtCompact(CRAWL.issues)}</b> open issues from {fmtCompact(CRAWL.reposWithIssues)} repositories.
        <span className="hidden md:inline"> Snapshot {CRAWL.crawledAt}.</span>
      </p>
      <div className="flex items-center gap-1.5 mt-2.5 overflow-hidden">
        {CHIPS.map((c, i) => (
          <span key={c} className={`shrink-0 font-mono text-[9px] md:text-[9.5px] rounded-full px-2 md:px-2.5 py-[4px] border ${i > 2 ? "hidden sm:block" : ""} ${i === 0 ? "border-accent/40 bg-peach text-accent" : "border-line bg-card text-cocoa"}`}>{c}</span>
        ))}
      </div>
      <div className="grid gap-2 mt-2.5 md:mt-3">
        {TOP_ISSUES.map((i, k) => {
          const [owner] = i.repo.split("/");
          return (
            <Row key={i.url} className={k === 1 ? "hidden md:block" : k === 2 ? "hidden lg:block" : ""}>
              <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                <OrgImg src={avatarOf(owner, 48)} name={owner} className="w-[18px] h-[18px] rounded-[5px] object-cover bg-sand shrink-0" />
                <span className="font-mono text-[9.5px] text-dim min-w-0 truncate">{i.repo}</span>
                <span className="font-mono text-[9.5px] text-dim shrink-0">#{i.number}</span>
                <span className="ml-auto shrink-0 flex items-center gap-1 font-mono text-[9.5px] text-cocoa">
                  <Ic d={DP.star} size={11} /> {fmtCompact(i.stars)}
                </span>
              </div>
              <p className="text-[11.5px] font-medium text-ink mt-1.5 line-clamp-1">{i.title}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                {i.labels.slice(0, 2).map((l) => (
                  <span key={l} className="font-mono text-[8.5px] rounded-[5px] border border-line bg-cream px-1.5 py-px text-cocoa truncate max-w-[120px]">{l}</span>
                ))}
                {i.beginner && <span className="font-mono text-[8.5px] rounded-[5px] border border-accent/35 bg-peach px-1.5 py-px text-accent">good first issue</span>}
              </div>
              <div className="hidden md:flex flex-wrap items-baseline gap-2.5 pt-2 mt-2 border-t border-dashed border-line">
                <StatLine k="Language" v={i.lang ?? "n/a"} />
                <StatLine k="Last touched" v={i.updated} />
                <StatLine k="Beginner-labelled" v={i.beginner ? "yes" : "no"} />
              </div>
            </Row>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2.5 font-mono text-[9px] text-dim">
        <span className="rounded-[5px] border border-accent/40 bg-peach px-1.5 py-px text-accent">1</span>
        <span className="hidden md:inline">2</span><span className="hidden md:inline">3</span>
        <span className="opacity-60">…</span>
        <span>{fmtCompact(PAGES)}</span>
        <span className="ml-auto max-md:hidden">25 per page</span>
        <span className="ml-auto md:hidden">{fmtCompact(CRAWL.issues - 25)} more</span>
      </div>
    </>
  );
}

function OrgsPanel() {
  return (
    <>
      <h2 className="font-display font-extrabold text-[14px] md:text-[15px] tracking-[-.015em]">Organizations</h2>
      <p className="text-[10.5px] md:text-[11px] text-dim mt-1 md:mt-0.5">{fmtCompact(STATS.orgs)} profiled from their public GitHub record, every one named by a program.</p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {TOP_ORGS.map((o, k) => (
          <Row key={o.login} className={k > 1 ? "hidden md:block" : ""}>
            <div className="flex items-center gap-2.5 min-w-0">
              <OrgImg src={avatarOf(o.login, 64)} name={o.login} className="w-[26px] h-[26px] rounded-[8px] object-cover bg-sand shrink-0" />
              <span className="min-w-0">
                <b className="block text-[11.5px] font-semibold truncate">{o.name}</b>
                <span className="block font-mono text-[9px] text-dim truncate">{o.tagline}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 pt-2 mt-2 border-t border-dashed border-line font-mono text-[9.5px] text-cocoa">
              <span className="text-honey font-bold">★ {fmtCompact(o.stars)}</span>
              <span>{o.repos} repos</span>
              <span className="ml-auto text-dim">{fmtCompact(o.issues)} open</span>
            </div>
          </Row>
        ))}
      </div>
    </>
  );
}

function BoardPanel() {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display font-extrabold text-[14px] md:text-[15px] tracking-[-.015em]">PR leaderboard</h2>
        <span className="font-mono text-[9px] uppercase tracking-[.1em] text-dim">merged · all time</span>
      </div>
      <div className="grid gap-1.5 mt-3">
        {TOP_LEADERS.map((r, k) => (
          <div key={r.login} className={`flex items-center gap-2.5 rounded-[9px] border border-line bg-card px-3 py-2 ${k > 2 ? "hidden md:flex" : ""}`}>
            <span className={`font-mono text-[10px] font-bold w-[18px] ${k === 0 ? "text-accent" : "text-dim"}`}>{String(k + 1).padStart(2, "0")}</span>
            <img src={r.avatar} alt="" loading="lazy" className="w-[20px] h-[20px] rounded-full object-cover bg-sand shrink-0" />
            <span className="min-w-0 flex-1">
              <b className="block text-[11px] font-semibold truncate">{r.name ?? r.login}</b>
              <span className="block font-mono text-[8.5px] text-dim truncate">{r.company ?? r.location ?? r.login}</span>
            </span>
            <span className="font-mono text-[10.5px] font-bold text-accent shrink-0">{fmtCompact(r.merged_total ?? 0)}</span>
          </div>
        ))}
      </div>
      <p className="font-mono text-[9px] text-dim mt-2.5">Counts are GitHub search totals per author, humans only. Bots are filtered out.</p>
    </>
  );
}

const PSTATUS: Record<string, string> = {
  live: "text-accent border-accent/45 bg-peach",
  upcoming: "text-denim border-denim/40 bg-denim/8",
  closed: "text-dim border-line bg-cream",
};

function ProgramsPanel() {
  return (
    <>
      <h2 className="font-display font-extrabold text-[14px] md:text-[15px] tracking-[-.015em]">Programs</h2>
      <p className="text-[10.5px] md:text-[11px] text-dim mt-1 md:mt-0.5">{PROGRAMS.length} open-source programs on one calendar.</p>
      <div className="grid gap-1.5 mt-3">
        {TOP_PROGS.map((p, k) => (
          <div key={p.id} className={`flex items-center gap-2.5 rounded-[9px] border border-line bg-card px-3 py-2 ${k > 2 ? "hidden md:flex" : ""}`}>
            <img src={avatarOf(p.owner, 48)} alt="" loading="lazy" className="w-[20px] h-[20px] rounded-[6px] object-cover bg-sand shrink-0" />
            <span className="min-w-0 flex-1">
              <b className="block text-[11px] font-semibold truncate">{p.name}</b>
              <span className="block font-mono text-[8.5px] text-dim truncate">{p.window}</span>
            </span>
            <span className={`shrink-0 font-mono text-[8.5px] font-bold uppercase tracking-[.08em] px-2 py-[3px] rounded-full border ${PSTATUS[p.status]}`}>{p.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectsPanel() {
  return (
    <>
      <h2 className="font-display font-extrabold text-[14px] md:text-[15px] tracking-[-.015em]">Project catalog</h2>
      <p className="text-[10.5px] md:text-[11px] text-dim mt-1 md:mt-0.5">{fmtCompact(STATS.catalog)} repositories indexed by language, topic and stars.</p>
      <div className="grid gap-1.5 mt-3">
        {TOP_REPOS.map((r, k) => {
          const [owner, name] = r.repo.split("/");
          return (
            <div key={r.repo} className={`flex items-center gap-2.5 rounded-[9px] border border-line bg-card px-3 py-2 ${k > 2 ? "hidden md:flex" : ""}`}>
              <OrgImg src={avatarOf(owner, 48)} name={owner} className="w-[20px] h-[20px] rounded-[6px] object-cover bg-sand shrink-0" />
              <span className="min-w-0 flex-1">
                <b className="block text-[11px] font-semibold truncate">{name}</b>
                <span className="block font-mono text-[8.5px] text-dim truncate">{r.lang} · {r.license}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold text-honey">★ {fmtCompact(r.stars)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CopilotPanel() {
  const [picked, setPicked] = useState<string[]>(["TypeScript"]);
  const hits = useMemo(() => matches(picked), [picked]);
  return (
    <>
      <h2 className="font-display font-extrabold text-[14px] md:text-[15px] tracking-[-.015em]">Co-pilot</h2>
      <p className="text-[10.5px] md:text-[11px] text-dim mt-1 md:mt-0.5">Pick what you already know. It shortlists repositories asking for exactly that.</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {SKILLS.map((s) => {
          const on = picked.includes(s);
          return (
            <button key={s} type="button" onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
              className={`font-mono text-[9.5px] rounded-full px-2.5 py-[4px] border cursor-pointer transition-colors ${on ? "border-accent/45 bg-peach text-accent" : "border-line bg-card text-cocoa hover:border-accent/40"}`}>
              {s}
            </button>
          );
        })}
      </div>
      <div className="grid gap-1.5 mt-3">
        {hits.map((r) => {
          const [owner, name] = r.repo.split("/");
          return (
            <div key={r.repo} className="flex items-center gap-2.5 rounded-[9px] border border-line bg-card px-3 py-2">
              <OrgImg src={avatarOf(owner, 48)} name={owner} className="w-[20px] h-[20px] rounded-[6px] object-cover bg-sand shrink-0" />
              <span className="min-w-0 flex-1">
                <b className="block text-[11px] font-semibold truncate">{name}</b>
                <span className="block font-mono text-[8.5px] text-dim truncate">{r.lang} · {fmtCompact(r.issues)} open issues</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold text-honey">★ {fmtCompact(r.stars)}</span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[9px] text-dim mt-2.5">Signed in, it reads your resume and your saved repos too. Here it only uses what you click.</p>
    </>
  );
}

const PANELS: Record<PanelId, () => ReactNode> = {
  issues: IssuesPanel,
  orgs: OrgsPanel,
  board: BoardPanel,
  programs: ProgramsPanel,
  projects: ProjectsPanel,
  copilot: CopilotPanel,
};

/* ── the window ─────────────────────────────────────────────── */
function BoardPreview() {
  const [panel, setPanel] = useState<PanelId>("issues");
  const Active = PANELS[panel];
  return (
    <div className="board-ring">
      <figure className="bg-card/70 backdrop-blur-[2px] rounded-[14px] p-1.5 sm:p-3 md:p-[14px] shadow-lift">
        <div className="md:aspect-[16/9] overflow-hidden rounded-[10px] border border-line bg-paper flex flex-col text-left">
          {/* app top bar */}
          <div className="shrink-0 h-[40px] md:h-[44px] flex items-center gap-2.5 px-3 md:px-3.5 border-b border-line bg-card">
            <Logo size={20} />
            <span className="font-display font-extrabold text-[12.5px] md:text-[13px] tracking-[-.02em] shrink-0">
              cyrus<span className="text-accent">.ai</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-dim border border-line rounded-full px-2 py-[3px]">
              <i className="not-italic w-[5px] h-[5px] rounded-full bg-accent" />
              Live index
            </span>
            <span className="ml-auto flex items-center gap-2.5 min-w-0">
              <span className="hidden md:flex items-center gap-2 w-[186px] text-[11px] text-dim bg-cream border border-line rounded-full px-3 py-[4px]">
                <Ic d={DP.search} size={12} />
                <span className="truncate">Search issues, repos, orgs</span>
                <kbd className="ml-auto font-mono text-[8.5px] border border-line rounded-[4px] px-1 py-px">⌘K</kbd>
              </span>
              <span className="w-[22px] h-[22px] rounded-full grid place-items-center bg-clay border border-line text-dim shrink-0">
                <Ic d={DP.sun} size={11} />
              </span>
              <span className="hidden sm:grid w-[22px] h-[22px] rounded-full bg-cream border border-line place-items-center font-mono text-[8.5px] font-bold text-dim shrink-0">?</span>
            </span>
          </div>

          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* the rail: real buttons, real panels */}
            <nav aria-label="Preview sections"
              className="hero-rail shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-[176px] md:border-r border-line md:bg-sand px-2.5 md:px-2.5 py-2 md:py-3 border-b md:border-b-0">
              {RAIL.map((it) => {
                const on = it.id === panel;
                return (
                  <button key={it.id} type="button" onClick={() => setPanel(it.id)} aria-current={on ? "page" : undefined}
                    className={`relative flex items-center gap-2 rounded-[8px] px-2.5 md:px-2 py-[6px] md:py-[5px] text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${on ? "bg-clay text-ink" : "text-cocoa hover:bg-clay/60 hover:text-ink"}`}>
                    {on && <i className="not-italic absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[13px] rounded-l-full bg-accent max-md:hidden" />}
                    <span className={on ? "text-accent shrink-0" : "shrink-0"}><Ic d={it.icon} size={12} /></span>
                    <span className="truncate">{it.text}</span>
                    {it.count && <span className={`ml-auto font-mono text-[9px] shrink-0 ${on ? "text-accent" : "text-dim"}`}>{it.count}</span>}
                  </button>
                );
              })}
            </nav>

            {/* the panel */}
            <div className="flex-1 min-w-0 px-3.5 md:px-5 py-3 md:py-3.5 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={panel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.22, 0.8, 0.36, 1] }}>
                  <Active />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* right rail: the index, and the windows it is in */}
            <aside className="hidden xl:block w-[212px] shrink-0 border-l border-line bg-card px-3 py-3 overflow-hidden">
              <b className="block font-mono text-[8.5px] uppercase tracking-[.14em] text-dim mb-2">The index now</b>
              {[[fmtCompact(STATS.issues), "open issues"], [fmtCompact(STATS.issueRepos), "repos with live issues"], [fmtCompact(STATS.orgs), "organizations"], [fmtCompact(STATS.beginnerIssues), "beginner-labelled"], [fmtCompact(STATS.archiveRows), "archived projects"]].map(([v, l]) => (
                <div key={l} className="flex items-baseline justify-between gap-2 py-[6px] border-b border-liness last:border-0">
                  <span className="font-display font-bold text-[12px] text-accent">{v}</span>
                  <span className="text-[10px] text-cocoa text-right">{l}</span>
                </div>
              ))}
              <b className="block font-mono text-[8.5px] uppercase tracking-[.14em] text-dim mt-4 mb-2">Program windows</b>
              {PROGRAMS.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-[5px] border-b border-liness last:border-0">
                  <img src={avatarOf(p.owner, 40)} alt="" loading="lazy" className="w-[14px] h-[14px] rounded-[4px] object-cover bg-sand shrink-0" />
                  <span className="min-w-0">
                    <b className="block text-[10.5px] font-semibold text-ink truncate">{p.name}</b>
                    <span className="block text-[9px] text-dim truncate">{p.window}</span>
                  </span>
                </div>
              ))}
              <p className="mt-4 pt-3 border-t border-liness font-mono text-[8.5px] uppercase tracking-[.1em] leading-[1.9] text-dim">
                {fmtCompact(STATS.crawlRepos)} repos read in the crawl · {CRAWL.languages} languages · rebuilt {STATS.crawledAt}
              </p>
            </aside>
          </div>
        </div>
        <figcaption className="mt-3 md:mt-3.5 mb-0.5 text-center font-mono text-[9.5px] md:text-[10.5px] uppercase tracking-[.1em] md:tracking-[.12em] text-cocoa">
          <span className="max-md:hidden">The board, live on {fmtCompact(CRAWL.issues)} real issues · click the rail, it works</span>
          <span className="md:hidden">{fmtCompact(CRAWL.issues)} real issues · the rail works</span>
        </figcaption>
      </figure>
    </div>
  );
}

/* ── the hero ───────────────────────────────────────────────── */

export default function HomeHero() {
  const { theme } = useStore();
  const still = useReducedMotion();
  /* one photograph, chosen by the theme the page is being read in */
  const scene = sceneFor(theme);

  return (
    <header id="hero" className="relative overflow-hidden pt-[72px] pb-16 max-[700px]:pt-12 max-[700px]:pb-12">
      <div className="hero-glow" />
      <div className="hero-pattern" />

      <div className="relative z-[1] max-w-[1060px] mx-auto px-5 sm:px-6 text-center">
        <span className="reveal inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-[7px] font-mono text-[10.5px] uppercase tracking-[.14em] text-cocoa max-[700px]:gap-1.5 max-[700px]:px-3 max-[700px]:py-[6px] max-[700px]:text-[8.5px] max-[700px]:tracking-[.09em]">
          <i aria-hidden className="not-italic block w-[8px] h-[8px] shrink-0 rounded-[2px] bg-accent animate-hero-diamond shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_18%,transparent)] max-[700px]:w-[7px] max-[700px]:h-[7px]" />
          Open source discovery for GitHub developers
        </span>

        <h1 className="font-display font-extrabold tracking-[-.03em] leading-[1.04] mt-6 text-[clamp(38px,6vw,74px)] max-[700px]:mt-5 max-[700px]:text-[clamp(29px,7.9vw,35px)] max-[700px]:leading-[1.06] max-[700px]:tracking-[-.025em]">
          <span className="block reveal" style={{ animationDelay: ".08s" }}>Discover open source.</span>
          <span className="block reveal max-[700px]:mt-1" style={{ animationDelay: ".2s" }}>Ship what <Word>matters</Word>.</span>
        </h1>

        <p className="reveal mx-auto mt-4 max-w-[560px] text-cocoa text-[15.5px] leading-[1.6] max-[700px]:mt-3 max-[700px]:text-[14px] max-[700px]:leading-[1.55]" style={{ animationDelay: ".34s" }}>
          {fmtCompact(STATS.issues)} real open issues, {fmtCompact(STATS.archive)} archived program projects, {PROGRAMS.length} open-source programs, one contribution board.
        </p>

        {/* ossium keeps its two actions on one row on phones, so the pair
            shrinks to fit instead of stacking */}
        <div className="reveal flex gap-3 justify-center flex-wrap mt-8 max-[700px]:gap-2.5 max-[700px]:mt-6" style={{ animationDelay: ".46s" }}>
          {/* the dark variant exists site-wide and flips to green on hover; on
              the hero's primary action that read as the button changing into a
              different control, so it stays ink and moves instead */}
          <Link to="/issues" className={btn("dark", "lg", "max-[700px]:px-[18px] max-[700px]:py-[11px] max-[700px]:text-[13.5px] max-[700px]:gap-1.5 hover:bg-ink! hover:text-paper! hover:border-ink! hover:-translate-y-px")}>
            Start searching
            <span className="grid place-items-center w-[22px] h-[22px] rounded-full bg-paper text-ink shrink-0 max-[700px]:w-[19px] max-[700px]:h-[19px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </Link>
          <Link to="/projects" className={btn("outline", "lg", "max-[700px]:px-[18px] max-[700px]:py-[11px] max-[700px]:text-[13.5px]")}>Browse programs</Link>
        </div>

        <div className="reveal flex items-center justify-center gap-3.5 mt-6 flex-wrap max-[700px]:gap-2.5 max-[700px]:mt-5" style={{ animationDelay: ".58s" }}>
          <span className="flex items-center">
            {PROOF.map((o, i) => (
              <OrgImg key={o} src={avatarOf(o, 64)} name={o} title={o}
                className={`w-[30px] h-[30px] rounded-full object-cover bg-sand ring-2 ring-paper ${i ? "-ml-2.5" : ""}`} />
            ))}
            <span className="-ml-2.5 w-[30px] h-[30px] rounded-full ring-2 ring-paper bg-clay grid place-items-center font-mono text-[9.5px] font-bold text-cocoa">
              +{STATS.orgs - PROOF.length}
            </span>
          </span>
          <span className="text-[12.5px] text-dim">
            Indexed from <b className="text-cocoa font-semibold">{fmtCompact(STATS.orgs)} organizations</b> on GitHub
          </span>
        </div>
      </div>

      {/* the board, embedded in a landscape inside a registration frame */}
      <div className="hero-stage reveal mt-9 md:mt-11 pb-3" style={{ animationDelay: ".68s" }}>
        <div className="max-w-[1220px] mx-auto px-5 sm:px-6">
          <div className="hero-field frame">
            <span className="mark tr" aria-hidden="true">+</span>
            <span className="mark bl" aria-hidden="true">+</span>
            <div className="hero-photo">
              <AnimatePresence mode="wait">
                <motion.div key={scene.id} className="hero-scene"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: still ? 0 : 0.9, ease: "easeInOut" }}>
                  <img src={scene.img} alt="" decoding="async" />
                </motion.div>
              </AnimatePresence>
              <div className="hero-photo-inner">
                <BoardPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
