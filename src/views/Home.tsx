"use client"
/* ══ Home.tsx — the open-source discovery front page ═════════
   Hero (HomeHero.tsx) leads with the index itself: real open issues, crawled
   from the GitHub API. Then what the product does, the programs that fund
   contributors, the projects and orgs behind them, and the questions
   a first-time visitor actually asks. No hackathons, no artifacts.
   ════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "@/lib/router";
import HomeHero from "../components/HomeHero";
import { ORGS, PROGRAMS } from "../data/orgs";
import { REPOS } from "../data/repos";
import { CRAWL } from "../data/crawlStats";
import { STATS } from "../lib/siteStats";
import type { Program } from "../lib/types";
import { avatarOf, fmt, byStars, CAT_META, reduceMotion } from "../lib/util";
import { Word, SectionTag, btn, OrgImg, Portrait } from "../components/ui";
import { useStore } from "../lib/store";

/* ── shared bits ──────────────────────────────────────────── */
const I = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icon = ({ d, extra, size = 20 }: { d: string; extra?: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...I}><path d={d} />{extra}</svg>
);
const ICONS = {
  issue: <Icon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5.5v4m0 3h.01" />,
  repo: <Icon d="M4 21V6l8-3v18M12 21h8V10l-8-2.4M7 10h1M7 14h1M7 18h1M16 13h1M2 21h20" />,
  pull: <Icon d="M6 3v12m0 0a3 3 0 1 0 3 3H6Zm0-15a3 3 0 1 0-3 3h3Zm12 21v-6m0 0a3 3 0 1 0-3-3v3Z" extra={<circle cx="18" cy="6" r="3" />} />,
  sponsor: <Icon d="M12 20s-7-4.4-7-9.3A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
  calendar: <Icon d="M4 6.5h16v14H4zM8 3v5m8-5v5M4 11h16" />,
  board: <Icon d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />,
  search: <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4" />,
  spark: <Icon d="M12 3.5 13.9 9l5.6 2-5.6 2L12 20.5 10.1 13 4.5 11l5.6-2Z" />,
  tray: <Icon d="M12 3v11m0 0 4-4m-4 4-4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />,
  merged: <Icon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3.2 9.3 2.3 2.3 4.4-4.6" />,
};

/* Every section below the hero fades and rises into place once, the first
   time it is actually on screen. Reduced-motion users get the same layout
   with the travel taken out. */
