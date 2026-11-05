"use client"
/* ══ How.tsx — /platform/how: three-step method sections ═
   Find the work, know the season, ship and keep the record. Every number
   quoted here is the real crawl (src/data/crawlStats.ts) and every panel row
   is real catalog or program data - no invented product features.        ═ */
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { btn, OrgImg } from "../components/ui";
import { avatarOf, fmtCompact, byStars } from "../lib/util";
import { W, Pill, StepHead, Behind, YourAction, MockPanel, MockRow, GridBG, PlatCTA, Rule } from "../components/plat";
import CompanyBand from "../components/CompanyBand";
import { CRAWL } from "../data/crawlStats";
import { STATS } from "../lib/siteStats";
import { REPOS } from "../data/repos";
import { ORGS, PROGRAMS } from "../data/orgs";
import { ISSUE_STAGES, STAGE_LABEL, STAGE_NOTE } from "../lib/dash/shared";

const D = {
  gauge: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4",
  calendar: "M4 6.5h16v14H4zM8 3v5m8-5v5M4 11h16",
  check: "M4 12.5 10 18.5 20 6",
};

/* data sources shown as official logos in step 02 */
const SOURCES: [string, string][] = [
  ["github", "GitHub REST + search API"],
  ["google", "GSoC program API"],
  ["linuxfoundation", "LFX mentorship API"],
  ["huggingface", "HF repository catalog"],
  ["vercel", "Vercel repository catalog"],
  ["cloudflare", "Cloudflare repository catalog"],
  ["kubernetes", "CNCF project tracks"],
  ["flutter", "Flutter / Google OSS"],
  ["pytorch", "AI-infra org signals"],
  ["openai", "OpenAI org signals"],
  ["microsoft", "Microsoft org signals"],
  ["anthropics", "Anthropic skills reg."],
];

function Step({ step, label, d, tone, h2, sub, behind, action, panel, flip }: {
  step: string; label: string; d: string; tone: string; h2: string; sub: string;
  behind: string[]; action: string; panel: ReactNode; flip?: boolean;
}) {
  return (
    <section className={`${W} mt-[54px] grid grid-cols-[1fr_1.05fr] gap-14 items-start max-[1020px]:grid-cols-1 max-[1020px]:gap-9`}>
      <div className={flip ? "lg:order-2" : ""}>
        <StepHead step={step} label={label} d={d} tone={tone} />
        <h2 className="font-display font-extrabold tracking-[-.025em] leading-[1.1] text-[clamp(26px,3.2vw,38px)]">{h2}</h2>
        <p className="text-cocoa text-[15px] leading-[1.75] mt-4">{sub}</p>
        <Behind items={behind} tone={tone} />
        <YourAction tone={tone}>{action}</YourAction>
      </div>
      <div className={`lg:sticky lg:top-[96px] ${flip ? "lg:order-1" : ""}`}>{panel}</div>
    </section>
  );
}

