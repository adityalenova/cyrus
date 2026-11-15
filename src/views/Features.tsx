"use client"
/* ══ Features.tsx — /platform/features ═
   Section language borrowed from a best-in-class features page:
   numbered workflow card, feature list with floating product tile,
   "collect once, satisfy all three" program table, and a day-by-day
   timeline - all in the cyrus.ai coffee/honey theme.            ═ */
import { Link } from "@/lib/router";
import { fmtCompact } from "../lib/util";
import { btn, Word } from "../components/ui";
import { REPOS, CATEGORIES } from "../data/repos";
import { PROGRAMS } from "../data/orgs";
import { CRAWL } from "../data/crawlStats";
import { W, Pill, Ico, Check, Tile, CenterHead, GridBG, PlatCTA, Rule } from "../components/plat";
import CompanyBand from "../components/CompanyBand";

/* ── icon paths ── */
const D: Record<string, string> = {
  bookmark: "M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1Z",
  eye: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2",
  check: "M4 12.5 10 18.5 20 6",
  grid: "M4 5h7v7H4zM13 5h7v4h-7zM13 12h7v7h-7zM4 15h7v4H4z",
  building: "M4 21V6l8-3v18M12 21h8V10l-8-2.4M2 21h20",
  gauge: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8.5 3.5A9.9 9.9 0 0 1 2 12C2 6.5 6.5 2 12 2s10 4.5 10 10a9.9 9.9 0 0 1-1.5 5.5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  scale: "M12 3v18M8 21h8M3 7h6l-3 7-3-7Zm0 0 3 7m6-7h6l-3 7-3-7Zm0 0 3 7",
  spark: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z",
  shield: "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3Z",
  calendar: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5",
  flag: "M5 21V4m0 0 6 2 8-2v9l-8 2-6-2",
};

