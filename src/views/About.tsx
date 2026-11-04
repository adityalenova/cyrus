"use client"
/* ══ About.tsx — mission, capabilities, methodology, FAQ ══════
   Structure borrowed from a best-in-class about page:
   manifesto hero with an orbit of the orgs we index, expandable
   capability grid, why-we-exist editorial, numbered principles,
   then the honest data & methodology + FAQ.                    ═ */
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { REPOS, CATEGORIES } from "../data/repos";
import { ORGS, PROGRAMS } from "../data/orgs";
import { CRAWL } from "../data/crawlStats";
import { STATS } from "../lib/siteStats";
import { avatarOf, fmtCompact } from "../lib/util";
import { btn, Word, SectionTag, OrgImg, Logo } from "../components/ui";
import { Rule } from "../components/plat";
import CompanyBand from "../components/CompanyBand";

const W = "max-w-[1240px] mx-auto px-6";

/* ── shared bits ──────────────────────────────────────────── */
const Pill = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 font-mono text-[10.5px] font-bold tracking-[.18em] uppercase text-ink bg-card border border-line rounded-full px-4 py-2 shadow-soft">
    <span className="text-accent leading-none">✦</span>{children}
  </span>
);
const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3e7d4f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M4 12.5 10 18.5 20 6" />
  </svg>
);
const Chev = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ── orbit of the organizations we index (image-1 signature) ─ */
const ORBIT: [string, number, number][] = [
  /* login, angle°, radius% (0 = center) */
  ["google", 250, 21], ["github", 322, 21], ["openai", 34, 21], ["anthropics", 106, 21], ["huggingface", 178, 21],
  ["microsoft", 200, 37], ["pytorch", 235, 37], ["tensorflow", 270, 37], ["kubernetes", 305, 37], ["vercel", 340, 37],
  ["cloudflare", 15, 37], ["flutter", 50, 37], ["rust-lang", 85, 37], ["docker", 120, 37], ["supabase", 155, 37],
];
function Orbit() {
  return (
    <div className="relative w-full max-w-[560px] aspect-square mx-auto select-none" aria-label="Organizations indexed by cyrus.ai">
      {/* dashed orbit rings */}
      {[42, 74, 100].map((s) => (
        <span key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-clay/80" style={{ width: `${s}%`, height: `${s}%` }} />
      ))}
      {/* soft warm core */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46%] h-[46%] rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 68%)" }} />
      {/* center identity card */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] flex items-center gap-2.5 bg-card border border-line rounded-[18px] px-5 py-3.5 shadow-lift">
        <Logo size={26} />
        <b className="font-display font-extrabold text-[19px] tracking-[-.02em]">cyrus<span className="text-accent">.ai</span></b>
      </span>
      {/* org tiles */}
      {ORBIT.map(([login, deg, r], i) => {
        const a = (deg * Math.PI) / 180;
        const size = r < 30 ? 56 : i % 3 === 0 ? 62 : 50;
        return (
          <span key={login} className="absolute z-[1] grid place-items-center bg-card border border-line rounded-[16px] shadow-soft"
            style={{ width: size, height: size, left: `calc(50% + ${Math.cos(a) * r}%)`, top: `calc(50% + ${Math.sin(a) * r}%)`, transform: "translate(-50%,-50%)" }}>
            <OrgImg src={avatarOf(login, 96)} name={login} className="object-contain" style={{ width: size * 0.56, height: size * 0.56 }} />
          </span>
        );
      })}
    </div>
  );
}