const Section = ({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) => (
  <motion.section id={id}
    className={`max-w-[1240px] mx-auto px-6 pt-[92px] scroll-mt-24 ${className}`}
    initial={{ opacity: 0, y: 26 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-70px" }}
    transition={{ duration: 0.55, ease: [0.22, 0.8, 0.36, 1] }}>
    {children}
  </motion.section>
);

const Head = ({ tag, title, sub, side }: { tag: string; title: ReactNode; sub?: string; side?: ReactNode }) => (
  <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
    <div>
      <SectionTag>{tag}</SectionTag>
      <h2 className="font-display font-extrabold tracking-[-.022em] leading-[1.06] mt-3 text-[clamp(30px,3.8vw,46px)]">{title}</h2>
      {sub && <p className="text-cocoa mt-3.5 text-[16px] leading-[1.65] max-w-[580px]">{sub}</p>}
    </div>
    {side && <div className="flex items-center gap-3 shrink-0">{side}</div>}
  </div>
);

/* ── what you can do ──────────────────────────────────────── */
/* live: false marks the two capabilities still being built, so the grid
   never reads as a list of things the product already does. */
const FEATURES: [ReactNode, string, string, string, boolean][] = [
  [ICONS.issue, "Find an issue you can actually take", "Search every open issue in the snapshot by keyword, language, organization and label. Beginner-labelled and nobody-assigned are filters, not guesses.", "/issues", true],
  [ICONS.repo, "Read a repository before you touch it", "Every project page pulls the README, the guidelines, the open work and the contributor pulse, so you know what you are walking into.", "/organizations", true],
  [ICONS.calendar, `Track the ${PROGRAMS.length} programs that pay`, "Application, bonding and coding windows for GSoC, Outreachy, LFX, MLH, FOSSEE and more, on one calendar.", "#programs", true],
  [ICONS.pull, "See who ships, not who shouts", "A leaderboard built from merged pull requests, with open PRs and reviews counted separately so one number cannot be gamed.", "/dashboard", false],
  [ICONS.sponsor, "Get discovered by sponsors", "A directory of maintainers who opted in, with their verified public record and their own funding links.", "/dashboard", false],
  [ICONS.board, "Run your own contribution desk", "Pin repositories, keep issues in stages from saved to shipped, and watch what changed since you last looked.", "/dashboard", true],
];

function Features() {
  const live = FEATURES.filter(([, , , , l]) => l);
  const soon = FEATURES.filter(([, , , , l]) => !l);
  return (
    <Section id="features">
      <Head tag="What cyrus does" title={<>Six tools, one <Word>contribution</Word> workflow.</>}
        sub="Discovery, understanding and tracking, wired to the same GitHub data. Nothing here is a mock." />
      <div className="grid grid-cols-3 gap-[14px] max-[1020px]:grid-cols-2 max-[640px]:grid-cols-1">
        {[...live, ...soon].map(([ic, t, d, to, isLive]) => (
          <Link key={t} to={to}
            className={`group relative flex flex-col gap-3 rounded-[16px] border p-[22px] transition-all duration-200 ${isLive ? "border-line bg-card hover:border-accent hover:-translate-y-[3px] hover:shadow-lift" : "border-dashed border-rule bg-transparent"}`}>
            <span className="flex items-center justify-between gap-3">
              <span className={`w-[38px] h-[38px] rounded-[11px] grid place-items-center border ${isLive ? "text-accent border-accent/30 bg-peach" : "text-dim border-line bg-cream"}`}>{ic}</span>
              {isLive
                ? <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-accent">Live</span>
                : <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-dim">In build</span>}
            </span>
            <b className="panel-h-lg leading-[1.28]">{t}</b>
            <p className="card-desc">{d}</p>
            {isLive && <span className="mt-auto font-mono text-[10.5px] uppercase tracking-[.1em] text-accent opacity-0 group-hover:opacity-100 transition-opacity">Open ›</span>}
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ── programs ─────────────────────────────────────────────── */
const PSTATUS: Record<Program["status"], string> = {
  live: "text-accent border-accent/45 bg-peach",
  upcoming: "text-denim border-denim/40 bg-denim/8",
  closed: "text-dim border-line bg-cream",
};
const PLABEL: Record<Program["status"], string> = { live: "Open now", upcoming: "Upcoming", closed: "Closed" };

function ProgCard({ p }: { p: Program }) {
  return (
    <a href={p.url} target="_blank" rel="noopener"
      className="group flex flex-col gap-3.5 rounded-[16px] border border-line bg-card p-[22px] transition-all duration-200 hover:border-accent hover:-translate-y-[3px] hover:shadow-lift">
      <span className="flex items-center justify-between gap-3">
        <span className="w-10 h-10 rounded-[11px] bg-cream border border-line grid place-items-center overflow-hidden">
          <img src={avatarOf(p.owner, 64)} alt="" className="w-[24px] h-[24px] object-contain" loading="lazy" />
        </span>
        <span className={`font-mono text-[9px] font-bold tracking-[.1em] uppercase px-2.5 py-[4px] rounded-full border ${PSTATUS[p.status]}`}>{PLABEL[p.status]}</span>
      </span>
      <div>
        <h3 className="card-title text-[16.5px] leading-[1.3] group-hover:text-accent transition-colors">{p.name}</h3>
        <p className="font-mono text-[10px] tracking-[.06em] uppercase text-dim mt-1.5">{p.window}</p>
      </div>
      <p className="card-desc flex-1">{p.tag}</p>
      {/* the pay line only. The org/project counts used to sit to the right of
          it, which made every card in the shelf read like a stat block. */}
      <div className="flex items-end justify-between gap-3 pt-3 border-t border-dashed border-line">
        <span className="font-display font-bold text-[15px]">{p.pay}
          <small className="block font-mono text-[9px] font-medium text-dim tracking-[.08em] uppercase mt-0.5">{p.payNote}</small></span>
      </div>
    </a>
  );
}

function Programs() {
  /* open windows first, then what is opening, then closed cycles */
  const RANK: Record<Program["status"], number> = { live: 0, upcoming: 1, closed: 2 };
  const shelf = useMemo(
    () => PROGRAMS.slice().sort((a, b) => RANK[a.status] - RANK[b.status]).slice(0, 6), []);
  return (
    <Section id="programs">
      <Head tag="Paid & mentored" title={<>Programs that <Word>fund</Word> contributors.</>}
        sub={`${PROGRAMS.length} tracked programs with their application windows. Where a program pays nothing or is a grant for maintainers, the card says so.`}
        side={<Link className={btn("outline", "md")} to="/projects">All programs</Link>} />
      <div className="grid grid-cols-3 gap-[14px] max-[1020px]:grid-cols-2 max-[640px]:grid-cols-1">
        {shelf.map((p) => <ProgCard key={p.id} p={p} />)}
      </div>
    </Section>
  );
}

/* ── the contributor year (Gantt) ─────────────────────────── */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* Pinned to the crawl date rather than the clock: the marker, the "Today"
   label and the issue counts in the hero all come from the same snapshot,
   so they cannot drift apart between a server render and a browser one. */
const AS_OF = new Date(`${CRAWL.crawledAt}T12:00:00`);
const NOW_M = AS_OF.getMonth() + (AS_OF.getDate() - 1) / 31;
const SNAPSHOT = `${MONTHS[AS_OF.getMonth()]} ${AS_OF.getFullYear()}`;

function Timeline() {
  return (
    <Section id="timeline">
      <Head tag="The contributor year" title={<>Every window, <Word>month by month</Word>.</>}
        sub={`Application, selection and coding periods for all ${PROGRAMS.length} programs across 2026.`}
        side={<span className={btn("ghost", "sm")}>Snapshot · {SNAPSHOT}</span>} />
      <div className="frame bg-card/60 p-6 md:p-8 shadow-soft overflow-x-auto">
        <div className="min-w-[780px]">
          <div className="grid grid-cols-[230px_1fr] gap-4 items-center pb-3 border-b border-liness">
            <span className="font-mono text-[10px] tracking-[.12em] uppercase text-dim">Program</span>
            <div className="relative grid grid-cols-12">
              {MONTHS.map((m) => <span key={m} className="font-mono text-[9.5px] text-dim text-center">{m}</span>)}
              <span className="absolute -top-[9px] font-mono text-[9px] font-bold uppercase tracking-[.1em] text-accent whitespace-nowrap -translate-x-1/2" style={{ left: `${(NOW_M / 12) * 100}%` }}>Today</span>
            </div>
          </div>
          {PROGRAMS.map((p) => (
            <div key={p.id} className="grid grid-cols-[230px_1fr] gap-4 items-center py-[9px] border-b border-liness last:border-0">
              <span className="flex items-center gap-2.5 min-w-0">
                <img src={avatarOf(p.owner, 48)} alt="" loading="lazy" className="w-[22px] h-[22px] rounded-[6px] bg-sand object-cover shrink-0" />
                <b className="card-title text-[13px] truncate">{p.name}</b>
              </span>
              <div className="relative h-[26px]">
                {MONTHS.map((_, i) => <i key={i} className="absolute top-0 bottom-0 w-px bg-liness" style={{ left: `${((i + 1) / 12) * 100}%` }} />)}
                {p.phases.map((ph) => {
                  const s = ph.s, e = ph.e > ph.s ? ph.e : ph.e + 12;
                  return (
                    <span key={ph.label} title={`${ph.label} · ${MONTHS[Math.floor(s)]} - ${MONTHS[Math.floor(e) % 12]}`}
                      className={`absolute top-1/2 -translate-y-1/2 h-[17px] rounded-[6px] border transition-transform hover:scale-[1.02] ${ph.active ? "timeline-active" : ""}`}
                      style={{ left: `${(s / 12) * 100}%`, width: `calc(${((e - s) / 12) * 100}% - 3px)`, background: `color-mix(in srgb, ${ph.c} 22%, var(--color-card))`, borderColor: `color-mix(in srgb, ${ph.c} 60%, transparent)` }}>
                      <span className="absolute inset-0 grid place-items-center font-mono text-[8.5px] font-bold text-ink whitespace-nowrap overflow-hidden px-2">{ph.label}</span>
                    </span>
                  );
                })}
                <span className="absolute -top-1 -bottom-1 w-[2px] bg-accent/70 rounded-full z-[2]" style={{ left: `${(NOW_M / 12) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="flex gap-5 flex-wrap pt-4 font-mono text-[10.5px] text-cocoa">
            {[["#3b6ea5", "Applications"], ["#a97b1f", "Selection"], ["#2f7d72", "Bonding / outreach"], ["#3e7d4f", "Coding & internships"]].map(([c, l]) => (
              <span key={l}><i className="inline-block w-2.5 h-2.5 rounded-[4px] mr-1.5 align-[-1px] border" style={{ background: `color-mix(in srgb, ${c} 22%, var(--color-card))`, borderColor: `color-mix(in srgb, ${c} 60%, transparent)` }} />{l}</span>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ── the contributor roadmap ──────────────────────────────────
   Six steps in the order a contributor actually walks them, and every one of
   them is a screen that exists on the board. The strip across the top is the
   sequence; the panel underneath is whichever step you picked. On the right
   is the ink loop - the one decorative thing on this page, silent and
   looping, held back until the section scrolls into view. */
type StepId = "lane" | "setup" | "issue" | "pr" | "merge" | "funded";
const STEPS: {
  id: StepId; label: string; sub: string; icon: keyof typeof ICONS;
  eyebrow: string; title: string; body: string; checks: string[];
  cta: string; to: string;
}[] = [
  {
    id: "lane", label: "Pick a lane", sub: "Organizations", icon: "board", eyebrow: "Step 1 · Choose",
    title: "Start with the project, not the issue",
    body: "An issue is only worth taking if the repository behind it is worth a week of your time. Sort the organizations by the things you can actually check.",
    checks: ["Live counts from each organization's public GitHub profile", "Stack, license and how recently the work moved", "No sponsored placement, no ranking you can buy"],
    cta: "Open the directory", to: "/organizations",
  },
  {
    id: "setup", label: "Set it up", sub: "Git starter", icon: "repo", eyebrow: "Step 2 · Build",
    title: "The clone-to-first-commit part, written out",
    body: "Every project has its own habits. The starter reads the repository's manifest and gives you the commands for that one, in order, so setup stops being the reason you never started.",
    checks: ["Branch naming that matches the issue you claimed", "Install and dev commands taken from the project itself", "The compare link ready when your first commit lands"],
    cta: "Open the git starter", to: "/dashboard/gitstart",
  },
  {
    id: "issue", label: "Find the issue", sub: "Issue finder", icon: "issue", eyebrow: "Step 3 · Claim",
    title: "Good first issues you can still take",
    body: "Half of the advice on the internet is a list of issues nobody assigned anyone to. This one says which are claimed, locked, stale, or already have a pull request pointing at them.",
    checks: ["Assignment and lock state, shown on the card", "How long since the thread moved", "Filtered by language, size and difficulty estimate"],
    cta: "Find an issue", to: "/issues",
  },
  {
    id: "pr", label: "Open the pull", sub: "Draft studio", icon: "tray", eyebrow: "Step 4 · Ship",
    title: "Write the description once, properly",
    body: "The pull request that gets read is the one that gets merged. The studio drafts the sections maintainers ask for from the diff and the repository's own contributing guide.",
    checks: ["Summary, changes, test steps and checklist", "Templates read from the target repository", "Nothing is posted without you pressing the button"],
    cta: "Open the studio", to: "/dashboard/drafts",
  },
  {
    id: "merge", label: "Get it merged", sub: "Leaderboard", icon: "merged", eyebrow: "Step 5 · Land",
    title: "Track the review without living in your inbox",
    body: "Saved issues and repositories tell you what moved while you were away, and the leaderboard keeps the merged work in one dated list instead of twelve browser tabs.",
    checks: ["Merged, open and reviewed counted separately", "A window you set, not a window we picked", "Every row links back to the thread on GitHub"],
    cta: "See the leaderboard", to: "/leaderboard",
  },
  {
    id: "funded", label: "Get funded", sub: "Programs", icon: "sponsor", eyebrow: "Step 6 · Apply",
    title: "Turn the merged work into a paid season",
    body: "The programs that pay stipends run on published calendars. Their windows, their organization lists and their project records are on the same page as the issues you already worked on.",
    checks: [`${PROGRAMS.length} mentored programs with their real windows`, "Each program's own archived project record", "Application dates you can put in your calendar"],
    cta: "Browse the programs", to: "/programs",
  },
];

function Cross({ pos }: { pos: string }) {
  return (
    <span aria-hidden className={`absolute z-[2] h-[11px] w-[11px] ${pos}`}>
      <i className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-rule" />
      <i className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-rule" />
    </span>
  );
}

/* The loop only runs while the plate is on screen and the visitor has not
   asked for less motion. preload="none" plus this means the 245 KB never
   downloads for anyone who scrolls past the section too fast to see it. */
function useInkLoop<T extends HTMLVideoElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { v.pause(); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) void v.play().catch(() => {}); else v.pause(); },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Roadmap() {
  const [step, setStep] = useState<StepId>("lane");
  const s = STEPS.find((x) => x.id === step)!;
  const vid = useInkLoop();
  return (
    <Section id="roadmap">
      <Head tag="The contributor roadmap" title={<>Six steps from an empty <Word>weekend</Word> to merged.</>}
        sub="The order a first contribution actually happens in, and the screen on the board that does each part." />
      <div className="relative rounded-[26px] border border-dashed border-line bg-card/40 overflow-hidden">
        <span aria-hidden className="absolute inset-0 pointer-events-none opacity-60 bg-[linear-gradient(to_right,var(--color-liness)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-liness)_1px,transparent_1px)] [background-size:46px_46px]" />
        <Cross pos="left-[-6px] top-[-6px]" /><Cross pos="right-[-6px] top-[-6px]" />
        <Cross pos="left-[-6px] bottom-[-6px]" /><Cross pos="right-[-6px] bottom-[-6px]" />

        {/* the step strip */}
        <div className="relative flex overflow-x-auto no-scrollbar border-b border-dashed border-line">
          {STEPS.map((x) => {
            const on = x.id === step;
            return (
              <button key={x.id} type="button" onClick={() => setStep(x.id)} aria-pressed={on}
                className="group relative flex min-w-[148px] flex-1 flex-col items-center gap-1.5 px-3 py-6 cursor-pointer transition-opacity last:border-r-0 border-r border-dashed border-line opacity-60 hover:opacity-100 data-[on=true]:opacity-100"
                data-on={on}>
                <span className={`grid h-[38px] w-[38px] place-items-center rounded-[11px] border transition-colors ${on ? "border-accent/60 bg-accent/12 text-accent" : "border-line text-cocoa group-hover:text-ink"}`}>
                  {ICONS[x.icon]}
                </span>
                <b className={`font-display text-[14.5px] leading-none ${on ? "text-ink" : "text-cocoa"}`}>{x.label}</b>
                <span className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-none">{x.sub}</span>
                {on && <span aria-hidden className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent" />}
              </button>
            );
          })}
        </div>

        {/* the step itself */}
        <div className="relative grid grid-cols-[1.05fr_1fr] gap-10 max-[980px]:grid-cols-1 max-[980px]:gap-8">
          <div className="border-r border-dashed border-line px-8 py-12 max-[980px]:border-r-0 max-[980px]:border-b max-[980px]:px-6 max-[980px]:py-9">
            <span className="inline-flex items-center gap-2 rounded-[9px] border border-line bg-card px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[.12em] text-cocoa">
              <span className="text-accent">{ICONS[s.icon]}</span>{s.eyebrow}
            </span>
            <h3 className="font-display font-extrabold tracking-[-.022em] leading-[1.08] text-[clamp(26px,3.1vw,38px)] mt-6 max-w-[440px]">{s.title}</h3>
            <p className="text-cocoa text-[15px] leading-[1.7] mt-5 max-w-[430px]">{s.body}</p>
            <ul className="grid gap-3 list-none mt-8">
              {s.checks.map((c) => (
                <li key={c} className="flex gap-3 text-[13.5px] leading-[1.6] text-cocoa">
                  <span className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[6px] border border-accent/40 bg-accent/10 mt-[2px]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                  {c}
                </li>
              ))}
            </ul>
            <Link to={s.to} className={`${btn("dark", "md")} mt-9`}>{s.cta}</Link>
          </div>

          {/* the plate: the supplied ink loop, silent and looping */}
          <div className="px-8 py-12 max-[980px]:px-6 max-[980px]:py-9">
            <figure className="relative m-0 mx-auto max-w-[560px] overflow-hidden rounded-[16px] border border-line bg-[#050607] shadow-lift">
              <video ref={vid} className="block aspect-square w-full object-cover"
                src="/roadmap-demo.mp4" poster="/roadmap-demo-poster.jpg"
                width={600} height={600} muted loop playsInline preload="none" aria-hidden />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-white/10 bg-black/50 px-4 py-2.5">
                <span className="h-[6px] w-[6px] rounded-full bg-accent" aria-hidden />
                <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-white/70">Silent loop · 2.5 seconds</span>
              </figcaption>
            </figure>
            <p className="font-mono text-[9.5px] uppercase leading-[1.8] tracking-[.1em] text-dim mt-4">
              Pick a step above - the panel on the left is the part that changes.
            </p>
          </div>
        </div>

        {/* everything else the board does */}
        <div className="relative border-t border-dashed border-line">
          <p className="px-8 pt-5 font-mono text-[10px] uppercase tracking-[.16em] text-dim">More on the board</p>
          <div className="grid grid-cols-4 max-[900px]:grid-cols-2">
            {MORE.map((m) => (
              <Link key={m.to} to={m.to}
                className="group flex items-center gap-3 border-r border-dashed border-line px-8 py-5 transition-colors hover:bg-cream/60 last:border-r-0 [&:nth-child(4n)]:border-r-0 max-[900px]:border-b max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-child(n+3)]:border-b-0">
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] border border-line text-cocoa transition-colors group-hover:border-accent/50 group-hover:text-accent">
                  {ICONS[m.icon]}
                </span>
                <span className="min-w-0">
                  <b className="block font-display text-[13.5px] leading-none truncate">{m.label}</b>
                  <span className="block font-mono text-[9.5px] uppercase tracking-[.08em] text-dim mt-1 truncate">{m.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ── projects + organizations ─────────────────────────────── */
const MORE: { label: string; sub: string; icon: keyof typeof ICONS; to: string }[] = [
  { label: "Season calendar", sub: "Every deadline", icon: "calendar", to: "/dashboard/calendar" },
  { label: "Co-pilot", sub: "Matched to you", icon: "spark", to: "/dashboard/matcher" },
  { label: "Repo analyser", sub: "Is it alive", icon: "search", to: "/dashboard/analyser" },
  { label: "Sponsors", sub: "Who gets paid", icon: "sponsor", to: "/sponsors" },
];


function OrgMarquee() {
  const card = (o: (typeof ORGS)[number]) => (
    <Link key={o.login} to={`/organizations/${o.login}`}
      className="shrink-0 w-[250px] flex items-center gap-3 bg-card border border-line rounded-[16px] px-[17px] py-[15px] shadow-soft hover:-translate-y-1 hover:border-accent hover:shadow-lift transition-all">
      <OrgImg src={avatarOf(o.login, 88)} name={o.login} className="w-[42px] h-[42px] rounded-[12px] object-cover bg-sand shrink-0" />
      <span className="min-w-0">
        <b className="block card-title text-[14px] truncate">{o.name}</b>
        <span className="block text-[11.5px] text-cocoa truncate">{o.tagline}</span>
        <span className="font-mono text-[10.5px] text-honey font-bold">★ {fmt(o.stars)} · {o.repos} repos</span>
      </span>
    </Link>
  );
  /* The track is duplicated so the loop has no seam, and the travel per cycle
     is set to exactly one row's width with --marq-shift: cards x (250px card +
     14px gap). Timing the animation from that same width keeps the crawl at one
     calm speed no matter how many organizations sit on it. It used to inherit
     the 46s token while carrying 182 cards per row, roughly 1,000px a second,
     which read as a blur rather than a shelf you can browse.

     The row is full-bleed and has no edge mask: the shelf now runs the whole
     width of the screen, so a card travels from one edge to the other instead
     of fading out in the middle of the page. */
  const CARD = 264;
  const SPEED = 52; /* px per second */
  const top = [...ORGS].sort(byStars);
  const track = (row: ReactNode[], reverse = false) => (
    <div className="overflow-hidden mx-[calc(50%_-_50vw)]">
      <div className={`marq-track animate-marq ${reverse ? "[animation-direction:reverse]" : ""}`}
        style={{
          animationDuration: `${Math.round((row.length * CARD) / SPEED)}s`,
          ["--marq-shift" as string]: `-${row.length * CARD}px`,
        }}>
        {row}
        {row}
      </div>
    </div>
  );
  return (
    <Section id="orgs">
      <Head tag="Where the work is" title={<>Popular <Word>organizations</Word></>}
        sub="Hover to pause, click for the full profile with repositories, issues and contributor stats."
        side={<Link className={btn("dark", "md")} to="/organizations">Browse all</Link>} />
      <div className="flex flex-col gap-3.5">
        {track(top.slice(0, 16).map(card))}
        {track(top.slice(16, 32).map(card), true)}
      </div>
    </Section>
  );
}

function Skills () {
  const cards = useMemo(() => REPOS.slice().sort(byStars).slice(0, 4), []);
  return (
    <Section id="skills">
      <Head tag="Browse good open source projects" title={<>Most-starred in the <Word>catalog</Word>.</>}
        sub={`${fmt(STATS.catalog)} repositories indexed by language, topic and stars, refreshed from the GitHub API.`}
        side={<Link className={btn("outline", "md")} to="/skills">All skills</Link>} />
      <div className="grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {cards.map((r) => {
          const [owner, name] = r.repo.split("/");
          return (
            <Link key={r.repo} to={`/repo/${encodeURIComponent(r.repo)}`}
              className="bg-card border border-line rounded-[16px] p-[22px] flex flex-col gap-3 shadow-soft hover:-translate-y-[4px] hover:shadow-lift hover:border-accent transition-all">
              <div className="flex items-center gap-3">
                <OrgImg src={avatarOf(owner, 96)} name={owner} className="w-10 h-10 rounded-[12px] object-cover bg-sand" />
                <div className="min-w-0"><h3 className="panel-h text-[15.5px] leading-[1.25] truncate">{name}</h3>
                  <span className="font-mono text-[10px] text-dim tracking-[.05em]">{owner}</span></div>
              </div>
              <p className="text-cocoa text-[13px] leading-[1.6] flex-1 line-clamp-3">{r.desc}</p>
              <div className="flex items-center justify-between gap-2.5">
                <span className="font-mono text-[10.5px] font-bold rounded-full px-2.5 py-1 border border-accent/30 bg-peach text-accent">{CAT_META[r.cat]?.label ?? r.cat}</span>
                <span className="font-mono text-[11.5px] font-bold text-honey">★ {fmt(r.stars)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

/* ── the numbers the chrome quotes, all from src/lib/siteStats ───── */
const ARCHIVE_AS_OF = "2026-10-25";
function Band() {
  const cells: [string, string][] = [
    [fmt(STATS.issues), "open issues indexed"],
    [fmt(STATS.archive), "program projects archived"],
    [fmt(STATS.orgs), "organizations profiled"],
    [String(STATS.programs), "programs on the calendar"],
  ];
  return (
    <Section id="band" className="!pt-[80px]">
      <div className="frame bg-cream/50 grid grid-cols-4 gap-5 px-[30px] py-[40px] text-center max-[860px]:grid-cols-2 max-[860px]:gap-8">
        {cells.map(([n, l]) => (
          <div key={l}>
            <b className="font-display block text-[clamp(30px,3.4vw,40px)] font-extrabold tracking-[-.022em] text-accent">{n}</b>
            <span className="text-cocoa text-[13px]">{l}</span>
          </div>
        ))}
      </div>
      <p className="text-center font-mono text-[10.5px] text-dim mt-4">
        Issues and repositories are a snapshot of the GitHub API taken {CRAWL.crawledAt}; the project
        archive is the {STATS.archivePrograms} program records read on {ARCHIVE_AS_OF}.
      </p>
    </Section>
  );
}

/* ── voices ───────────────────────────────────────────────── */
/* PLACEHOLDER CONTENT. These are illustrative quotes written for the layout,
   not statements from real users. Replace each entry with a quote someone has
   actually given us before this section ships to a public audience.
   Each one is *about* a single organization, and that organization's own mark
   sits on the card so a reader knows which program the words concern. The mark
   is attribution of subject, never endorsement - the intro and the tag on
   every card both say so.
   The faces are AI-generated headshots (public/text-to-image endpoint, then
   cropped square), so nobody's likeness is being put in our words. They are
   files in public/portraits, not hot-linked, and every card still carries the
   Illustrative tag. */
type Voice = { name: string; role: string; quote: string; org: string; login: string; face: string };
const QUOTES: Voice[] = [
  {
    name: "Priya N.", role: "ML engineer, Bengaluru", org: "LFX", login: "linuxfoundation",
    face: "/portraits/priya.png",
    quote: "The program calendar told me LFX Term 3 was open the week I had capacity. I applied with a documentation fix as my proof of work.",
  },
  {
    name: "Marcus D.", role: "CS undergraduate", org: "GitHub", login: "github",
    face: "/portraits/marcus.png",
    quote: "I used to skim a dozen GitHub organization pages. One view of open issues, review latency and stack is enough to decide.",
  },
  {
    name: "Sana K.", role: "Frontend developer", org: "Google Summer of Code", login: "google",
    face: "/portraits/sana.png",
    quote: "GSoC felt like a black hole until every participating organization's open issues were on one page. I shortlisted nine in an evening.",
  },
  {
    name: "Arjun R.", role: "Backend developer, Pune", org: "Vercel Open Source", login: "vercel",
    face: "/portraits/arjun.png",
    quote: "Watching what changed on the issues I had saved is the part I did not know I needed. Two of them were Vercel's.",
  },
  {
    name: "Wei L.", role: "Data scientist", org: "Kubernetes", login: "kubernetes",
    face: "/portraits/wei.png",
    quote: "Before I opened a pull request into a void, I checked how long that Kubernetes working group had gone without reviewing one.",
  },
  {
    name: "Fatima Z.", role: "Second-year student", org: "Outreachy", login: "outreachy",
    face: "/portraits/fatima.png",
    quote: "Outreachy felt impossible until the prep window was on the same page as the communities actually doing it.",
  },
];
const QuoteMark = () => (
  <svg width="22" height="18" viewBox="0 0 24 20" fill="currentColor" aria-hidden className="text-accent/60">
    <path d="M0 20v-8C0 5.4 3.8 1.3 10.6 0l1.4 3.1C8.5 4.4 6.6 6.8 6.5 10H12v10H0Zm12.4 0v-8c0-6.6 3.8-10.7 10.6-12L26.4 3.1c-3.5 1.3-5.4 3.7-5.5 6.9H24v10H12.4Z" transform="scale(.91)" />
  </svg>
);

/* Arrows, not an auto-scroll: a row that moves on its own cannot be read, and
   the middle of a quote is the worst place to lose it. The strip snaps to the
   cards and the buttons step one card at a time. */
const Arrow = ({ dir }: { dir: -1 | 1 }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {dir === -1 ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
  </svg>
);

/* The AI-generated headshots are local files, so a card never depends on an
   image host at render time. If a file goes missing the drawn avatar is still
   there underneath - the section degrades to obviously-made-up rather than a
   broken icon. */
function Face({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Portrait name={name} size={46} className="ring-1 ring-line" />;
  return <img src={src} alt="" width={46} height={46} loading="lazy" onError={() => setBroken(true)}
    className="h-[46px] w-[46px] shrink-0 rounded-full object-cover ring-1 ring-line" />;
}

function Voices() {
  const rail = useRef<HTMLDivElement | null>(null);
  const nudge = (dir: -1 | 1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const w = card ? card.offsetWidth + 16 : 376;
    el.scrollBy({ left: dir * w, behavior: reduceMotion ? "auto" : "smooth" });
  };
  const card = (v: Voice, k: number) => (
    <figure key={v.name + k} data-card
      className="group/card shrink-0 snap-start w-[376px] max-[700px]:w-[292px] bg-card border border-line rounded-[18px] p-[24px] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-lift">
      {/* the face on the left, the organization it is about on the right */}
      <div className="flex items-start justify-between gap-3">
        <Face src={v.face} name={v.name} />
        <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px] bg-foam ring-1 ring-line transition-shadow duration-300 group-hover/card:ring-accent/45"
          title={`About ${v.org}`}>
          <OrgImg src={avatarOf(v.login, 80)} name={v.org} alt={v.org} width={26} height={26} className="h-[26px] w-[26px] object-contain" />
        </span>
      </div>
      <div className="mt-5"><QuoteMark /></div>
      <blockquote className="text-ink text-[14.5px] leading-[1.75] mt-3 flex-1">{v.quote}</blockquote>
      <figcaption className="mt-6 pt-4 border-t border-dashed border-line">
        <div className="flex items-end justify-between gap-3">
          <span className="sign text-ink">{v.name}</span>
          <span className="mb-[5px] shrink-0 font-mono text-[8.5px] font-bold uppercase tracking-[.1em] text-dim border border-line rounded-full px-2 py-[4px]">Illustrative</span>
        </div>
        <p className="text-cocoa text-[11.5px] mt-3 truncate">
          {v.role}<span className="text-dim"> · </span>{v.org}
        </p>
      </figcaption>
    </figure>
  );
  return (
    <section id="stories" className="on-dark mt-[92px] bg-coffee border-y border-bean text-foam">
      <div className="max-w-[1240px] mx-auto px-6 pt-14 pb-7 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <SectionTag>Early feedback</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.022em] text-[clamp(28px,3.6vw,42px)] mt-3 text-foam">What builders <Word>tell us</Word>.</h2>
          <p className="text-steam text-[13.5px] max-w-[540px] leading-[1.65] mt-3">These cards are layout placeholders until we have quotes we can attribute. The faces are AI-generated portraits, not photographs of anyone real, and the mark beside each one is the organization that quote is about - not an endorsement from it.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => nudge(-1)} aria-label="Previous quotes"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/18 text-foam/80 transition-colors hover:border-accent hover:text-accent cursor-pointer">
            <Arrow dir={-1} />
          </button>
          <button type="button" onClick={() => nudge(1)} aria-label="Next quotes"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/18 text-foam/80 transition-colors hover:border-accent hover:text-accent cursor-pointer">
            <Arrow dir={1} />
          </button>
        </div>
      </div>
      <div ref={rail} className="snap-x snap-proximity overflow-x-auto no-scrollbar px-6 pb-14">
        <div className="mx-auto flex max-w-[1240px] gap-4">{QUOTES.map(card)}</div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────── */
const FAQS: [string, string][] = [
  ["Where does the issue data come from?",
    "The GitHub REST and search APIs, called with a server-side token. We index open issues from active repositories on a schedule and store a snapshot, so the counts you see are real but are as of the crawl date shown under the numbers on this page."],
  ["Is an issue still available if cyrus lists it?",
    "Not necessarily. We show assignment state, whether the issue is locked, how recently it moved and whether a pull request already points at it, but GitHub is the source of truth. Read the thread and ask the maintainer before you start work."],
  ["How is difficulty estimated?",
    "It is an estimate, labelled as one. It weighs the label on the issue, how much of the repository the change is likely to touch and how the project words its contribution guides. It is not a grade and it is not a gate."],
  ["What counts toward the leaderboard?",
    "Merged pull requests, open pull requests and reviews are counted separately, over a stated window, from public repositories only. There is no single quality score, because merge volume is not quality and a number that simple would be simple to fake."],
  ["Do you handle payments for sponsors?",
    "No. Sponsor profiles link out to the funding provider the developer chooses. cyrus never stores card details and never takes a cut, so there is no payment surface to secure."],
  ["What happens to my private repositories?",
    "Nothing is fetched without your GitHub authorisation, private data stays out of public pages and shared outputs, and the token used for indexing never ships to the browser. Repository contents are treated as untrusted input: cyrus reads them, it does not run them."],
  ["Is cyrus free, and do I need an account?",
    "Browsing programs, organizations, projects and issues is open with no account. Signing in adds your saved shortlist and dashboard. The catalog is open source under the terms in the repository."],
];
const Chevron = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-accent transition-transform duration-200 group-open:rotate-180">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function Faq() {
  return (
    <Section id="faq-home">
      <div className="grid grid-cols-[.72fr_1.28fr] gap-12 max-[1020px]:grid-cols-1 max-[1020px]:gap-8 items-start">
        <div>
          <SectionTag>Answers, plainly</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.022em] leading-[1.06] text-[clamp(30px,3.8vw,46px)] mt-3">Frequently asked <Word>questions</Word></h2>
          <p className="text-cocoa mt-3.5 text-[15px] leading-[1.65]">Where the data comes from, what it can and cannot tell you, and what we do with yours.</p>
          <Link className={`${btn("outline", "sm")} mt-5`} to="/about">How the catalog is built</Link>
        </div>
        <div className="grid gap-2.5">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group bg-card border border-line rounded-[14px] px-6 py-[16px] open:shadow-soft transition-all">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-display font-bold text-[15px] [&::-webkit-details-marker]:hidden">
                {q}{Chevron()}
              </summary>
              <p className="text-cocoa text-[14px] leading-[1.7] mt-3 max-w-[660px]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── closing CTA ──────────────────────────────────────────── */
function Cta() {
  const { setAuthOpen } = useStore();
  return (
    <section className="on-dark cta-close mt-[110px] relative overflow-hidden bg-coffee text-foam">
      <span aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,var(--gl)_1px,transparent_1px),linear-gradient(to_bottom,var(--gl)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(900px_520px_at_50%_42%,#000_40%,transparent)]" />
      <span aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(720px_340px_at_50%_-12%,rgba(255,255,255,0.05),transparent_70%)]" />
      <div className="relative max-w-[860px] mx-auto px-6 pt-[104px] pb-[112px] text-center">
        <div className="footer-arc w-[120px] mx-auto" />
        <span className="inline-flex items-center gap-2.5 mt-9 eyebrow !text-steam">
          <span className="text-accent leading-none">✦</span> Ready when you are
        </span>
        <h2 className="font-display font-extrabold text-foam text-[clamp(30px,4.4vw,52px)] leading-[1.1] tracking-[-.026em] mt-6">
          Stop hunting for projects.<br />Start shipping <span className="text-accent">them</span>.
        </h2>
        <p className="text-steam mt-5 mx-auto max-w-[520px] text-[16px] leading-[1.65]">
          Sign in with GitHub, save the issues and repositories worth your week, and let the dashboard keep track of what moved.
        </p>
        <div className="flex gap-3 justify-center flex-wrap mt-9">
          <button className={btn("primary", "lg")} onClick={() => setAuthOpen(true)}>Sign in &amp; open dashboard</button>
          <Link className={`${btn("outline", "lg")} !bg-white/6 !border-white/18 !text-foam hover:!bg-white/12`} to="/projects">Browse programs</Link>
        </div>
        <p className="mt-7 font-mono text-[10.5px] tracking-[.1em] uppercase text-dimdk">
          Free to browse · <Link className="text-foam underline underline-offset-3 normal-case tracking-normal" to="/about#data">how we source the data</Link>
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <HomeHero />
      <Features />
      <Programs />
      <Timeline />
      <Roadmap />
      <Skills />
      <Band />
      <OrgMarquee />
      <Voices />
      <Faq />
      <Cta />
    </>
  );
}