/* ── section 2: numbered workflow (image 1) ── */
const FLOW: [string, string, string, string][] = [
  ["bookmark", "rust", "Saved issues", "Save an issue once and it lands on your board with its labels, its age and the repository it belongs to."],
  ["eye", "honey", "Working stages", "saved › interested › working on it › completed. One click moves an issue through your pipeline."],
  ["calendar", "plum", "Program windows", "The calendar says which phase each program is in today, from the organizer's own published dates."],
  ["gauge", "leaf", "Org fit", "Language mix, open-issue load, review latency and five years of accepted projects - per organization, from GitHub."],
];
function Workflow() {
  return (
    <section className={`${W} mt-[54px] grid grid-cols-[.9fr_1.1fr] gap-14 items-center max-[1020px]:grid-cols-1 max-[1020px]:gap-10`}>
      <div>
        <Pill>Contributor workflow</Pill>
        <h2 className="font-display font-extrabold tracking-[-.025em] leading-[1.08] text-[clamp(30px,3.8vw,46px)] mt-6">
          Your prep lives on the platform. <span className="text-accent">Not across twelve tabs.</span>
        </h2>
        <p className="text-cocoa text-[15.5px] leading-[1.7] mt-6">
          Sign in once and cyrus keeps the whole picture in one place: which issues you took,
          what stage each is at, which orgs you follow, and which program window is still open.
        </p>
        <ul className="grid gap-3 list-none mt-7">
          {[
            "Every issue keeps its real GitHub state - labels, last touch, and the live thread.",
            "Saved organizations feed the profile pages, so you see an org's load before you commit.",
            "The board lives in your browser first; a real session syncs it to private rows you own.",
          ].map((x) => (
            <li key={x} className="flex items-start gap-3 text-[14.5px] text-cocoa leading-[1.55]">
              <span className="mt-[7px] w-[7px] h-[7px] rounded-full bg-leaf shrink-0 shadow-[0_0_0_3px_rgba(62,125,79,.14)]" />{x}
            </li>
          ))}
        </ul>
        <div className="flex gap-2.5 flex-wrap mt-8">
          {["Local-first board", "No email required", "One-click statuses"].map((c) => (
            <span key={c} className="bg-card border border-line rounded-full px-4 py-2 text-[12.5px] font-semibold text-ink shadow-soft">{c}</span>
          ))}
        </div>
      </div>
      <div className="rounded-[26px] border border-line bg-cream p-8 shadow-lift relative overflow-hidden">
        <span aria-hidden className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(400px_120px_at_50%_0%,rgba(255,255,255,.05),transparent_70%)]" />
        <p className="text-center font-mono text-[10.5px] font-bold tracking-[.22em] uppercase text-leaf">Cyrus workflow</p>
        <h3 className="text-center font-display font-extrabold text-[24px] tracking-[-.02em] mt-2 mb-7">Saved to merged PR</h3>
        <div className="relative">
          <span aria-hidden className="absolute left-[21px] top-6 bottom-6 w-px bg-liness" />
          <div className="grid gap-3.5">
            {FLOW.map(([d, tone, b, p], i) => (
              <div key={b} className="flex items-start gap-4 relative">
                <Tile d={D[d]} tone={tone} size={44} />
                <div className="flex-1 bg-card border border-line rounded-[16px] px-5 py-4 shadow-soft">
                  <div className="flex items-baseline gap-3">
                    <b className="card-title text-[15.5px]">{b}</b>
                    <span className="ml-auto font-mono text-[13px] font-bold text-dim">0{i + 1}</span>
                  </div>
                  <p className="card-desc text-[13px] mt-1.5">{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-7 max-[520px]:grid-cols-1">
          <span className="flex items-center justify-center gap-2 bg-card border border-line rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-cocoa"><Ico d={D.shield} size={13} />Real GitHub threads only</span>
          <span className="flex items-center justify-center gap-2 bg-card border border-line rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-cocoa"><Ico d={D.eye} size={13} />Your board stays yours</span>
        </div>
      </div>
    </section>
  );
}

/* ── section 3: always know where you stand (image 2) ── */
const STAND: [string, string, string, string][] = [
  ["grid", "plum", "Overview", "Issues in flight, repositories you follow, the languages your board actually covers and the one thing to do next - on one screen."],
  ["bookmark", "denim", "My Issues", "Every issue you saved, grouped by stage: saved, interested, working on it, completed. Each row links to the live thread."],
  ["layers", "honey", "The archive now", "A coffee-dark strip showing exactly how many open issues, projects, orgs and program years the index is built on."],
  ["check", "leaf", "Next steps", "A short checklist that ticks itself as you save an issue, follow a repo and pick a program. No mystery about what to do next."],
  ["users", "rust", "Organization profiles", "Signals before you commit: language mix, live open-issue count and the projects that org has already accepted."],
];
function Stand() {
  return (
    <section className={`${W} mt-[54px] grid grid-cols-[.85fr_1.15fr] gap-14 items-center max-[1020px]:grid-cols-1 max-[1020px]:gap-10`}>
      <div className="relative">
        <Pill>Dashboard &amp; controls</Pill>
        <h2 className="font-display font-extrabold tracking-[-.025em] leading-[1.1] text-[clamp(28px,3.4vw,42px)] mt-6">
          Always know exactly<br />where you stand.
        </h2>
        <p className="text-cocoa text-[15px] leading-[1.75] mt-6">
          cyrus gives your season complete visibility from a single board. Instead of chasing
          issue threads, org READMEs and program docs across a fortnight, you instantly see what
          you took, what stage it is at, which orgs are worth your time and how close you are to
          applying.
        </p>
        <Link to="/dashboard" className={`${btn("primary", "lg")} mt-8`}>Open the dashboard</Link>
      </div>
      <div className="relative">
        <div className="grid gap-6">
          {STAND.map(([d, tone, b, p]) => (
            <div key={b} className="flex gap-4 items-start">
              <span className={`w-[46px] h-[46px] rounded-full border grid place-items-center shrink-0 bg-card ${""}`} style={{ borderColor: "var(--color-line)" }}>
                <span className={tone === "rust" ? "text-rust" : tone === "plum" ? "text-plum" : tone === "honey" ? "text-honey" : tone === "denim" ? "text-denim" : "text-leaf"}><Ico d={D[d]} size={19} /></span>
              </span>
              <span className="min-w-0">
                <b className="block font-display font-bold text-[16.5px] text-ink mb-1">{b}</b>
                <span className="block text-cocoa text-[13.5px] leading-[1.6]">{p}</span>
              </span>
            </div>
          ))}
        </div>
        <Link to="/dashboard" className="absolute -right-2 top-[46%] w-[118px] h-[118px] rounded-[26px] bg-coffee text-foam grid place-items-center text-center shadow-lift hover:-translate-y-1 transition-transform max-[1020px]:hidden">
          <span>
            <span className="block mx-auto mb-2 w-7 h-7 rounded-full border-2 border-ember grid place-items-center"><Ico d={D.gauge} size={13} /></span>
            <b className="font-display font-bold text-[13px] leading-snug block">cyrus<br />Dashboard</b>
          </span>
        </Link>
      </div>
    </section>
  );
}

/* ── section 4: collect once, satisfy all three (image 3) ── */
const PROGRAM_CARDS: [string, string, string, string][] = [
  ["shield", "plum", "Google Summer of Code", "175–350 h mentored project. One proposal, one summer, a stipend and a permanent open-source footprint."],
  ["layers", "leaf", "LFX Mentorship", "140 h terms, three rounds a year. Smaller scope, faster feedback, same mentor rigor."],
  ["flag", "honey", "GSSoC", "A 45-day contribution sprint with a scored issue ledger - the beginner on-ramp that rewards steady PRs."],
];
const TABLE: [string, boolean, boolean, boolean][] = [
  ["Profile with real projects", true, true, true],
  ["Merged PR track record", true, true, true],
  ["Skills matched to the org's stack", true, true, true],
  ["Mentor conversations started early", true, true, false],
  ["Written proposal", true, true, false],
  ["Deadline calendar tracked", true, true, true],
];
function Collect() {
  return (
    <section className={`${W} mt-[54px]`}>
      <CenterHead pill="Program intelligence" h2={<>Collect once. <Word>Satisfy all three.</Word></>}
        sub="GSoC, LFX and GSSoC reward the same underlying work: a credible profile, a visible PR history and a stack that matches the org. cyrus builds that evidence once and maps it to every program you're targeting." />
      <div className="grid grid-cols-3 gap-5 mt-12 max-[900px]:grid-cols-1">
        {PROGRAM_CARDS.map(([d, tone, b, p], i) => (
          <div key={b} className={`bg-card border border-line rounded-[20px] p-7 shadow-soft ${i === 0 ? "lg:-translate-y-3" : ""} max-[900px]:translate-y-0`}>
            <Tile d={D[d]} tone={tone} size={42} />
            <b className="block font-display font-bold text-[17px] mt-5 mb-2">{b}</b>
            <p className="text-cocoa text-[13.5px] leading-[1.65]">{p}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-line rounded-[20px] overflow-hidden shadow-soft mt-6">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-cream">
              <th className="px-6 py-4 text-[13px] font-bold">Evidence you build</th>
              <th className="px-4 py-4 text-[13px] font-bold">GSoC</th>
              <th className="px-4 py-4 text-[13px] font-bold">LFX</th>
              <th className="px-4 py-4 text-[13px] font-bold">GSSoC</th>
            </tr>
          </thead>
          <tbody>
            {TABLE.map(([r, a, b, c]) => (
              <tr key={r} className="border-t border-liness">
                <td className="px-6 py-4 text-[13.5px] font-semibold text-ink">{r}</td>
                {[a, b, c].map((v, i) => (
                  <td key={i} className="px-4 py-4">{v ? <Check /> : <span className="text-dim font-mono text-[12px]">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── section 5: the 12-week timeline (image 4) ── */
const TL: [string, string, string][] = [
  ["Day 0", "Pick the season", "GSoC, LFX, Outreachy or GSSoC - the program calendar shows the phase each one is in today and the window you can still hit."],
  ["Days 1–3", "Shortlist five organizations", "Profile pages put an org's language mix, live open-issue count and accepted-project history on one screen."],
  ["Days 3–10", "Take real issues", "Save the issues you want to work; each one carries its labels, its age and the link back to the live thread."],
  ["Days 10–35", "Ship small merged PRs", "Move issues through working and done on your board. A merged pull request is the strongest line in any proposal."],
  ["Days 35–56", "Draft with the archive", "Five years of accepted projects by size, stack and difficulty become your structure."],
  ["Days 56–70", "Apply, tracked", "Every window on one calendar. No tab left un-refreshed."],
];
function Timeline() {
  return (
    <section className={`${W} mt-[54px] max-w-[860px]`}>
      <CenterHead pill="The cyrus method" h2={<>From zero to <Word>accepted</Word> in ten weeks. Here's exactly how.</>}
        sub="cyrus walks you through every step. You never have to figure out what to do next." />
      <div className="relative mt-12 ml-2">
        <span aria-hidden className="absolute left-[7px] top-2 bottom-2 w-px bg-liness" />
        <div className="grid gap-7">
          {TL.map(([w, b, p]) => (
            <div key={b} className="relative pl-9">
              <span aria-hidden className="absolute left-0 top-[7px] w-[15px] h-[15px] rounded-full border-[3px] border-accent bg-paper" />
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="font-mono text-[10.5px] font-bold tracking-[.08em] uppercase text-rust bg-peach border border-accent/25 rounded-full px-3 py-1">{w}</span>
                <b className="font-display font-bold text-[16.5px]">{b}</b>
              </div>
              <p className="text-cocoa text-[14px] leading-[1.65] mt-1.5 max-w-[600px]">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── section 6: the full shelf grid ── */
const SHELVES: [string, string, string, string, string][] = [
  ["Skill catalog", "/skills", "grid", "rust", `${fmtCompact(REPOS.length)} agent skills, Cursor rules, config packs and MCP servers across ${CATEGORIES.length} curated shelves.`],
  ["Open issues", "/dashboard/issues", "bookmark", "denim", `${fmtCompact(CRAWL.issues)} issues crawled live from GitHub on ${CRAWL.crawledAt}, with their labels and age.`],
  ["Organization profiles", "/organizations", "building", "plum", "Live GitHub signals plus five years of accepted projects, per org."],
  ["Program calendar", "/projects", "calendar", "honey", `${PROGRAMS.length} mentored programs and contribution seasons, each in its published phase.`],
  ["Project archive", "/projects", "layers", "leaf", "6,600+ accepted program projects, filterable by year, stack and difficulty."],
  ["Your board", "/dashboard", "gauge", "brick", "The issues you took, the repositories you follow and the next step on each."],
];
function Shelves() {
  return (
    <section className={`${W} mt-[54px]`}>
      <CenterHead pill="What's on the platform" h2={<>Six shelves. <Word>One keystroke.</Word></>} />
      <div className="grid grid-cols-3 gap-5 mt-11 max-[1020px]:grid-cols-2 max-[640px]:grid-cols-1">
        {SHELVES.map(([b, to, d, tone, p]) => (
          <Link key={b} to={to} className="group bg-card border border-line rounded-[20px] p-6 shadow-soft hover:-translate-y-1 hover:border-ember hover:shadow-lift transition-all">
            <Tile d={D[d]} tone={tone} size={42} />
            <b className="block card-title text-[16px] mt-5 mb-1.5 group-hover:text-rust transition-colors">{b}</b>
            <p className="card-desc text-[13px]">{p}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Features() {
  return (
    <div className="relative">
      <GridBG pos="50% 12%" />
      <div className="relative">
        <header className={`${W} pt-[72px] pb-2 text-center`}>
          <Pill center>Platform · Features</Pill>
          <h1 className="font-display font-extrabold tracking-[-.025em] leading-[1.05] text-[clamp(38px,5vw,62px)] mt-6 max-w-[840px] mx-auto">
            Everything a contributor needs. <Word>One platform.</Word>
          </h1>
          <p className="text-cocoa text-[16.5px] leading-[1.7] max-w-[600px] mx-auto mt-5">
            Discovery, prep, tracking and proof - the full arc from "I should ship something"
            to a merged PR, without ever leaving the index.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-8">
            <Link to="/dashboard" className={btn("dark", "lg")}>Open your board</Link>
            <Link to="/platform/how" className={btn("outline", "lg")}>See the method</Link>
          </div>
        </header>
        <Rule />
        <Workflow />
        <Rule />
        <Stand />
        <Rule />
        <Collect />
        <Rule />
        <Timeline />
        <Rule />
        <Shelves />
        <Rule />
        <section className={`${W} mt-[54px] mb-6 text-center`}>
          <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(26px,3.2vw,38px)]">
            Ready to see it on <Word>your</Word> stack?
          </h2>
          <PlatCTA to="/dashboard" label="Open the dashboard" also={["/platform/how", "See how the board works"]} />
        </section>
        <CompanyBand />
      </div>
    </div>
  );
}