export default function How() {
  const top = REPOS.slice().sort(byStars).slice(0, 5);
  const windows = PROGRAMS.slice(0, 5);
  return (
    <div className="relative">
      <GridBG pos="50% 12%" />
      <div className="relative">
        <header className={`${W} pt-[64px] text-center`}>
          <Pill center>Platform · How it works</Pill>
          <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.05] text-[clamp(36px,4.8vw,58px)] mt-6 max-w-[780px] mx-auto">
            From an open issue to a merged pull request.
          </h1>
          <p className="text-cocoa text-[16.5px] leading-[1.7] max-w-[580px] mx-auto mt-5">
            Three moves: find work that is really open, know which season you are in, keep the record
            yourself. No resume upload, no onboarding call.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-8">
            <Link to="/skills" className={btn("dark", "lg")}>Browse the catalog</Link>
            <Link to="/platform/features" className={btn("outline", "lg")}>What is on the platform</Link>
          </div>
        </header>

        <Rule />

        {/* STEP 01 */}
        <Step step="01" label="Find work that is open" d={D.gauge} tone="rust"
          sub={`One place to search public GitHub data: ${fmtCompact(CRAWL.issues)} open issues from ${fmtCompact(CRAWL.reposWithIssues)} repositories, ${fmtCompact(STATS.archive)} archived program projects in the ${STATS.archivePrograms} program records, and ${fmtCompact(ORGS.length)} organizations with a profile of their own. Filter it, then open the thread on GitHub before you start work.`}
          h2="Start from what is actually open."
          behind={[
            `Issues crawled from ${fmtCompact(CRAWL.reposWithIssues)} active repositories on ${CRAWL.crawledAt}`,
            `Beginner-labelled work surfaced separately (${fmtCompact(CRAWL.beginnerLabelled)} issues)`,
            "Every repository page shows the README, guidelines and open work",
            "Organization pages carry their program history and flagship repos",
            "GitHub stays the source of truth - each row links to the live thread",
          ]}
          action="Search by language, label or organization. Nothing needs an account, and every result links straight to GitHub."
          panel={
            <MockPanel title="Project archive" label="Ranked by stars, straight from the catalog">
              {top.map((r, i) => (
                <MockRow key={r.repo} n={i + 1} tone="rust">
                  <b className="block">{r.repo.split("/")[1]}</b>
                  <span className="block text-[12px] font-medium text-dim mt-0.5 truncate">
                    {fmtCompact(r.stars)} stars · {fmtCompact(r.issues)} open issues · {r.lang}
                  </span>
                </MockRow>
              ))}
            </MockPanel>
          }
        />

        <Rule />

        {/* STEP 02 - mirrored */}
        <Step step="02" label="Know the season" d={D.calendar} tone="leaf" flip
          h2="Work the calendar, not the guesswork."
          sub={`${PROGRAMS.length} funded or mentored programs are tracked with their published application, selection and coding windows, and the organizations tied to them. The archive of accepted projects from the last five years tells you what those orgs actually shipped.`}
          behind={[
            "Program pages list stipends, windows and participating orgs",
            "Accepted-project archive lets you read a real proposal before writing one",
            "Organization profiles show which programs a project has joined",
            "Read-only public data: no tokens, no private repositories",
          ]}
          action="Pick the season you are aiming at and read two or three accepted projects from the org you want."
          panel={
            <MockPanel title="Program windows" label="Live status on the contributor calendar">
              {windows.map((p, i) => (
                <MockRow key={p.id} n={i + 1} tone="leaf">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <OrgImg src={avatarOf(p.owner, 48)} name={p.owner} className="w-[22px] h-[22px] rounded-[7px] object-cover bg-sand shrink-0" />
                    <span className="min-w-0">
                      <b className="block truncate">{p.name}</b>
                      <span className="block text-[12px] font-medium text-dim mt-0.5 truncate">{p.window}</span>
                    </span>
                  </span>
                </MockRow>
              ))}
              <div className="grid grid-cols-3 gap-2 pt-3">
                {SOURCES.slice(0, 6).map(([login, label]) => (
                  <span key={login} title={label} className="flex items-center gap-2 bg-paper border border-line rounded-[12px] px-2.5 py-2 min-w-0">
                    <OrgImg src={avatarOf(login, 48)} name={login} className="w-[18px] h-[18px] rounded-[6px] object-cover bg-sand shrink-0" />
                    <span className="text-[10px] text-dim truncate">{login}</span>
                  </span>
                ))}
              </div>
            </MockPanel>
          }
        />

        <Rule />

        {/* STEP 03 */}
        <Step step="03" label="Ship and keep the record" d={D.check} tone="honey"
          h2="One board, four stages."
          sub="The board is yours: the issues you take move through Saved, Interested, Working on it and Completed, and the repositories you follow sit next to them with their stars, open issues and last update. It is stored in your browser first, and mirrored to your account only when you sign in."
          behind={[
            "Paste a GitHub issue URL and it is tracked with its live title and labels",
            "Issues untouched for 90 days are flagged before you commit an evening",
            "The overview page tells you what needs you, derived from your own rows",
            "Export or delete everything the board remembers, from Settings",
            `Nothing is ever claimed on your behalf - assignments stay GitHub's to confirm`,
          ]}
          action="Track one issue today and advance it when you open the pull request. The board keeps the dates; GitHub keeps the record."
          panel={
            <MockPanel title="Your board" label="The four stages every tracked issue sits in">
              {ISSUE_STAGES.map((s, i) => (
                <MockRow key={s} n={i + 1} tone="honey">
                  <b className="block">{STAGE_LABEL[s]}</b>
                  <span className="block text-[12px] font-medium text-dim mt-0.5">{STAGE_NOTE[s]}</span>
                </MockRow>
              ))}
            </MockPanel>
          }
        />

        <Rule />

        <section className={`${W} mt-[54px] pb-6 text-center`}>
          <p className="text-cocoa text-[14.5px] leading-[1.7] max-w-[560px] mx-auto">
            That is the whole method - find, season, ship. The data behind each step is documented
            on the features and trust pages, and {fmtCompact(ORGS.length)} organizations are profiled today.
          </p>
          <PlatCTA to="/platform/features" label="Explore platform features" also={["/platform/trust", "See how we verify data"]} />
        </section>
        <CompanyBand />
      </div>
    </div>
  );
}
