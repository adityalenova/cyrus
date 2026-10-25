"use client"
/* ══ Home.tsx — hero, hackathons, programs, timeline, roadmap, calendar, orgs ═ */
import { useMemo, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Link, useNavigate } from "@/lib/router";
import { ORGS, PROGRAMS } from "../data/orgs";
import { REPOS } from "../data/repos";
import { HACKS } from "../data/hackathons";
import type { Hack } from "../data/hackathons";
import type { Program } from "../lib/types";
import { avatarOf, fmt, byStars, hash, CAT_META } from "../lib/util";
import { Word, SectionTag, btn, OrgImg, Avatar } from "../components/ui";
import { SearchIcon } from "../components/Nav";
import { useStore } from "../lib/store";
import { HackCard } from "./Hackathons";

/* ── hero ─────────────────────────────────────────────────── */
const WALL = ["google", "microsoft", "anthropics", "openai", "huggingface", "modelcontextprotocol",
  "vercel", "cloudflare", "langchain-ai", "ollama", "n8n-io", "kubernetes"];

function Hero() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <header className="relative overflow-hidden pt-[92px] pb-20 max-[700px]:pt-14 max-[700px]:pb-11">
      <div className="hero-glow" /><div className="hero-pattern" />
      <div className="wrap max-w-[1240px] mx-auto px-6 relative z-[1] grid grid-cols-[1.08fr_.92fr] gap-14 items-center max-[1020px]:grid-cols-1 max-[1020px]:gap-12">
        <div>
          <h1 className="font-display font-extrabold tracking-[-.025em] leading-[1.04] mt-5 text-[clamp(46px,5.6vw,76px)]">
            <span className="block reveal" style={{ animationDelay: ".05s" }}>Find your</span>
            <span className="block">
              <span className="inline-block reveal" style={{ animationDelay: ".22s" }}><Word>hackathon</Word></span>{" "}
              <span className="inline-block reveal" style={{ animationDelay: ".38s" }}>edge.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-[540px] text-ink font-medium text-[17.5px] leading-[1.6] reveal" style={{ animationDelay: ".52s" }}>
            Your one-stop catalog of company hackathons, mentored open-source programs and agent skills for your coding agent.
          </p>
          <div className="reveal" style={{ animationDelay: ".66s" }}>
          <form className="mt-7 flex items-center gap-2 bg-card border border-line rounded-full py-[7px] pl-[18px] pr-[7px] max-w-[520px] shadow-lift transition-all focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(180, 96, 44,.14),0_18px_40px_-18px_rgba(36,27,19,.25)] search-pulse"
            onSubmit={(e) => { e.preventDefault(); nav(`/projects${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); }}>
            <SearchIcon size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills, orgs, stacks…"
              className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[15px] placeholder:text-dim py-2" autoComplete="off" />
            <button type="submit" className={btn("primary", "md")}>Search</button>
          </form>
          </div>
          <div className="flex items-center gap-2 mt-3.5 flex-wrap reveal" style={{ animationDelay: ".78s" }}>
            <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim">Try:</span>
            {[["Open source", "/opensource"], ["Agent skills", "/projects?q=skills"], ["Artifacts", "/tools"], ["Projects", "/projects"]].map(([l, to]) => (
              <Link key={l} to={to} className="text-[12.5px] font-semibold text-cocoa bg-card border border-line rounded-full px-3.5 py-[5px] hover:border-accent hover:text-rust hover:-translate-y-px transition-all">{l}</Link>
            ))}
          </div>
          <div className="flex gap-x-6 gap-y-3.5 mt-8 flex-wrap items-center reveal" style={{ animationDelay: ".9s" }}>
            <a className={btn("dark", "lg")} href="#programs">Explore open source programs</a>
            <Link className="text-[13.5px] font-semibold text-cocoa border-b border-dashed border-dim pb-0.5 hover:text-accent hover:border-accent transition-colors" to="/organizations">Browse organizations</Link>
          </div>
        </div>
        <div className="reveal" style={{ animationDelay: ".45s" }}>
          <div className="grid grid-cols-4 gap-4 max-[700px]:grid-cols-3 max-[700px]:gap-2.5">
            {WALL.map((o, i) => (
              <Link key={o} to={`/organizations/${o}`}
                className="logocell relative aspect-[1.06] bg-card border border-line rounded-[22px] grid place-items-center p-4 shadow-soft hover:shadow-lift hover:border-ember hover:z-[5]"
                style={{ ["--r" as string]: `${(hash(o) % 9) - 4}deg`, ["--d" as string]: `${(i % 4) * 0.8 + (i % 3) * 0.3}s` }}>
                <OrgImg src={avatarOf(o, 120)} name={o} className="w-[52px] h-[52px] rounded-[14px] object-cover bg-sand" />
                <span className="absolute bottom-[9px] left-0 right-0 text-center font-mono text-[9px] text-dim opacity-0 hover:opacity-100 transition-opacity">{o}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── hackathon shelf (replaces the old programs shelf) ────── */
function HackathonShelf() {
  const shelf = HACKS.slice(0, 4);
  return (
    <section id="hackathons" className="max-w-[1240px] mx-auto px-6 pt-[92px] scroll-mt-24">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
        <div>
          <SectionTag>Prize events worth your weekend</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-3">Top company <Word>hackathons</Word></h2>
          <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[560px]">Live events from NVIDIA, GitHub, Google and Microsoft - each with a full prep plan: timeline, ideas and skills to install.</p>
        </div>
        <Link className={btn("outline", "md")} to="/hackathons">All hackathons</Link>
      </div>
      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {shelf.map((h) => <HackCard key={h.id} h={h} />)}
      </div>
    </section>
  );
}

/* ── developer programs shelf (restored, next to hackathons) ─ */
const PSTATUS: Record<Program["status"], [string, string]> = {
  live: ["● Live now", "bg-[#0e1512]/82 text-[#8ff0ba] border-[#8ff0ba]/45"],
  upcoming: ["Upcoming", "bg-[#120e09]/78 text-white/90 border-white/28"],
  closed: ["Closed", "bg-[#120e09]/72 text-white/65 border-white/22"],
};

function ProgCard({ p }: { p: Program }) {
  return (
    <a href={p.url} target="_blank" rel="noopener"
      className="group relative rounded-[22px] overflow-hidden flex flex-col min-h-[460px] text-foam isolate bg-coffee border border-bean transition-all duration-300 hover:-translate-y-[7px] hover:shadow-[0_34px_66px_-22px_rgba(34, 26, 19,.5)]">
      <Image src={p.img} alt="" width={1200} height={800} sizes="(max-width: 768px) 100vw, 420px" className="absolute inset-0 -z-20 w-full h-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-95" />
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-coffee/30 via-coffee/60 to-[#0f1012]/95" />
      <div className="flex items-center justify-between px-5 pt-[18px]">
        <span className="w-11 h-11 rounded-xl bg-white grid place-items-center overflow-hidden shadow-[0_8px_18px_-6px_rgba(0,0,0,.5)]">
          <Image src={avatarOf(p.owner, 64)} alt={p.owner} width={64} height={64} className="w-[30px] h-[30px] object-contain" />
        </span>
        <span className={`font-mono text-[9.5px] font-bold tracking-[.1em] uppercase px-3 py-[5px] rounded-full border backdrop-blur-sm ${PSTATUS[p.status][1]}`}>{PSTATUS[p.status][0]}</span>
      </div>
      <div className="mt-auto p-5 flex flex-col gap-2.5">
        <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-foam/70">{p.owner} · {p.window}</span>
        <h3 className="card-title-xl text-white">{p.name}</h3>
        <p className="text-foam/75 text-[13.5px] leading-[1.6]">{p.tag}</p>
        <div className="flex items-center justify-between gap-2.5 mt-1.5">
          <span className="font-mono text-[13px] font-bold text-white">{p.pay}
            <small className="block text-[9.5px] font-medium text-foam/55 tracking-[.08em] uppercase">{p.payNote}</small></span>
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-white bg-white/10 border border-white/20 rounded-full px-3.5 py-[7px] w-max transition-colors group-hover:bg-accent group-hover:border-accent">Explore</span>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-3 flex items-center gap-3.5 font-mono text-[10.5px] text-foam/60">
        <span>Orgs · <b className="text-white font-semibold">{p.orgs}</b></span>
        <span>Seats · <b className="text-white font-semibold">{p.slots}</b></span>
      </div>
    </a>
  );
}

function Programs() {
  const shelf = ["gsoc", "outreachy", "lfx", "oct"].map((id) => PROGRAMS.find((p) => p.id === id)!);
  return (
    <section id="programs" className="max-w-[1240px] mx-auto px-6 pt-[92px] scroll-mt-24">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
        <div>
          <SectionTag>Paid &amp; mentored</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-3">Open source <Word>programs</Word></h2>
          <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[560px]">Stipend-backed internships and contribution sprints - all eight run on the calendar below.</p>
        </div>
        <a className={btn("outline", "md")} href="#timeline">See the year</a>
      </div>
      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {shelf.map((p) => <ProgCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

/* ── 12-month open source program timeline (Gantt) ─────────── */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NOW_M = 9 + 3 / 31; /* October 3, 2026 */

function Timeline() {
  return (
    <section id="timeline" className="max-w-[1240px] mx-auto px-6 pt-[92px] scroll-mt-24">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
        <div>
          <SectionTag>The contributor year</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-3">Programs <Word>calendar</Word>, month by month.</h2>
          <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[560px]">Every program's application, bonding and coding windows across 2026.</p>
        </div>
        <span className={btn("ghost", "sm")}>Snapshot · Oct 2026</span>
      </div>
      <div className="bg-card border border-line rounded-[24px] p-6 md:p-8 shadow-soft overflow-x-auto">
        <div className="min-w-[760px]">
          {/* month scale */}
          <div className="grid grid-cols-[230px_1fr] gap-4 items-center pb-3 border-b border-liness">
            <span className="font-mono text-[10px] tracking-[.12em] uppercase text-dim">Program</span>
            <div className="relative grid grid-cols-12">
              {MONTHS.map((m) => <span key={m} className="font-mono text-[9.5px] text-dim text-center">{m}</span>)}
              <span className="absolute -top-[9px] font-mono text-[9px] font-bold uppercase tracking-[.1em] text-rust whitespace-nowrap -translate-x-1/2" style={{ left: `${(NOW_M / 12) * 100}%` }}>Today</span>
            </div>
          </div>
          {PROGRAMS.map((p) => (
            <div key={p.id} className="grid grid-cols-[230px_1fr] gap-4 items-center py-3 border-b border-liness last:border-0">
              <span className="flex items-center gap-2.5 min-w-0">
                <Image src={avatarOf(p.owner, 48)} alt="" width={48} height={48} className="w-[24px] h-[24px] rounded-[7px] bg-sand object-cover shrink-0" />
                <b className="card-title text-[13.5px] truncate">{p.name}</b>
              </span>
              <div className="relative h-[30px]">
                {MONTHS.map((_, i) => <i key={i} className="absolute top-0 bottom-0 w-px bg-liness" style={{ left: `${((i + 1) / 12) * 100}%` }} />)}
                {p.phases.map((ph) => {
                  const s = ph.s, e = ph.e > ph.s ? ph.e : ph.e + 12;
                  return (
                    <span key={ph.label} title={`${ph.label} · ${MONTHS[Math.floor(s)]} - ${MONTHS[Math.floor(e) % 12]}`}
                      className={`absolute top-1/2 -translate-y-1/2 h-[19px] rounded-[7px] border transition-transform hover:scale-[1.02] ${ph.active ? "timeline-active" : ""}`}
                      style={{ left: `${(s / 12) * 100}%`, width: `calc(${((e - s) / 12) * 100}% - 3px)`, background: `color-mix(in srgb, ${ph.c} 78%, white)`, borderColor: ph.c }}>
                      <span className="absolute inset-0 grid place-items-center font-mono text-[9px] font-bold text-white/95 whitespace-nowrap overflow-hidden px-2">{ph.label}</span>
                    </span>
                  );
                })}
                <span className="absolute -top-1 -bottom-1 w-[2px] bg-rust rounded-full z-[2]" style={{ left: `${(NOW_M / 12) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="flex gap-5 flex-wrap pt-4 font-mono text-[10.5px] text-cocoa">
            {[["#3b6ea5", "Applications"], ["#a97b1f", "Selection"], ["#2f7d72", "Bonding / outreach"], ["#3e7d4f", "Coding & internships"]].map(([c, l]) => (
              <span key={l}><i className="inline-block w-2.5 h-2.5 rounded-[4px] mr-1.5 align-[-1px]" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── how it works + GitHub dashboard mock (official dark) ─── */
const GH = {
  bg: "#0d1117", card: "#161b22", line: "#30363d", soft: "#21262d", text: "#e6edf3", dim: "#8b949e",
  link: "#58a6ff", green: "#3fb950", yellow: "#d29922", purple: "#6bc9b8", orange: "#fd8c73",
};
const GH_BRANCHES: [string, string, string, string, "merged" | "diverged" | ""][] = [
  ["main", "Sarah C.", "Update feat commit messages", "2h ago", "merged"],
  ["develop", "David K.", "Add root commit and devtools config", "2h ago", "diverged"],
  ["feat/auth-v2", "Maya L.", "Resolve auth-v2 merge conflicts", "2h ago", "diverged"],
  ["fix/api-calls", "Ravi T.", "Fix api calls to feature flags", "2h ago", ""],
];
const GH_PRS: [string, string, string, string, string, string][] = [
  ["#412", "Draft", "Auth Improvements", "Sarah C.", "Open", "5 comms · 2 revs"],
  ["#410", "Open", "New API Endpoints", "David K.", "needs review", "3 comms · 4 revs"],
];
const GH_MATCHES: [string, string, number][] = [
  ["Maya L.", "[Go/CI] · match: CI config", 92],
  ["David K.", "[Rust/API] · match: API design", 88],
  ["Sarah C.", "[React/A11y] · match: UI polish", 85],
];

function GhChip({ children, c }: { children: ReactNode; c: string }) {
  return <i className="not-italic font-mono text-[9px] font-bold rounded-full px-2 py-[3px] border" style={{ color: c, borderColor: c + "55", background: c + "1c" }}>{children}</i>;
}
function MatchRing({ pct }: { pct: number }) {
  const C = 2 * Math.PI * 12;
  return (
    <span className="relative w-[30px] h-[30px] grid place-items-center shrink-0">
      <svg width="30" height="30" viewBox="0 0 30 30" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="15" cy="15" r="12" fill="none" stroke={GH.line} strokeWidth="3" />
        <circle cx="15" cy="15" r="12" fill="none" stroke={GH.yellow} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
      </svg>
      <b className="font-mono text-[8.5px]" style={{ color: GH.text }}>{pct}%</b>
    </span>
  );
}
const BranchIcon = () => (
  <svg width="10" height="12" viewBox="0 0 10 16" fill={GH.dim} aria-hidden>
    <path d="M6.7 0a2.3 2.3 0 0 1 1 4.4V6a2.3 2.3 0 0 1-2 2.24H4.3A1.3 1.3 0 0 0 3 9.56v1.1a2.3 2.3 0 1 1-1.6 0v-1.1A2.9 2.9 0 0 1 4.3 6.7h1.4a.8.8 0 0 0 .8-.7V4.4a2.3 2.3 0 0 1-.8-4.4ZM1.7 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0-12a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 1.7 1Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
  </svg>
);

function GitHubMock() {
  return (
    <div className="rounded-[14px] overflow-hidden border shadow-dark" style={{ background: GH.bg, borderColor: GH.line }}>
      <div className="grid grid-cols-[1fr_248px] max-[860px]:grid-cols-1">
        <div className="p-3.5 space-y-3.5">
          {/* 1. Branch Activity */}
          <div className="rounded-[10px] border overflow-hidden" style={{ background: GH.card, borderColor: GH.line }}>
            <p className="px-3.5 py-2.5 text-[12.5px] font-semibold border-b" style={{ color: GH.text, borderColor: GH.line }}>1. Branch Activity</p>
            <div className="px-3.5 pt-2 grid grid-cols-[104px_1fr_56px_74px] gap-2 font-mono text-[8.5px] uppercase tracking-[.08em]" style={{ color: GH.dim }}>
              <span>Branch</span><span>Last commit</span><span>Time</span><span className="text-right">Status</span>
            </div>
            {GH_BRANCHES.map(([b, who, msg, ago, st]) => (
              <div key={b} className="px-3.5 py-[7px] grid grid-cols-[104px_1fr_56px_74px] gap-2 items-center border-t" style={{ borderColor: GH.soft }}>
                <span className="flex items-center gap-1 min-w-0"><BranchIcon /><i className="not-italic font-mono text-[9.5px] rounded-[5px] px-1.5 py-[2px] truncate" style={{ background: "rgba(56,139,253,.15)", color: GH.link }}>{b}</i></span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <Avatar name={who} size={20} />
                  <span className="text-[10.5px] truncate" style={{ color: GH.text }}>{msg}</span>
                </span>
                <span className="font-mono text-[9px]" style={{ color: GH.dim }}>{ago}</span>
                <span className="flex justify-end">{st !== "" && <GhChip c={st === "merged" ? GH.purple : GH.yellow}>{st}</GhChip>}</span>
              </div>
            ))}
          </div>
          {/* 2. Pull Requests */}
          <div className="rounded-[10px] border overflow-hidden" style={{ background: GH.card, borderColor: GH.line }}>
            <p className="px-3.5 py-2.5 text-[12.5px] font-semibold border-b" style={{ color: GH.text, borderColor: GH.line }}>2. Pull Requests</p>
            {GH_PRS.map(([id, tag, title, who, status, comms]) => (
              <div key={id} className="px-3.5 py-[9px] border-t first:border-t-0" style={{ borderColor: GH.soft }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10.5px] font-semibold" style={{ color: GH.link }}>PR {id}</span>
                  <span className="font-mono text-[9.5px] font-semibold" style={{ color: tag === "Draft" ? GH.orange : GH.green }}>[{tag}]</span>
                  <span className="text-[11px] font-semibold" style={{ color: GH.text }}>- {title}</span>
                  <span className="ml-auto"><GhChip c={status === "Open" ? GH.green : GH.yellow}>{status}</GhChip></span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Avatar name={who} size={16} />
                  <span className="font-mono text-[9px]" style={{ color: GH.dim }}>{who} opened this · {comms}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 3. AI Match Recommendations */}
        <aside className="p-3.5 border-t max-[860px]:border-t" style={{ borderColor: GH.line }}>
          <p className="text-[12.5px] font-semibold mb-1" style={{ color: GH.text }}>3. AI Match Recommendations</p>
          <p className="text-[10px] mb-2" style={{ color: GH.dim }}>Powered by <span style={{ color: GH.link }}>CodeMatch AI</span>:</p>
          <p className="text-[10.5px] font-semibold mb-1" style={{ color: GH.text }}>"AI insights for collaboration"</p>
          <p className="text-[9.5px] leading-[1.55] mb-2" style={{ color: GH.dim }}>Recommends devs based on expertise and PR complexity.</p>
          {GH_MATCHES.map(([n, meta, pct]) => (
            <div key={n} className="flex items-center gap-2 py-2 border-t" style={{ borderColor: GH.soft }}>
              <Avatar name={n} size={26} />
              <span className="min-w-0 flex-1">
                <b className="block text-[10.5px] truncate" style={{ color: GH.text }}>{n}</b>
                <span className="block font-mono text-[8.5px] truncate" style={{ color: GH.dim }}>{meta}</span>
              </span>
              <MatchRing pct={pct} />
            </div>
          ))}
        </aside>
      </div>
      <div className="px-3.5 py-2 border-t flex items-center gap-2 font-mono text-[9.5px]" style={{ borderColor: GH.line, background: GH.card, color: GH.dim }}>
        <span style={{ color: GH.green }}>●</span> live preview · pick an issue <span style={{ color: GH.link }}>cyrus add</span> ship the PR
      </div>
    </div>
  );
}

/* step icons - inline SVG, no emoji anywhere */
const S_SW = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const StepIcon = ({ d, extra }: { d: string; extra?: ReactNode }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden {...S_SW}>
    <path d={d} />{extra}
  </svg>
);
const STEP_ICONS: ReactNode[] = [
  <StepIcon key="c" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z" />,
  <StepIcon key="b" d="M4 21V6l8-3v18M12 21h8V10l-8-2.4M7 10h1M7 14h1M7 18h1M16 13h1M16 17h1M2 21h20" />,
  <StepIcon key="k" d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-3.6L6 21V4.5a1 1 0 0 1 1-1Z" />,
  <StepIcon key="r" d="M12 15c4.5-3 6.8-7 7.4-12.4C13.9 3.2 9.9 5.5 7 10l5 5Zm0 0-4.4-.6L4.8 17l3 .8.2 3L10 18.4m2-3.4.6 4.4 2-2.2" />,
];

function HowItWorks() {
  const steps: [ReactNode, string, string][] = [
    [STEP_ICONS[0], "Pick a hackathon or a skill", "Every tracked hackathon ships with a prep plan, timeline and idea list - or filter 1,528 agent-tooling repos by stars, difficulty and stack."],
    [STEP_ICONS[1], "Match with an organization", "Every org page shows what they have built, live issues and contributor pulse before you commit."],
    [STEP_ICONS[2], "Save your shortlist", "Sign in and your dashboard keeps hackathons, projects, progress and deadlines in one coffee-dark panel."],
    [STEP_ICONS[3], "Ship with your agent", "Install the winning skills and MCP servers, then send the PR. The streak counter does the rest."],
  ];
  const TRUST = ["rust-lang", "pytorch", "tensorflow", "flutter", "godotengine", "wikimedia", "mozilla", "gnome", "docker", "jupyterlab"];
  const cards = useMemo(() => REPOS.slice().sort(byStars).slice(0, 4), []);
  return (
    <section id="how" className="max-w-[1240px] mx-auto px-6 pt-[92px]">
      <div className="grid grid-cols-[.9fr_1.1fr] gap-14 items-center max-[1020px]:grid-cols-1 max-[1020px]:gap-10">
        <div>
          <SectionTag>How it works</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] mt-3.5 text-[clamp(30px,3.6vw,42px)]">
            From "I should build something" to <Word>shipped demo</Word>.
          </h2>
          <div className="grid gap-[22px] mt-7.5">
            {steps.map(([ic, b, p]) => (
              <div key={b} className="flex gap-4 items-start">
                <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 grid place-items-center text-rust bg-peach border border-accent/20">{ic}</div>
                <div>
                  <b className="block panel-h mb-1">{b}</b>
                  <p className="text-cocoa text-[14px] leading-[1.6] max-w-[380px]">{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-line rounded-[20px] overflow-hidden shadow-lift">
          <div className="flex items-center gap-2.5 px-3.5 py-[11px] border-b border-liness bg-cream">
            <span className="mock-lights flex gap-1.5"><i /><i /><i /></span>
            <span className="flex-1 bg-paper border border-line rounded-full px-3.5 py-[5px] font-mono text-[11px] text-dim whitespace-nowrap overflow-hidden">cyrus.ai/dashboard</span>
          </div>
          <div className="bg-sand p-[22px]"><GitHubMock /></div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-[34px] flex-wrap py-11 pt-11">
        <span className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">Contributors land at</span>
        {TRUST.map((o) => (
          <Link key={o} to={`/organizations/${o}`}><OrgImg src={avatarOf(o, 80)} name={o} title={o} className="w-[34px] h-[34px] rounded-full bg-card opacity-90 hover:opacity-100 hover:-translate-y-[3px] hover:saturate-100 saturate-[.85] transition-all" /></Link>
        ))}
      </div>

      <div className="text-left mb-3"><SectionTag>Most-starred in the catalog</SectionTag></div>
      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {cards.map((r) => {
          const [owner, name] = r.repo.split("/");
          return (
            <Link key={r.repo} to={`/repo/${encodeURIComponent(r.repo)}`}
              className="bg-card border border-line rounded-[20px] p-[22px] flex flex-col gap-3 shadow-soft hover:-translate-y-[5px] hover:shadow-lift hover:border-accent/40 transition-all">
              <div className="flex items-center gap-3">
                <OrgImg src={avatarOf(owner, 96)} name={owner} className="w-10 h-10 rounded-[12px] object-cover bg-sand" />
                <span><h4 className="panel-h text-[15.5px] leading-[1.25]">{name}</h4>
                  <span className="font-mono text-[10px] text-dim tracking-[.05em]">{owner}</span></span>
              </div>
              <p className="text-cocoa text-[13px] leading-[1.6] flex-1 line-clamp-3">{r.desc}</p>
              <div className="flex items-center justify-between gap-2.5">
                <span className="font-mono text-[10.5px] font-bold rounded-full px-2.5 py-1 border border-accent/30 bg-peach text-rust">{CAT_META[r.cat]?.label ?? r.cat}</span>
                <span className="font-mono text-[11.5px] font-bold text-honey">★ {fmt(r.stars)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── hackathon roadmap: 6-step blueprint (copied card design, our content) ── */
const BP = {
  indigo: "#2c5f8a", green: "#0f8a4d", cyan: "#0e7490",
  amber: "#b45309", violet: "#475569", orange: "#c2410c",
};
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, var(--color-card))`;
const inkOn = (c: string) => `color-mix(in srgb, ${c} 62%, var(--color-ink))`;

function BpCard({ id, n, c, t, sub, d, span, children }: { id?: string; n: string; c: string; t: string; sub: string; d: string; span: string; children: ReactNode }) {
  return (
    <div id={id} className={`col-span-12 ${span} rounded-[20px] border p-[22px] max-[700px]:p-[16px]`}
      style={{ borderColor: `color-mix(in srgb, ${c} 38%, transparent)`, background: tint(c, 6) }}>
      <div className="bg-card border border-line rounded-[14px] p-4 mb-5 shadow-soft">{children}</div>
      <span className="inline-block font-mono text-[11px] font-bold rounded-[7px] px-1.5 py-[3px] border mb-2"
        style={{ color: inkOn(c), borderColor: `color-mix(in srgb, ${c} 45%, transparent)` }}>{n}</span>
      <h3 className="card-title-xl leading-[1.25]">{t}</h3>
      <p className="font-mono text-[10.5px] font-bold tracking-[.1em] uppercase mt-1.5" style={{ color: inkOn(c) }}>{sub}</p>
      <p className="text-cocoa text-[13.5px] leading-[1.65] mt-2.5">{d}</p>
    </div>
  );
}
const BpLabel = ({ c, children }: { c: string; children: ReactNode }) => (
  <span className="font-mono text-[10.5px] font-bold tracking-[.12em] uppercase" style={{ color: inkOn(c) }}>{children}</span>
);
const BpBadge = ({ c, children }: { c: string; children: ReactNode }) => (
  <span className="font-mono text-[9.5px] font-bold rounded-[6px] px-2 py-[4px]" style={{ color: inkOn(c), background: tint(c, 12) }}>{children}</span>
);
const BpQuote = ({ c, children }: { c: string; children: ReactNode }) => (
  <p className="rounded-[8px] border px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-cocoa"
    style={{ borderColor: `color-mix(in srgb, ${c} 30%, transparent)`, background: tint(c, 5) }}>"{children}"</p>
);
const BpCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f8a4d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m4 12.5 5.5 5.5L20 7" /></svg>
);

function Roadmap() {
  return (
    <section id="roadmap" className="max-w-[1240px] mx-auto px-6 pt-[92px] scroll-mt-24">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
        <div>
          <span className="inline-block font-mono text-[10.5px] font-bold tracking-[.14em] uppercase text-rust bg-peach border border-accent/30 rounded-[7px] px-2.5 py-[6px]">6-step hackathon blueprint</span>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-4">Hackathon <Word>roadmap</Word></h2>
          <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[600px]">From choosing your stack to pitching judges and publishing your own skill - the order every prep plan follows.</p>
        </div>
        <Link className={`${btn("outline", "md")} !font-mono !text-[11.5px] !tracking-[.1em] !uppercase`} to="/hackathons">All prep plans</Link>
      </div>

      <div className="grid grid-cols-12 gap-5 max-[1020px]:gap-4">
        {/* 01 */}
        <BpCard id="bp-01" span="lg:col-span-7" n="01" c={BP.indigo} t="Pick your tech stack" sub="Focus on stacks you can demo in 48 hours"
          d="Narrow the catalog to one or two stacks you can build on without setup theatre. A stack you know well beats a stack you are curious about when the clock is running.">
          <div className="rounded-[10px] border border-line py-5 px-3 flex items-center justify-center gap-2.5 flex-wrap"
            style={{ backgroundImage: "linear-gradient(var(--color-liness) 1px, transparent 1px), linear-gradient(90deg, var(--color-liness) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
            {["TypeScript", "Python"].map((s) => (
              <span key={s} className="font-mono text-[11.5px] font-semibold bg-card border border-line rounded-[7px] px-3.5 py-[7px]">{s}</span>
            ))}
            <span className="font-mono text-[11.5px] font-bold text-white rounded-[7px] px-3.5 py-[7px]" style={{ background: BP.indigo }}>Rust / Go • Primary</span>
            <span className="font-mono text-[11.5px] font-semibold bg-card border border-line rounded-[7px] px-3.5 py-[7px]">React</span>
          </div>
        </BpCard>

        {/* 02 */}
        <BpCard span="lg:col-span-5" n="02" c={BP.green} t="Choose your hackathon" sub="Filter by prize, format & deadline"
          d="Compare every tracked event on one page - eligibility, team size, judging footprint and how many days you actually get. Pick one anchor event per season.">
          <div className="rounded-[10px] border p-4" style={{ borderColor: `color-mix(in srgb, ${BP.green} 35%, transparent)` }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-mono text-[11px] font-bold tracking-[.06em]" style={{ color: inkOn(BP.green) }}>NVIDIA · GITHUB · GOOGLE · MSFT</span>
              <BpBadge c={BP.green}>● LIVE 2026</BpBadge>
            </div>
            <svg viewBox="0 0 220 40" className="w-full h-[40px]" aria-hidden>
              <polyline points="0,30 30,26 60,28 90,14 110,24 130,8 160,18 190,12 220,16" fill="none" stroke={BP.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-right font-mono text-[10.5px] text-cocoa mt-1.5">12 hackathons · $1M+ prizes tracked</p>
          </div>
        </BpCard>

        {/* 03 */}
        <BpCard span="lg:col-span-5" n="03" c={BP.cyan} t="Prep with agent skills" sub="Install before the clock starts"
          d="Each hackathon page maps its ideal stack to skills, rules and MCP servers in our catalog. Set up your scaffold, prompts and infra while registration is still open.">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <i className="not-italic w-[20px] h-[20px] rounded-[5px] grid place-items-center font-mono text-[10px] font-bold text-white" style={{ background: BP.cyan }}>S</i>
              Skill install
            </span>
            <span className="font-mono text-[10.5px]" style={{ color: inkOn(BP.cyan) }}>cyrus add mcp</span>
          </div>
          <BpQuote c={BP.cyan}>Weekend project: agent scaffold ready before the opening ceremony.</BpQuote>
        </BpCard>

        {/* 04 */}
        <BpCard span="lg:col-span-7" n="04" c={BP.amber} t="Build fast, ship the demo" sub="One killer flow, end to end"
          d="Scope one complete feature rather than three half-finished ones. Commit early, deploy something clickable, and keep a working branch you can always demo.">
          <div className="flex items-center justify-between mb-4">
            <BpLabel c={BP.amber}>Build pipeline</BpLabel>
            <span className="font-mono text-[10.5px] font-bold" style={{ color: inkOn(BP.green) }}>DEMO LIVE ✓</span>
          </div>
          <div className="flex items-center justify-center gap-3 font-mono text-[12px] mb-3 flex-wrap">
            <span className="rounded-[7px] px-3 py-[6px] border font-semibold" style={{ color: inkOn(BP.amber), borderColor: `color-mix(in srgb, ${BP.amber} 40%, transparent)`, background: tint(BP.amber, 8) }}>Repo scaffold</span>
            <span style={{ color: inkOn(BP.amber) }}></span>
            <span className="rounded-[7px] px-3 py-[6px] font-bold text-white" style={{ background: BP.amber }}>MVP build</span>
            <span style={{ color: inkOn(BP.amber) }}></span>
            <span className="rounded-[7px] px-3 py-[6px] border font-semibold" style={{ color: inkOn(BP.amber), borderColor: `color-mix(in srgb, ${BP.amber} 40%, transparent)`, background: tint(BP.amber, 8) }}>3-min demo</span>
          </div>
          <p className="text-center font-mono text-[10.5px] text-cocoa">Commit streak: 6 days · README merged with 48h to spare</p>
        </BpCard>

        {/* 05 */}
        <BpCard span="lg:col-span-5" n="05" c={BP.violet} t="Pitch the judges" sub="Structure a winning submission"
          d="A live URL, a demo a real user understands in 20 seconds, and a candid limits section. Judges skim hundreds of projects - specific beats ambitious.">
          <div className="flex items-center justify-between mb-3">
            <BpLabel c={BP.violet}>Submission desk</BpLabel>
            <BpBadge c={BP.green}>✓ SHORTLISTED</BpBadge>
          </div>
          <BpQuote c={BP.violet}>Demo video, live link and clean README accepted with full judge consensus.</BpQuote>
        </BpCard>

        {/* 06 */}
        <BpCard span="lg:col-span-7" n="06" c={BP.orange} t="Win and give back" sub="Publish the tools you built"
          d="Turn your hackathon repo into an open-source skill, mentor at the next event, and your project lands in the cyrus.ai catalog for the builder after you.">
          <div className="flex items-center justify-between mb-4">
            <BpLabel c={BP.orange}>Season wrap-up</BpLabel>
            <span className="font-mono text-[10.5px] font-bold flex items-center gap-1.5" style={{ color: inkOn(BP.green) }}><BpCheck /> SKILL PUBLISHED</span>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <b className="font-display text-[15px]">Prize in hand, tooling in the catalog</b>
            <a href="#bp-01" className="font-mono text-[10.5px] font-bold tracking-[.08em] uppercase text-white rounded-[8px] px-4 py-2.5 hover:opacity-90 transition-opacity" style={{ background: BP.orange }}>Start step 1 ↑</a>
          </div>
        </BpCard>
      </div>
    </section>
  );
}

/* ── hackathon season calendar (replaces the congested Gantt) ── */
const NOW_ISO = "2026-10-03";
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const daysLeft = (iso: string) => Math.ceil((new Date(iso + "T23:59:59Z").getTime() - new Date(NOW_ISO + "T00:00:00Z").getTime()) / 864e5);
const fmtDate = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); return `${MON3[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const SEASON_TONE: Record<Hack["status"], [string, string]> = {
  open: ["Open", "text-leaf border-leaf/35 bg-leaf/8"],
  rolling: ["Rolling", "text-leaf border-leaf/35 bg-leaf/8"],
  upcoming: ["Upcoming", "text-honey border-honey/35 bg-honey/10"],
  recurring: ["Recurring", "text-cocoa border-line bg-cream"],
  closed: ["Closed", "text-dim border-line bg-cream"],
};

function Season() {
  const rows = HACKS.filter((h) => h.status !== "closed").sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 8);
  return (
    <section id="calendar" className="max-w-[1240px] mx-auto px-6 pt-[92px] scroll-mt-24">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
        <div>
          <SectionTag>The season at a glance</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-3">Every deadline, <Word>2026</Word>.</h2>
          <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[560px]">The next eight hackathons by closing date - click any row for its full prep plan.</p>
        </div>
        <Link className={btn("dark", "md")} to="/hackathons">All hackathons</Link>
      </div>
      <div className="bg-card border border-line rounded-[24px] px-8 py-4 shadow-soft max-[700px]:px-4">
        <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,2fr)_110px_110px] gap-5 py-3.5 font-mono text-[10px] tracking-[.12em] uppercase text-dim border-b border-liness">
          <span>Event</span><span>Runway</span><span>Prize</span><span className="text-right">Closes</span>
        </div>
        {rows.map((h) => {
          const d = daysLeft(h.deadline);
          const bar = d <= 14 ? "bg-brick" : d <= 45 ? "bg-honey" : "bg-leaf";
          const txt = d <= 14 ? "text-brick" : d <= 45 ? "text-honey" : "text-leaf";
          const pct = Math.max(6, Math.min(100, (d / 90) * 100));
          const [sLabel, sCls] = SEASON_TONE[h.status];
          return (
            <Link key={h.id} to={`/hackathons/${h.id}`}
              className="grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,2fr)_110px_110px] gap-x-5 gap-y-2 items-center py-[18px] border-b border-liness last:border-b-0 hover:bg-cream/60 transition-colors group">
              <span className="flex items-center gap-3.5 min-w-0">
                <OrgImg src={avatarOf(h.orgLogo, 64)} name={h.orgLogo} className="w-[36px] h-[36px] rounded-[11px] object-cover bg-sand shrink-0" />
                <span className="min-w-0">
                  <b className="block card-title text-[14.5px] group-hover:text-rust transition-colors">{h.name}</b>
                  <span className="flex items-center gap-2 mt-1">
                    <span className={`font-mono text-[9px] font-bold tracking-[.08em] uppercase px-2 py-[3px] rounded-full border ${sCls}`}>{sLabel}</span>
                    <span className="font-mono text-[10.5px] text-dim truncate max-[500px]:hidden">{h.org}</span>
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block h-[6px] rounded-full bg-sand overflow-hidden">
                  <span className={`block h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </span>
                <span className={`block font-mono text-[10px] mt-1.5 ${txt}`}>{d > 0 ? `${d} days of runway` : "Final days"}</span>
              </span>
              <span className="font-mono text-[11.5px] font-bold text-honey truncate">{h.prize.split("+")[0].trim()}</span>
              <span className="text-right md:text-left">
                <b className="block font-mono text-[12.5px] text-ink">{fmtDate(h.deadline)}{h.estimated ? "*" : ""}</b>
                <span className="block font-mono text-[9.5px] text-dim mt-0.5">{h.deadline.slice(0, 4)}</span>
              </span>
            </Link>
          );
        })}
        <div className="flex items-center justify-between gap-3 py-4 flex-wrap">
          <span className="font-mono text-[10.5px] text-dim">* date estimated - confirm on the official page · {HACKS.length - rows.length} more events on the full calendar</span>
          <div className="flex gap-4 font-mono text-[10.5px] text-cocoa">
            {[["bg-leaf", "6+ weeks"], ["bg-honey", "2-6 weeks"], ["bg-brick", "under 2 weeks"]].map(([c, l]) => (
              <span key={l}><i className={`inline-block w-2.5 h-2.5 rounded-[4px] mr-1.5 align-[-1px] ${c}`} />{l}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── stats band ───────────────────────────────────────────── */
function Band() {
  const cells: [string, string, boolean][] = [
    [String(REPOS.length), "skills & repos tracked by stars", false],
    [String(HACKS.length), "hackathons with prep plans", true],
    [String(PROGRAMS.length), "mentored open source programs", true],
    [String(ORGS.length), "organizations profiled", true],
  ];
  return (
    <div className="max-w-[1240px] mx-auto px-6">
      <div className="mt-[92px] bg-sand border border-line rounded-[26px]">
        <div className="grid grid-cols-4 gap-5 px-[30px] py-[46px] text-center max-[860px]:grid-cols-2">
          {cells.map(([n, l, accent]) => (
            <div key={l}>
              <b className={`font-display block text-[38px] font-extrabold tracking-[-.02em] ${accent ? "text-accent" : ""}`}>{n}</b>
              <span className="text-cocoa text-[13px]">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── organizations: two counter-drifting rows ─────────────── */
function OrgMarquee() {
  const card = (o: (typeof ORGS)[number]) => (
    <Link key={o.login} to={`/organizations/${o.login}`}
      className="shrink-0 w-[250px] flex items-center gap-3 bg-card border border-line rounded-[18px] px-[17px] py-[15px] shadow-soft hover:-translate-y-1 hover:border-ember hover:shadow-lift transition-all">
      <OrgImg src={avatarOf(o.login, 88)} name={o.login} className="w-[42px] h-[42px] rounded-[12px] object-cover bg-sand shrink-0" />
      <span className="min-w-0">
        <b className="block card-title text-[14px] truncate">{o.name}</b>
        <span className="block text-[11.5px] text-cocoa truncate">{o.tagline}</span>
        <span className="font-mono text-[10.5px] text-honey font-bold">★ {fmt(o.stars)} · {o.repos} repos</span>
      </span>
    </Link>
  );
  const half = Math.ceil(ORGS.length / 2);
  const rowA = ORGS.slice(0, half).map(card);
  const rowB = ORGS.slice(half).map(card);
  return (
    <section id="orgs" className="max-w-[1240px] mx-auto px-6 pt-[92px]">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
        <div>
          <SectionTag>Where builders land</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-3">Popular <Word>organizations</Word></h2>
          <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[560px]">Hover to pause, click for the full profile with graphs.</p>
        </div>
        <Link className={btn("dark", "md")} to="/organizations">Browse all</Link>
      </div>
      <div className="marq-mask overflow-hidden">
        <div className="marq-track animate-marq">{rowA}{rowA}</div>
      </div>
      <div className="marq-mask overflow-hidden mt-3.5">
        <div className="marq-track animate-marq [animation-direction:reverse]">{rowB}{rowB}</div>
      </div>
    </section>
  );
}

/* ── testimonials: one drifting row on brown, every card
   links to the page behind the story ──────────────────────── */
const QUOTES: [string, string, string, string, string, string][] = [
  ["Priya N.", "ML engineer, Bengaluru",
    "The Nebius x NVIDIA prep plan said to pre-build the inference repo skeleton. We finished the demo two days early and made the judge shortlist.",
    "Finalist · AI agent track", "Hackathon plan", "/hackathons"],
  ["Marcus D.", "CS undergraduate",
    "I used to skim a dozen event pages. Now one page shows the timeline, the ideas and exactly which skills to install - I entered three hackathons in an evening.",
    "3 hackathons entered", "Hackathon plan", "/hackathons"],
  ["Sana K.", "Frontend developer",
    "Found the cursor rules and an MCP server through the catalog, wired my agent up in a weekend, and my Hacktoberfest PR count went from one to six.",
    "6 PRs merged in October", "Skill catalog", "/projects"],
  ["Arjun R.", "Backend developer, Pune",
    "The timeline told me LFX Term 3 was running right now. Applied with a kubernetes AGENTS.md fix from the catalog as my proof of work.",
    "LFX mentee", "Program calendar", "/organizations"],
  ["Wei L.", "Data scientist",
    "Kaggle hackathon pages map directly to the notebooks skills I needed. First submission in three years, top 8% this time.",
    "Top 8% finish", "Skill catalog", "/projects"],
  ["Fatima Z.", "Second-year student",
    "Outreachy felt impossible until the program calendar made the prep window obvious. Six weeks of small PRs got me paired.",
    "Outreachy Dec cohort", "Program calendar", "/organizations"],
  ["Diego M.", "Platform engineer",
    "Imagine Cup's approach notes matched our exact stack gap. We installed the MCP servers listed there on day zero.",
    "Regional winner", "Hackathon plan", "/hackathons"],
  ["Grace O.", "Career switcher",
    "Saved four orgs, watched the contributor stats, and picked the one with a 54-hour median review. First merged PR in nine days.",
    "First PR merged", "Org profile", "/dashboard"],
];
const Stars = () => (
  <span aria-label="5 out of 5 stars" className="font-mono text-[10px] tracking-[.28em] text-honey select-none">★★★★★</span>
);
const QuoteMark = () => (
  <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor" aria-hidden className="text-ember/70">
    <path d="M0 20v-8C0 5.4 3.8 1.3 10.6 0l1.4 3.1C8.5 4.4 6.6 6.8 6.5 10H12v10H0Zm12.4 0v-8c0-6.6 3.8-10.7 10.6-12L26.4 3.1c-3.5 1.3-5.4 3.7-5.5 6.9H24v10H12.4Z" transform="scale(.91)" />
  </svg>
);

function Testimonials() {
  const card = ([name, role, quote, outcome, feature, href]: typeof QUOTES[number], k: number) => (
    <Link key={name + k} to={href}
      className="group shrink-0 w-[384px] max-[700px]:w-[300px] bg-white/[.055] border border-white/12 rounded-[22px] p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-white/[.085] hover:shadow-[0_20px_44px_-20px_rgba(0,0,0,.6)]">
      <div className="flex items-start justify-between gap-3">
        <QuoteMark />
        <Stars />
      </div>
      <blockquote className="text-foam/90 text-[14px] leading-[1.7] mt-4 flex-1">{quote}</blockquote>
      <figcaption className="mt-5 pt-4 border-t border-white/12">
        <div className="flex items-center gap-3">
          <Avatar name={name} size={38} />
          <span className="min-w-0">
            <b className="block font-display text-[14px] text-white truncate">{name}</b>
            <span className="block text-[11.5px] text-steam truncate">{role}</span>
          </span>
          <span className="ml-auto shrink-0 font-mono text-[9.5px] font-bold uppercase tracking-[.08em] text-[#7ee2a8] border border-[#7ee2a8]/40 bg-[rgba(97,207,138,.14)] rounded-full px-2.5 py-[4px]">{outcome}</span>
        </div>
        <div className="flex items-center justify-between gap-3 mt-4">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-steam/80 border border-white/14 rounded-full px-2.5 py-[3px]">{feature}</span>
          <span className="text-[11.5px] text-steam underline decoration-white/25 underline-offset-4 group-hover:text-white group-hover:decoration-white/60 transition-colors">
            Open the {feature.toLowerCase()}
          </span>
        </div>
      </figcaption>
    </Link>
  );
  const row = QUOTES.map(card);
  return (
    <section id="stories" className="mt-[92px] bg-coffee border-y border-bean text-foam overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6 pt-14 pb-2">
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div>
            <SectionTag>Developer stories</SectionTag>
            <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(30px,3.8vw,44px)] mt-3 text-white">Built here, <Word>shipped there</Word>.</h2>
          </div>
          <p className="text-steam text-[14px] max-w-[400px] leading-[1.6]">Eight builders, two seasons of hackathons and mentored programs. The wall drifts - hover to pause, and every card opens the page behind that story.</p>
        </div>
      </div>
      <div className="marq-mask overflow-hidden py-8">
        <div className="marq-track animate-marq gap-4 px-4">{row}{row}</div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────── */
const FAQS: [string, string][] = [
  ["Are these the official hackathon dates?",
    "Every listing is checked against the organizer's official page, and the detail view always links straight to registration. Where an organizer has not confirmed a date yet we mark it estimated with an asterisk."],
  ["What do I get when I open a hackathon?",
    "Its full timeline, prize, eligibility and format, a curated idea list, the ideal tech stack, and a step-by-step prep and approach plan - written by us, kept on cyrus.ai, with one button out to the official site."],
  ["Do I need an account to use cyrus.ai?",
    "No. Browsing skills, hackathons, organizations and resources is fully open. Signing in only unlocks your saved shortlist and dashboard, and the demo auth keeps everything locally in your browser."],
  ["Are the agent skills free?",
    "Every skill, rule, config and MCP server in the catalog is open source on GitHub. Some organizations ask contributors to sign a CLA before a merge, and that is shown on the repo page."],
  ["How are the prep plans written?",
    "Each plan combines the organizer's judging rubric, winner post-mortems and mentor threads, then maps the required stack to skills from the 1,528-repo catalog so you can install, not improvise."],
  ["How often does the data refresh?",
    "GitHub stars, forks and issues come from a snapshot refreshed daily. Hackathon windows and deadlines are re-checked against official sources every week."],
];
const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-rust transition-transform duration-200 group-open:rotate-180">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function Faq() {
  return (
    <section id="faq-home" className="max-w-[1240px] mx-auto px-6 pt-[92px]">
      <div className="grid grid-cols-[.72fr_1.28fr] gap-12 max-[1020px]:grid-cols-1 max-[1020px]:gap-8 items-start">
        <div>
          <SectionTag>Answers, plainly</SectionTag>
          <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.06] text-[clamp(32px,4vw,50px)] mt-3">Frequently asked <Word>questions</Word></h2>
          <p className="text-cocoa mt-3 text-[15px] leading-[1.6]">Anything else? The about page explains exactly how this catalog is built.</p>
          <Link className={`${btn("outline", "sm")} mt-4`} to="/about">How we rank data</Link>
        </div>
        <div className="grid gap-3">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group bg-card border border-line rounded-[16px] px-6 py-[18px] open:shadow-soft transition-all">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-display font-bold text-[15.5px] [&::-webkit-details-marker]:hidden">
                {q}{Chevron()}
              </summary>
              <p className="text-cocoa text-[14px] leading-[1.7] mt-3.5 max-w-[640px]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── closing CTA: full-bleed coffee band with a glass card, its
   LED strip echoing the footer arc the section flows straight into ═ */
function Cta() {
  const { setAuthOpen } = useStore();
  return (
    <section className="cta-close mt-[110px] relative overflow-hidden bg-coffee text-foam">
      <span aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(244,238,227,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,238,227,.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(900px_520px_at_50%_42%,#000_40%,transparent)]" />
      <span aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(720px_340px_at_50%_-12%,rgba(217, 133, 70,.20),transparent_70%),radial-gradient(560px_300px_at_90%_108%,rgba(47, 125, 114,.14),transparent_70%),radial-gradient(520px_280px_at_5%_104%,rgba(180, 96, 44,.18),transparent_70%)]" />
      <div className="relative max-w-[920px] mx-auto px-6 pt-[104px] pb-[120px]">
        <div className="rounded-[30px] border border-white/12 bg-white/[.055] backdrop-blur-[6px] px-10 py-14 max-[700px]:px-6 max-[700px]:py-10 text-center shadow-[0_44px_100px_-44px_rgba(0,0,0,.7)]">
          <div className="footer-arc w-[120px] mx-auto" />
          <span className="inline-flex items-center gap-2.5 font-mono text-[10.5px] font-bold tracking-[.18em] uppercase text-foam/90 bg-white/8 border border-white/15 rounded-full px-4 py-2 mt-9">
            <span className="text-honey leading-none">✦</span> Ready for your next season?
          </span>
          <h2 className="font-display font-extrabold text-white text-[clamp(30px,4.3vw,50px)] leading-[1.12] tracking-[-.025em] mt-7">
            Stop hunting for projects.<br />Start shipping <span className="text-ember">them.</span>
          </h2>
          <p className="text-steam mt-5 mx-auto max-w-[500px] text-[16px] leading-[1.65]">
            Sign in free, save the hackathons, skills and orgs worth your weekend - the dashboard
            tracks every deadline so you never check a feed again.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-9">
            <button className={btn("primary", "lg")} onClick={() => setAuthOpen(true)}>Sign in &amp; open dashboard</button>
            <Link className={`${btn("outline", "lg")} !bg-white/7 !border-white/18 !text-foam hover:!bg-white/13`} to="/hackathons">Browse hackathons</Link>
          </div>
          <p className="mt-7 font-mono text-[10.5px] tracking-[.1em] uppercase text-dimdk">
            Demo auth, stored locally · no email spam · <Link className="text-foam underline underline-offset-3 normal-case tracking-normal" to="/about#data">how we rank repos</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Programs />
      <Timeline />
      <HackathonShelf />
      <HowItWorks />
      <Roadmap />
      <Season />
      <Band />
      <OrgMarquee />
      <Testimonials />
      <Faq />
      <Cta />
    </>
  );
}
