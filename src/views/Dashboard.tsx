"use client"
/* == Dashboard.tsx - the overview page of the board =============
   Greeting, your own numbers in one band, what needs attention,
   the four issue stages, next steps, then the reference panels:
   the live archive index, the board pages and what you follow.
   Every number is either your own board state or a row from the
   GitHub crawl.                                                   == */
import { Link } from "@/lib/router";
import { btn } from "../components/ui";
import { fmtCompact } from "../lib/util";
import { ISSUE_SIGNALS } from "../data/issueSignals";
import { useDash } from "../lib/dash/useDash";
import type { Dash } from "../lib/dash/useDash";
import { Card, DashGate, DashHead, DashShell, Ic, StatRow } from "../lib/dash/shell";
import { ArtLedger, ArtShelf, FeatureMark, StageGlyph } from "../lib/dash/art";
import { AttentionList } from "../lib/dash/issues";
import { DP, FEATURES, ISSUE_STAGES, STAGE_LABEL, greet } from "../lib/dash/shared";

export default function Dashboard() {
  const d = useDash();
  return (
    <DashGate dash={d}>
      <DashShell dash={d} active="/dashboard">
        <Overview d={d} />
      </DashShell>
    </DashGate>
  );
}

/* one orchestrated entrance: sections fade-and-settle, 60ms apart,
   capped so nothing waits longer than half a second to appear.
   .reveal is disabled under prefers-reduced-motion in globals.css. */
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 60}ms` });

function Overview({ d }: { d: Dash }) {
  const user = d.user!;
  const first = user.name.split(" ")[0];
  const stages = ISSUE_STAGES.map((s) => [s, d.byStage(s).length] as const);
  const onLedger = d.issues.length;
  const workingN = d.byStage("working").length;
  const topRepos = d.savedRepos.slice(0, 4);
  const suggested = ISSUE_SIGNALS.filter((s) => !d.ledger[s.url]).slice(0, 3);

  /* your own numbers only - every one is live board state.
     an empty count reads as an em dash, never a bare zero */
  const num = (n: number) => (n ? String(n) : "—");
  const cells: [string, string, string][] = [
    [num(onLedger), onLedger === 1 ? "issue on your ledger" : "issues on your ledger",
      onLedger ? "held across four stages" : "paste a link to start"],
    [num(workingN), "working on it",
      workingN ? "pull requests to finish" : "move one up when you start"],
    [num(d.saved.length), d.saved.length === 1 ? "repository followed" : "repositories followed",
      d.savedRepos.length ? `${fmtCompact(d.stars)} stars between them` : "follow one from the catalog"],
    [`${d.stepsDone}/${d.steps.length}`, "next steps done",
      d.stepsDone === d.steps.length ? "the board is set" : "keep going below"],
  ];

  return (
    <>
      <div className="reveal" style={rise(0)}>
        <DashHead
          tag="Overview"
          title={`${greet()}, ${first}`}
          sub={d.issues.length
            ? `${d.issues.length} issue${d.issues.length === 1 ? "" : "s"} on your ledger · ${d.saved.length} repositor${d.saved.length === 1 ? "y" : "ies"} followed · ${d.savedOrgs.length} organization${d.savedOrgs.length === 1 ? "" : "s"}`
            : `Following ${d.saved.length} repositor${d.saved.length === 1 ? "y" : "ies"} and ${d.savedOrgs.length} organization${d.savedOrgs.length === 1 ? "" : "s"} - nothing tracked yet`}
          action={
            <>
              <Link to="/dashboard/issues" className={btn("primary", "sm")}>Track an issue</Link>
              <Link to="/skills" className={btn("outline", "sm")}>Browse catalog</Link>
            </>
          }
        />
      </div>

      {/* the opening band: your numbers, on the graphite island */}
      <section aria-label="Your board" className="on-dark reveal bg-coffee text-foam border border-bean rounded-[18px] px-5 py-4.5 shadow-lift min-[700px]:px-6 min-[700px]:py-5" style={rise(1)}>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-[9.5px] font-bold tracking-[.16em] uppercase text-ember shrink-0">Your board</span>
          <span className="h-px grow bg-bean" aria-hidden />
          <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-steam max-[700px]:hidden">held in this browser</span>
        </div>
        <div className="grid grid-cols-2 min-[700px]:grid-cols-4 gap-y-4">
          {cells.map(([v, l, note], i) => (
            <div key={l} className={"flex flex-col" + (i % 2 === 1 ? " border-l border-bean pl-4 min-[700px]:pl-6" : "") + (i > 0 ? " min-[700px]:border-l min-[700px]:border-bean min-[700px]:pl-6" : "")}>
              <b className="font-display text-[26px] font-extrabold tracking-[-.025em] leading-none text-foam min-[700px]:text-[30px] tabular-nums">{v}</b>
              <span className="text-[12px] font-medium text-foam/90 mt-1.5">{l}</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-steam mt-1 max-[700px]:hidden">{note}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="reveal" style={rise(2)}>
        <AttentionList d={d} />
      </div>

      {/* the pipeline: the four stages, or one invitation when the ledger
          is empty - a row of four zeros is not a designed state */}
      {onLedger === 0 ? (
        <Card className="reveal flex items-center gap-5 flex-wrap" style={rise(3)}>
          <div className="text-dim shrink-0 w-[130px]"><ArtLedger className="max-w-[130px]" /></div>
          <div className="min-w-[220px] flex-1">
            <span className="eyebrow">Your pipeline</span>
            <h2 className="panel-h-lg mt-1.5">Nothing on the ledger yet</h2>
            <p className="text-cocoa text-[13.5px] leading-[1.55] mt-1.5 max-w-[520px]">
              Every issue you track lands in one of four stages - saved, interested,
              working on it, completed. Paste any GitHub issue link and the first
              card appears here.
            </p>
            <div className="flex gap-2.5 flex-wrap mt-4">
              <Link to="/dashboard/issues" className={btn("primary", "sm")}>Track your first issue</Link>
              <Link to="/issues" className={btn("outline", "sm")}>Browse open issues</Link>
            </div>
          </div>
        </Card>
      ) : (
        <section aria-label="Issue stages" className="reveal grid grid-cols-2 min-[760px]:grid-cols-4 gap-3.5" style={rise(3)}>
          {stages.map(([s, n]) => (
            <Link key={s} to="/dashboard/issues"
              className="group relative bg-card border border-line rounded-[18px] p-4 min-[760px]:p-5 shadow-soft hover:border-accent/45 hover:shadow-lift hover:-translate-y-px transition-[border-color,box-shadow,transform] duration-200 ease-silk">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-dim">{STAGE_LABEL[s]}</span>
              <StageGlyph stage={s} className="absolute right-4 top-4 text-dim transition-colors group-hover:text-accent" />
              <b className={"block font-display text-[28px] min-[760px]:text-[30px] font-extrabold tracking-[-.025em] mt-2 tabular-nums " + (n ? "" : "text-dim")}>{n}</b>
              <span className="text-cocoa text-[12px]">
                {s === "working" ? "open pull requests to write" : s === "done" ? "closed out" : s === "interested" ? "scoping it out" : "on the shelf"}
              </span>
            </Link>
          ))}
        </section>
      )}

      <Card className="reveal" style={rise(4)}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="panel-h-lg">Next steps</h2>
          <span className="font-mono text-[11px] text-dim ml-auto tabular-nums">{d.stepsDone} of {d.steps.length} done</span>
        </div>
        <div className="h-1.5 rounded-full bg-clay overflow-hidden mt-3 mb-4">
          <i className="block h-full rounded-full grow-x transition-all duration-500"
            style={{ width: `${d.pct}%`, background: "linear-gradient(90deg, var(--color-accent), var(--color-ember))" }} />
        </div>
        <div className="grid gap-1">
          {d.steps.map(([on, l, to]) => (
            <Link key={l} to={to} className="group flex items-center gap-3.5 px-2 py-2.5 rounded-xl hover:bg-cream transition-colors">
              <span className={"w-[22px] h-[22px] grid place-items-center rounded-[7px] border shrink-0 transition-colors " + (on ? "bg-leaf border-leaf text-accentfg" : "border-line bg-paper text-transparent")}>
                <Ic d={DP.check} size={11} />
              </span>
              <span className={"text-[14px] font-semibold " + (on ? "text-dim line-through decoration-line" : "text-ink")}>{l}</span>
              {!on && (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[.1em] text-accent opacity-60 min-[760px]:opacity-0 min-[760px]:group-hover:opacity-100 transition-opacity">
                  Do it
                </span>
              )}
            </Link>
          ))}
        </div>
      </Card>

      {/* reference: what the crawl actually holds, on a quiet hairline row */}
      <Card className="reveal" style={rise(5)}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="panel-h-lg">The index now</h2>
          <span className="ml-auto font-mono text-[10.5px] text-dim">crawled {d.index.crawledAt}</span>
        </div>
        <p className="text-cocoa text-[12.5px] leading-[1.55] mt-1.5 max-w-[560px]">
          What the archive holds right now - the snapshot every panel on this board reads from.
        </p>
        <StatRow items={[
          ["open issues", fmtCompact(d.index.issues)],
          ["repos crawled", fmtCompact(d.index.issueRepos)],
          ["repos indexed", fmtCompact(d.index.catalog)],
          ["beginner-labelled", fmtCompact(d.index.beginner)],
          ["organizations", String(d.index.orgs)],
        ]} />
      </Card>

      <Card className="reveal" style={rise(6)}>
        <div className="flex items-baseline gap-3 flex-wrap mb-4">
          <h2 className="panel-h-lg">The board, page by page</h2>
          <span className="font-mono text-[11px] text-dim ml-auto">{FEATURES.length} pages</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <Link key={f.id} to={`/dashboard/${f.id}`}
              className="group flex flex-col gap-2 bg-cream border border-line rounded-[16px] p-4 hover:border-accent/50 hover:shadow-soft hover:-translate-y-px transition-[border-color,box-shadow,transform] duration-200 ease-silk">
              <FeatureMark id={f.id} size={40} className="text-cocoa transition-colors group-hover:text-ink" />
              <b className="card-title text-[13.5px] truncate">{f.title}</b>
              <span className="text-cocoa text-[12.5px] leading-[1.5] line-clamp-2">{f.desc}</span>
              <span className="mt-auto pt-1 font-mono text-[10px] uppercase tracking-[.1em] text-dim group-hover:text-accent transition-colors flex items-center gap-1.5">
                Open <Ic d={DP.arrow} size={12} />
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="reveal" style={rise(7)}>
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <h2 className="panel-h-lg">Following</h2>
          {topRepos.length > 0 && (
            <Link to="/dashboard/repos" className="ml-auto font-mono text-[10.5px] uppercase tracking-[.1em] text-dim hover:text-accent transition-colors">
              All {d.savedRepos.length}
            </Link>
          )}
        </div>
        {topRepos.length > 0 ? (
          <div className="grid gap-2.5">
            {topRepos.map((r) => (
              <div key={r.repo} className="flex items-start gap-3.5 px-4 py-3 rounded-[14px] bg-cream border border-liness hover:border-accent/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <Link to={`/repo/${encodeURIComponent(r.repo)}`} className="block text-[13.5px] font-semibold truncate hover:text-accent transition-colors">
                    {r.repo}
                  </Link>
                  <p className="card-desc mt-1 line-clamp-1">{r.desc}</p>
                  <StatRow items={[["Stars", fmtCompact(r.stars)], ["Open issues", fmtCompact(r.issues)], ["Last update", r.updated]]} />
                </div>
                <button onClick={() => d.toggleSaved(r.repo)} aria-label={"Unfollow " + r.repo}
                  className="w-[28px] h-[28px] grid place-items-center rounded-[8px] text-accent hover:text-brick transition-colors cursor-pointer shrink-0">
                  <Ic d={DP.x} size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : d.saved.length > 0 ? (
          <p className="text-cocoa text-[13.5px] leading-[1.55]">
            Your {d.saved.length} saved {d.saved.length === 1 ? "repository is" : "repositories are"} not in the current crawl snapshot - the{" "}
            <Link to="/dashboard/repos" className="text-accent font-semibold hover:underline">repositories page</Link>{" "}
            still holds them.
          </p>
        ) : (
          <div className="flex items-center gap-5 flex-wrap">
            <div className="text-dim shrink-0 w-[130px]"><ArtShelf className="max-w-[130px]" /></div>
            <div className="min-w-[220px] flex-1">
              <p className="text-[14px] font-semibold">The shelf is empty</p>
              <p className="text-cocoa text-[13px] leading-[1.55] mt-1 max-w-[460px]">
                Following a repository puts its stars, open issues and last update on this board.
              </p>
              <div className="flex gap-2.5 flex-wrap mt-3.5">
                <Link to="/skills" className={btn("primary", "sm")}>Browse the catalog</Link>
                <Link to="/organizations" className={btn("outline", "sm")}>Find an organization</Link>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="reveal" style={rise(8)}>
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <h2 className="panel-h-lg flex items-center gap-2.5">
            <Ic d={DP.spark} size={15} /> Open issues you have not taken
          </h2>
          {suggested.length > 0 && (
            <Link to="/dashboard/issues" className="ml-auto font-mono text-[10.5px] uppercase tracking-[.1em] text-dim hover:text-accent transition-colors">
              See more
            </Link>
          )}
        </div>
        {suggested.length > 0 ? (
          <div className="grid gap-2.5">
            {suggested.map((s) => (
              <div key={s.url} className="flex items-center gap-3.5 px-4 py-3 rounded-[14px] bg-cream border border-liness hover:border-accent/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[11px] text-dim">{s.repo} · #{s.number}</span>
                  <a href={s.url} target="_blank" rel="noreferrer noopener"
                    className="block text-[13.5px] font-semibold mt-1 hover:text-accent transition-colors">{s.title}</a>
                </div>
                <button onClick={() => d.trackIssue(s.url)}
                  className="shrink-0 font-mono text-[10px] font-bold uppercase px-3 py-2 rounded-[9px] border border-line bg-card text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer">
                  Track
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-cocoa text-[13.5px] leading-[1.55]">
            You already track every issue in the current sample - the{" "}
            <Link to="/issues" className="text-accent font-semibold hover:underline">issue finder</Link>{" "}
            holds the whole snapshot of {fmtCompact(d.index.issues)} open issues.
          </p>
        )}
      </Card>
    </>
  );
}
