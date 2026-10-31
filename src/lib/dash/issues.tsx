"use client"
/* == issues.tsx - My Issues: the four-stage ledger ================
   Rows are the visitor's own. Titles, labels and last-touch dates come
   from the GitHub crawl; the stage is theirs. Nothing here claims an
   assignment, because only a maintainer on GitHub can.            == */
import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { btn, Chip, Tag } from "../../components/ui";
import { avatarOf, fmt } from "../util";
import { ISSUE_SIGNALS } from "../../data/issueSignals";
import { Card, DashHead, Ic, StatRow } from "./shell";
import { ArtLedger } from "./art";
import {
  DP, ISSUE_STAGES, STAGE_CLS, STAGE_LABEL, STAGE_NEXT,
  daysAgo, isStale, type IssueStage, type TrackedIssue,
} from "./shared";
import type { Dash } from "./useDash";

const ROW = "flex items-start gap-3.5 px-4 py-3.5 rounded-[14px] border transition-colors";

export function AttentionList({ d, limit }: { d: Dash; limit?: number }) {
  const rows = limit ? d.attention.slice(0, limit) : d.attention;
  if (!rows.length) {
    return (
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="w-[34px] h-[34px] grid place-items-center rounded-[10px] border border-leaf/40 bg-leaf/10 text-leaf shrink-0">
            <Ic d={DP.check} size={15} />
          </span>
          <div className="min-w-[220px] flex-1">
            <h2 className="panel-h-lg">Nothing needs you</h2>
            <p className="text-cocoa text-[13.5px] mt-1">
              Every tracked issue is accounted for, and you follow at least one
              repository and one organization.
            </p>
          </div>
          <Link to="/dashboard/issues" className={btn("outline", "sm") + " shrink-0"}>Open My Issues</Link>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-baseline gap-3 px-5 pt-5 pb-3">
        <h2 className="panel-h-lg">Needs your attention</h2>
        <span className="ml-auto font-mono text-[10.5px] text-dim tabular-nums">
          {d.attention.length} open
        </span>
      </div>
      <div>
        {rows.map((a, i) => {
          const tone = a.tone === "warn"
            ? "text-honey bg-honey/10 border-honey/35"
            : "text-denim bg-denim/8 border-denim/30";
          return (
            <div key={a.title} className={"flex items-start gap-x-4 gap-y-3 px-5 py-4 max-[680px]:flex-wrap" + (i ? " border-t border-liness" : "")}>
              <span className={"mt-0.5 w-[26px] h-[26px] grid place-items-center rounded-[8px] shrink-0 border " + tone}>
                <Ic d={a.tone === "warn" ? DP.clock : DP.issue} size={13} />
              </span>
              <div className="min-w-[200px] flex-1">
                <b className="block text-[13.5px] font-semibold leading-snug">{a.title}</b>
                <p className="text-cocoa text-[12.5px] leading-[1.55] mt-1">{a.body}</p>
              </div>
              <Link to={a.to} className={btn("outline", "sm") + " shrink-0 max-[680px]:basis-full max-[680px]:ml-[42px]"}>
                {a.cta}
              </Link>
            </div>
          );
        })}
      </div>
      {limit && d.attention.length > limit && (
        <Link to="/dashboard"
          className="block px-5 py-3 border-t border-liness text-[12.5px] font-semibold text-accent hover:bg-peach transition-colors">
          See all {d.attention.length}
        </Link>
      )}
    </Card>
  );
}

function IssueRow({ d, issue }: { d: Dash; issue: TrackedIssue }) {
  const stage = d.stageOf(issue.url);
  const next = STAGE_NEXT[stage];
  const stale = isStale(issue.updated);
  const stats: [string, ReactNode][] = [
    ["issue", "#" + issue.number],
    ...(issue.lang ? [["lang", issue.lang] as [string, ReactNode]] : []),
    ...(issue.stars ? [["stars", fmt(issue.stars)] as [string, ReactNode]] : []),
    ...(issue.updated ? [["touched", daysAgo(issue.updated) + "d ago"] as [string, ReactNode]] : []),
    ["on board", daysAgo(issue.added) === 0 ? "today" : daysAgo(issue.added) + "d ago"],
  ];
  return (
    <div className={ROW + " bg-card border-line hover:border-accent/45"}>
      <span className="w-[30px] h-[30px] grid place-items-center rounded-[9px] bg-white border border-line overflow-hidden shrink-0 mt-0.5">
        <img src={avatarOf(issue.repo.split("/")[0], 60)} alt="" loading="lazy"
          className="w-[20px] h-[20px] object-contain" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/repo/${encodeURIComponent(issue.repo)}`}
            className="font-mono text-[11px] text-dim hover:text-accent truncate">{issue.repo}</Link>
          <span className={"font-mono text-[9.5px] font-bold uppercase tracking-[.1em] rounded-full px-2 py-[3px] border " + STAGE_CLS[stage]}>
            {STAGE_LABEL[stage]}
          </span>
          {issue.beginner && <Chip tone="green">good first issue</Chip>}
        </div>
        <a href={issue.url} target="_blank" rel="noreferrer noopener"
          className="block card-title text-[14px] mt-1.5 hover:text-accent transition-colors">
          {issue.title}
          <span className="inline-flex align-[-1px] ml-1.5 opacity-55">
            <Ic d={DP.external} size={12} />
          </span>
        </a>
        {!!issue.labels?.length && (
          <div className="flex gap-1.5 flex-wrap mt-2.5 max-h-[26px] overflow-hidden">
            {issue.labels.slice(0, 5).map((l) => <Tag key={l}>{l}</Tag>)}
          </div>
        )}
        <StatRow items={stats} />
        {stale && (
          <p className="flex items-start gap-2 mt-2.5 text-[12px] leading-[1.5] text-honey">
            <Ic d={DP.clock} size={13} />
            No activity in {daysAgo(issue.updated!)} days. Confirm it is still open on GitHub before you start work.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button onClick={() => d.setStage(issue.url, next)}
          className="font-mono text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-[9px] border border-line text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer whitespace-nowrap">
          {next === "done" ? "Mark done" : "To " + STAGE_LABEL[next]}
        </button>
        <button onClick={() => d.removeIssue(issue.url)}
          aria-label={"Stop tracking issue " + issue.number}
          className="font-mono text-[10px] uppercase px-2.5 py-1.5 rounded-[9px] border border-transparent text-dim hover:text-brick hover:border-brick/40 transition-colors cursor-pointer">
          Remove
        </button>
      </div>
    </div>
  );
}

export function IssuesSection({ d }: { d: Dash }) {
  const [paste, setPaste] = useState("");
  const [stage, setStage] = useState<IssueStage | "all">("all");
  const counts = Object.fromEntries(
    ISSUE_STAGES.map((s) => [s, d.byStage(s).length]),
  ) as Record<IssueStage, number>;
  const shown = stage === "all" ? d.issues : d.byStage(stage);
  const offered = ISSUE_SIGNALS.filter((s) => !d.ledger[s.url]).slice(0, 6);

  const exportJson = () => {
    const payload = d.issues.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      url: i.url,
      stage: d.stageOf(i.url),
      stageLabel: STAGE_LABEL[d.stageOf(i.url)],
      lang: i.lang ?? null,
      stars: i.stars ?? 0,
      labels: i.labels ?? [],
      beginner: Boolean(i.beginner),
      added: i.added,
      updated: i.updated ?? null,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `cyrus-tracked-issues-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
    d.toast(`Exported ${payload.length} tracked issues`);
  };

  return (
    <>
      <DashHead title="My Issues"
        sub="Every issue you took, held at the stage you left it. Titles and labels come from the crawl; the stages are yours." />

      <Card>
        <form className="flex gap-2.5 flex-wrap"
          onSubmit={(e) => { e.preventDefault(); if (d.trackIssue(paste)) setPaste(""); }}>
          <span className="flex-1 min-w-[240px] flex items-center gap-2.5 h-[44px] px-3.5 rounded-[12px] bg-cream border border-line focus-within:border-accent transition-colors">
            <Ic d={DP.link} size={15} />
            <input value={paste} onChange={(e) => setPaste(e.target.value)}
              spellCheck={false} autoComplete="off"
              aria-label="GitHub issue link"
              placeholder="Paste a GitHub issue link - github.com/owner/repo/issues/123"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-ink placeholder:text-dim" />
          </span>
          <button type="submit" className={btn("primary", "md")}>Track issue</button>
        </form>
        <p className="text-dim text-[12px] leading-[1.55] mt-3">
          The board stores the link and the stage you pick. It never says you were
          assigned - only a maintainer on GitHub can do that.
        </p>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", ...ISSUE_STAGES] as (IssueStage | "all")[]).map((s) => (
          <button key={s} onClick={() => setStage(s)} aria-pressed={stage === s}
            className={"px-3.5 py-2 rounded-full border text-[12.5px] font-semibold transition-colors cursor-pointer " + (stage === s ? "bg-ink text-paper border-ink" : "bg-card border-line text-cocoa hover:border-accent")}>
            {s === "all" ? "All" : STAGE_LABEL[s]}
            <span className="font-mono text-[11px] opacity-70 ml-1.5">
              {s === "all" ? d.issues.length : counts[s]}
            </span>
          </button>
        ))}
        {d.issues.length > 0 && (
          <button onClick={exportJson}
            className="ml-auto px-3.5 py-2 rounded-full border border-line bg-card text-[12px] font-mono uppercase tracking-[.06em] text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer">
            Export JSON
          </button>
        )}
      </div>

      {shown.length ? (
        <div className="grid gap-2.5">{shown.map((i) => <IssueRow key={i.url} d={d} issue={i} />)}</div>
      ) : (
        <Card className="text-center py-10">
          <div className="flex justify-center mb-4 text-dim">
            <ArtLedger className="max-w-[210px]" />
          </div>
          <p className="text-[14px] font-semibold">
            {stage === "all" ? "No issues tracked yet" : "Nothing in " + STAGE_LABEL[stage]}
          </p>
          <p className="text-cocoa text-[13px] mt-1.5 max-w-[430px] mx-auto">
            {stage === "all"
              ? "Paste a link above, or track one of the open issues the crawl found below."
              : "Move an issue into this stage with the button on its row."}
          </p>
        </Card>
      )}

      {offered.length > 0 && (
        <Card>
          <div className="flex items-baseline gap-3 flex-wrap mb-4">
            <h2 className="panel-h-lg flex items-center gap-2.5">
              <Ic d={DP.spark} size={15} /> Open right now
            </h2>
            <span className="font-mono text-[10.5px] text-dim ml-auto">crawled {d.index.crawledAt}</span>
          </div>
          <div className="grid gap-2.5">
            {offered.map((s) => (
              <div key={s.url} className={ROW + " bg-cream border-liness hover:border-accent/40"}>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[11px] text-dim">{s.repo} · #{s.number}</span>
                  <a href={s.url} target="_blank" rel="noreferrer noopener"
                    className="block text-[13.5px] font-semibold mt-1 hover:text-accent transition-colors">
                    {s.title}
                  </a>
                  <StatRow items={[
                    ["lang", s.lang ?? "-"],
                    ["stars", fmt(s.stars)],
                    ["updated", daysAgo(s.updated) + "d ago"],
                    ...(s.beginner ? [["signal", "good first issue"] as [string, ReactNode]] : []),
                  ]} />
                </div>
                <button onClick={() => d.trackIssue(s.url)}
                  className="shrink-0 font-mono text-[10px] font-bold uppercase px-3 py-2 rounded-[9px] border border-line bg-card text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer">
                  Track
                </button>
              </div>
            ))}
          </div>
          <p className="text-dim text-[12px] mt-4">
            A sample of the {fmt(d.index.issues)} open issues read from{" "}
            {fmt(d.index.issueRepos)} repositories on {d.index.crawledAt}. The whole
            snapshot is searchable on the{" "}
            <Link to="/issues" className="text-accent font-semibold hover:underline">issue finder</Link>.
          </p>
        </Card>
      )}
    </>
  );
}