/* ── capabilities: expandable cards (image-3 signature) ───── */
const CAP_IC = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const capIcon = (d: string) => <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden {...CAP_IC}><path d={d} /></svg>;
const CAPS: [string, string, string, string, ReactNode, string][] = [
  ["Skill catalog", `/skills`, "text-rust bg-peach border-accent/20",
    `${REPOS.length} agent skills, Cursor rules, AGENTS.md configs and MCP servers across ${CATEGORIES.length} shelves - ranked by live GitHub stats, never by hype.`,
    capIcon("M4 5h7v7H4zM13 5h7v4h-7zM13 12h7v7h-7zM4 15h7v4H4z"),
    "Every shelf is filtered by what the repo itself declares - SKILL.md, rules files, MCP manifests - and each card carries stars, forks, last-push and license from the public API."],
  ["Open issues, counted", "/dashboard/issues", "text-denim bg-denim/10 border-denim/25",
    `${fmtCompact(CRAWL.issues)} open issues in ${fmtCompact(CRAWL.reposWithIssues)} of the ${fmtCompact(CRAWL.catalogRepos)} catalog repositories, crawled ${CRAWL.crawledAt}.`,
    capIcon("M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"),
    "An issue is only listed when GitHub still reports it open. Age, labels and the repository's own star count travel with it, so a stale invitation is obvious before you spend an evening on it."],
  ["Organization profiles", "/organizations", "text-leaf bg-leaf/10 border-leaf/25",
    "Contributor pulse before you commit: language mix, open issues, review latency, past accepted projects and who actually mentors there.",
    capIcon("M4 21V6l8-3v18M12 21h8V10l-8-2.4M7 10h1M7 14h1M7 18h1M16 13h1M16 17h1M2 21h20"),
    "Profiles join our live GitHub directory with the accepted-project archive, so a page shows both the code signal and the program history for the same organization."],
  ["Program calendar", "/projects", "text-plum bg-plum/10 border-plum/25",
    `GSoC, Outreachy, LFX, ESOC, MLH Fellowship, GSSoC, KDE, Summer of Bitcoin, Nexus Spring of Code, 24 Pull Requests and Hacktoberfest - ${PROGRAMS.length} tracked windows on one timeline.`,
    capIcon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2"),
    "Each program page shows the phase you are actually in today - organization applications, participant applications, community bonding, coding period - with the window dates the organizer publishes."],
  ["Project archive", "/projects", "text-honey bg-honey/12 border-honey/40",
    `${fmtCompact(STATS.archive)} program projects from the ${STATS.archivePrograms} archives we can read, 2017 to 2026, filterable by year, organization, stack and difficulty.`,
    capIcon("M3 7l9-4 9 4v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 7l9 4 9-4M12 11v10"),
    "Pulled from each program's public API by our refresh pipeline - titles, orgs, mentors, tech tags and descriptions, never hand-typed."],
  ["Your board", "/dashboard", "text-rust bg-peach border-accent/20",
    "Issues you are tracking through saved, interested, working and done; the repositories you follow; the languages that come out of both.",
    capIcon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8.5 3.5A9.9 9.9 0 0 1 2 12C2 6.5 6.5 2 12 2s10 4.5 10 10a9.9 9.9 0 0 1-1.5 5.5"),
    "Sign-in is demo-grade on purpose: everything lives in your browser's localStorage until a session backend is attached. No email, no tracking pixel, no spam."],
];
function Capabilities() {
  return (
    <section className={`${W} mt-[54px] scroll-mt-24`} id="capabilities">
      <div className="text-center max-w-[640px] mx-auto">
        <Pill>One contributor platform</Pill>
        <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(30px,3.8vw,44px)] mt-5 leading-[1.12]">
          Everything you need. <Word>One index.</Word>
        </h2>
        <p className="text-cocoa text-[15.5px] leading-[1.65] mt-4">Click any capability to see what's inside.</p>
      </div>
      <div className="grid grid-cols-3 gap-5 mt-10 max-[1020px]:grid-cols-2 max-[660px]:grid-cols-1">
        {CAPS.map(([t, to, tone, d, ic, more]) => (
          <details key={t} className="group bg-card border border-line rounded-[20px] p-6 shadow-soft open:shadow-lift transition-shadow">
            <summary className="list-none cursor-pointer grid grid-cols-[44px_1fr_34px] gap-3.5 items-start [&::-webkit-details-marker]:hidden">
              <span className={`w-[44px] h-[44px] rounded-[13px] grid place-items-center border ${tone}`}>{ic}</span>
              <span className="min-w-0">
                <b className="block card-title text-[16.5px] leading-snug group-hover:text-rust transition-colors">{t}</b>
                <span className="block card-desc line-clamp-2 mt-1.5">{d}</span>
              </span>
              <span className="w-[34px] h-[34px] rounded-full border border-accent/35 text-accent grid place-items-center justify-self-end self-center group-open:rotate-180 transition-transform">
                <Chev />
              </span>
            </summary>
            <div className="mt-4 pt-4 border-t border-liness">
              <p className="text-cocoa text-[13.5px] leading-[1.65]">{more}</p>
              <Link to={to} className={`${btn("outline", "sm")} mt-4`}>Open it</Link>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ── principles ───────────────────────────────────────────── */
const PRINCIPLES: [string, string][] = [
  ["Verify, don't vibe.", "Every number starts from a public API snapshot regenerated by a script - stars, forks, open issues, license, last push. Nothing is typed by hand, and estimates are labelled as estimates."],
  ["One page over twelve tabs.", "An issue carries its labels, its age and the repository it belongs to; an org carries its contributors, review latency and accepted projects. Both answer the same question - can I start this weekend - without a second tab."],
  ["Credit where it's due.", "Official org logos come from GitHub itself, every issue and pull request links to the real thread on github.com, and program pages name the organizer rather than paraphrase them."],
  ["Free, and visibly so.", "No account to browse, no email to save, no dark patterns. Demo sign-in keeps everything in your browser's localStorage, and the whole index stays open."],
];

const FAQS: [string, string][] = [
  ["Where does the data come from?",
   "Every number on cyrus.ai starts from the public GitHub API. We snapshot the catalog once a fortnight - stars, forks, open issues, license, last push - and repo pages re-fetch contributors and language breakdowns live when you open them."],
  ["How do you decide what counts as a “skill” or an “MCP server”?",
   "A repo lands on a shelf if its own README says so: SKILL.md files for Agent Skills, .cursor/rules or mdc files for Cursor rules, AGENTS.md / DESIGN.md for configs, and an mcp server manifest or registry entry for MCP servers. Ambiguous repos go to the Dev Agents shelf."],
  ["Why rank by stars at all, if stars are hype?",
   "They're the only cross-repo signal that's public, historical and cheap to verify. We show forks, open issues and last-push beside every star count so a 200k repo that hasn't moved in a year doesn't pretend otherwise."],
  ["How current are the open issues?",
   `The issue index is a real crawl of GitHub's search API, last run ${CRAWL.crawledAt} across ${fmtCompact(CRAWL.reposWithIssues)} repositories. An issue is listed only while GitHub still reports it open, but a repo can merge or close one between crawls - so every card links to the live thread and says how long ago it was touched.`],
  ["Can I list my own repository?",
   "Yes - save a bookmark on /projects for the submit flow we're shipping next: paste a GitHub URL, we enrich the metadata from the API, and your repo joins the review queue for the right shelf."],
  ["Is this affiliated with GitHub, Google or Anthropic?",
   "No. Logos belong to their owners, event names belong to their organizers, and this is an independent index. If anything here mislabels your project, tell us and we'll fix the snapshot."],
];

export default function About() {
  return (
    <>
      {/* ── manifesto hero + orbit ── */}
      <header className="relative overflow-hidden">
        <span aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,var(--gl)_1px,transparent_1px),linear-gradient(to_bottom,var(--gl)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(760px_480px_at_68%_38%,#000_50%,transparent)]" />
        <div className={`${W} relative pt-[72px] pb-4 grid grid-cols-[1.05fr_.95fr] gap-10 items-center max-[1020px]:grid-cols-1`}>
          <div>
            <Pill>About cyrus.ai</Pill>
            <h1 className="font-display font-extrabold tracking-[-.025em] leading-[1.04] mt-6 text-[clamp(38px,4.9vw,62px)]">
              Building the<br />
              <Word>honest</Word> index for<br />
              the agent era.
            </h1>
            <p className="text-cocoa text-[16.5px] leading-[1.7] max-w-[520px] mt-6">
              Contributors today juggle a dozen feeds to find one issue worth taking, one org that
              reviews, or one program window still open. We exist to make finding your next
              contribution simpler - and every number behind that decision verifiable.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-8 max-w-[520px]">
              {["Verified stats", "Official sources", "Live open issues", "Accepted-project archive", "Free forever"].map((c) => (
                <span key={c} className="inline-flex items-center gap-2 bg-card border border-line rounded-full px-4 py-2 text-[13px] font-semibold text-ink shadow-soft">
                  <Check />{c}
                </span>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap mt-9">
              <a href="#why" className={btn("dark", "lg")}>Our mission</a>
              <Link to="/organizations" className={btn("outline", "lg")}>Start exploring</Link>
            </div>
          </div>
          <Orbit />
        </div>
      </header>

      <Rule />
      <Capabilities />

      <Rule />
      {/* ── why we exist: editorial band ── */}
      <section id="why" className={`${W} mt-[54px] scroll-mt-24`}>
        <div className="grid grid-cols-[.9fr_1.1fr] gap-12 items-start max-[1020px]:grid-cols-1 max-[1020px]:gap-6">
          <div>
            <SectionTag>Why we exist</SectionTag>
            <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.12] text-[clamp(28px,3.4vw,40px)] mt-3.5">
              Discovery took longer than <Word>shipping.</Word>
            </h2>
          </div>
          <div className="grid gap-4 text-cocoa text-[15.5px] leading-[1.75]">
            <p>
              The work moved: agents, skills, programs that expect a real merged pull request
              before the application window closes. The discovery layer didn't. Finding a
              beginner-labelled issue an org still has open, an org that reviews PRs in under three
              days, or a program deadline you can still hit means twelve tabs, three Discords and a
              gut feeling.
            </p>
            <p>
              So we built the index we kept wishing for: {fmtCompact(CRAWL.issues)} open issues crawled
              from {fmtCompact(CRAWL.reposWithIssues)} repositories on {CRAWL.crawledAt}, a skill catalog of{" "}
              {REPOS.length} repositories across {CATEGORIES.length} shelves published by {ORGS.length}{" "}
              hand-picked organizations, {fmtCompact(CRAWL.orgs)} organizations in the issue crawl, the{" "}
              {PROGRAMS.length} mentored programs they join every year, and {fmtCompact(STATS.archive)} program projects from {STATS.archivePrograms}
              archives, 2017 to 2026 - each with the
              boring-but-decisive facts: stars, forks, open issues, language, license and last push.
            </p>
            <p>
              The directory is opinionated on purpose. A 67-skill pack by a solo builder sits next
              to Anthropic's official registry; an Outreachy internship is listed beside Google
              Summer of Code. If developers star it and it behaves like a skill, it's on a shelf.
            </p>
          </div>
        </div>
      </section>

      <Rule />
      {/* ── principles ─ */}
      <section className={`${W} mt-[54px]`}>
        <SectionTag>Our principles</SectionTag>
        <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(28px,3.4vw,40px)] mt-3.5 mb-9">
          Guided by <Word>four rules.</Word>
        </h2>
        <div className="grid grid-cols-2 gap-5 max-[860px]:grid-cols-1">
          {PRINCIPLES.map(([b, p], i) => (
            <div key={b} className="bg-card border border-line rounded-[20px] p-7 shadow-soft flex gap-5 items-start">
              <span className="font-mono text-[12px] font-bold text-accent bg-peach border border-accent/20 rounded-full w-8 h-8 grid place-items-center shrink-0">{i + 1}</span>
              <span>
                <b className="block panel-h text-[16.5px] mb-1.5">{b}</b>
                <p className="text-cocoa text-[14px] leading-[1.7]">{p}</p>
              </span>
            </div>
          ))}
        </div>
      </section>

      <Rule />
      {/* ── data & methodology + FAQ ── */}
      <section className={`${W} mt-[54px] grid grid-cols-[1fr_320px] gap-10 items-start max-[980px]:grid-cols-1`}>
        <article className="max-w-[720px]">
          <h2 id="data" className="font-display font-extrabold text-[24px] tracking-[-.02em] mb-3 scroll-mt-24">Data &amp; methodology</h2>
          <p className="text-cocoa text-[15px] leading-[1.75] mb-4">
            Static stats come from a GitHub API snapshot dated <b className="text-ink">2026-10-02</b>, regenerated by a
            script that walks the seed list, refetches each repo and rewrites the dataset - nothing is typed by hand.
            Repo and organization pages then re-fetch contributors and language mixtures live, and fall back to
            clearly-labelled deterministic estimates when the API is rate-limited. The issue index is a separate crawl
            of GitHub's search API, last run <b className="text-ink">{CRAWL.crawledAt}</b>, and the accepted-project
            archive refreshes from each program's public API on the same cadence.
          </p>
          <ul className="text-cocoa text-[15px] leading-[1.75] grid gap-2 list-disc pl-6 mb-4">
            <li><b className="text-ink">Ranking</b> - stars first; forks and last-push always shown so ranking context survives.</li>
            <li><b className="text-ink">Difficulty labels</b> - derived, not claimed: beginner under 10k★, intermediate to 50k★, advanced above.</li>
            <li><b className="text-ink">Beginner signal</b> - an issue counts as beginner-labelled only when GitHub carries a real good-first-issue or help-wanted label: {CRAWL.beginnerLabelled.toLocaleString("en-US")} of {CRAWL.issues.toLocaleString("en-US")} right now.</li>
            <li><b className="text-ink">Logos</b> - official org avatars via GitHub, and program covers are our own generated SVG artwork, never copied branding.</li>
            <li><b className="text-ink">Sign-in</b> - Google and email codes start a real session: an <code>httpOnly</code> cookie this server signs, not a value the page writes for itself. Your browsing state and saved items stay in your browser until a database is attached to the deploy.</li>
          </ul>

          <h2 id="faq" className="font-display font-extrabold text-[24px] tracking-[-.02em] mt-9 mb-5 scroll-mt-24">Frequently asked</h2>
          <div className="faq">
            {FAQS.map(([q, a]) => (
              <details key={q} className="border border-line rounded-2xl bg-card mb-2.5 overflow-hidden shadow-soft">
                <summary className="list-none cursor-pointer px-5 py-[18px] font-semibold text-[15px] flex justify-between items-center gap-4 [&::-webkit-details-marker]:hidden">
                  {q}
                </summary>
                <div className="px-5 pt-0 pb-5 text-cocoa text-[14.5px] leading-[1.7]">{a}</div>
              </details>
            ))}
          </div>
        </article>

        <aside className="sticky top-[86px] max-[980px]:static grid gap-4">
          <div className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
            <h3 className="panel-h text-[17px] mb-4">Catalog at a glance</h3>
            {[
              [fmtCompact(CRAWL.issues), "open issues, crawled"],
              [fmtCompact(CRAWL.reposWithIssues), "repositories crawled for issues"],
              [fmtCompact(STATS.archive), "program projects archived"],
              [String(STATS.archivePrograms), "program archives read"],
              [String(REPOS.length), "repos in the skill snapshot"],
              [String(ORGS.length), "organizations hand-picked"],
              [String(PROGRAMS.length), "mentorship programs tracked"],
              ["2026-10-02", "skill snapshot date"],
              [CRAWL.crawledAt, "issue crawl date"],
            ].map(([v, l]) => (
              <div key={l} className="flex items-baseline justify-between gap-3 py-2.5 border-b border-liness last:border-0">
                <b className="font-mono text-[17px]">{v}</b><span className="text-cocoa text-[12.5px] text-right">{l}</span>
              </div>
            ))}
          </div>
          <div className="bg-peach border border-accent/20 rounded-[20px] p-6">
            <h3 className="panel-h text-[17px] mb-2">Built by one developer, <Word>in Hyderabad.</Word></h3>
            <p className="text-rust text-[13px] leading-[1.65] mb-4">
              cyrus.ai is a solo project: a scraper, a design system and a grudge against “awesome lists”.
              Feedback, corrections and sponsorship suggestions all land in the same inbox.
            </p>
            <Link to="/organizations" className={btn("primary", "md", "w-full")}>Start with the orgs</Link>
          </div>
        </aside>
      </section>

      <Rule />
      {/* ── closing line ── */}
      <section className={`${W} mt-[54px] text-center max-w-[760px]`}>
        <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(26px,3.2vw,38px)] leading-[1.15]">
          A good index is earned <Word>one commit at a time.</Word>
        </h2>
        <p className="text-cocoa text-[15.5px] leading-[1.7] mt-4">
          Snapshots refresh every fortnight, dates get re-checked against organizers, and corrections from
          orgs and builders ship the same week. That's the whole trick - and the whole promise.
        </p>
        <div className="flex gap-3 justify-center flex-wrap mt-8">
          <Link to="/skills" className={btn("dark", "md")}>Browse the catalog</Link>
          <Link to="/dashboard" className={btn("outline", "md")}>Open your dashboard</Link>
        </div>
      </section>
      <CompanyBand />
    </>
  );
}
