"use client"
/* == settings.tsx - Settings ====================================
   Session, appearance, and full control over what the board remembers.
   No notification toggles: nothing sends them, so nothing pretends to. == */
import { Link } from "@/lib/router";
import { Avatar, btn } from "../../components/ui";
import { useState } from "react";
import { fmtCompact } from "../util";
import { listByKind, OWNERSHIP_COPY, removalNotice, type TrackedEntry } from "./dataControls";
import { Card, DashHead, Ic, Toggle } from "./shell";
import { DP } from "./shared";
import type { Dash } from "./useDash";

export function SettingsSection({ d }: { d: Dash }) {
  const user = d.user!;
  const board = {
    issues: d.issues.map((i) => ({ url: i.url, repo: i.repo, number: i.number, stage: d.stageOf(i.url), added: i.added })),
    repositories: d.saved,
    organizations: d.savedOrgs,
  };
  const nothingFollowed = !board.repositories.length && !board.organizations.length;

  const entries: TrackedEntry[] = [
    ...d.issues.map((i): TrackedEntry => ({ kind: "issue", key: i.url, label: `${i.repo} #${i.number}` })),
    ...d.savedRepos.map((r): TrackedEntry => ({ kind: "repository", key: r.repo, label: r.repo })),
    ...d.orgList.map((o): TrackedEntry => ({ kind: "organization", key: o.login, label: o.login })),
  ];
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const idOf = (e: TrackedEntry) => `${e.kind}:${e.key}`;
  const selected = entries.filter((e) => picked.includes(idOf(e)));
  const togglePick = (e: TrackedEntry) => {
    setConfirming(false);
    setPicked((p) => (p.includes(idOf(e)) ? p.filter((x) => x !== idOf(e)) : [...p, idOf(e)]));
  };
  const removeSelected = () => {
    for (const e of selected) {
      if (e.kind === "issue") d.removeIssue(e.key);
      else if (e.kind === "repository") d.toggleSaved(e.key);
      else d.toggleSavedOrg(e.key);
    }
    d.toast(`Removed ${selected.length} from your board. GitHub is unchanged.`);
    setPicked([]);
    setConfirming(false);
  };

  const exportBoard = () => {
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), ...board }, null, 2);
    const href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = "cyrus-board.json";
    a.click();
    URL.revokeObjectURL(href);
    d.toast("Board exported as cyrus-board.json");
  };

  const sources: [string, string, string][] = [
    ["Open issues", `${fmtCompact(d.index.issues)} crawled from ${fmtCompact(d.index.issueRepos)} repositories on ${d.index.crawledAt}`, "GitHub search API"],
    ["Beginner signal", `${fmtCompact(d.index.beginner)} of them carry a good-first-issue label`, "label text"],
    ["Catalog", `${fmtCompact(d.index.catalog)} repositories · ${d.index.orgs} tracked organizations`, "GitHub repository API"],
    ["Archive", "accepted program projects from the last five years", "program result pages"],
  ];

  return (
    <>
      <DashHead title="Settings" sub="Appearance, what the board remembers, and a way to delete every trace of it." />

      <Card>
        <h2 className="panel-h-lg mb-4">Session</h2>
        <div className="flex items-center gap-3.5 flex-wrap">
          <Avatar name={user.name} size={44} src={user.picture} />
          <div className="min-w-0">
            <b className="block text-[15px] font-semibold truncate">{user.name}</b>
            <span className="text-cocoa text-[12.5px] block truncate">
              {user.email || (user.provider === "guest" ? "Guest session - this board stays in your browser" : `Signed in with ${user.provider}`)}
            </span>
          </div>
          {d.serverUser && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[.1em] text-leaf bg-leaf/10 border border-leaf/35 rounded-full px-2.5 py-1">
              <Ic d={DP.check} size={11} /> synced across devices
            </span>
          )}
          <button onClick={d.signOut} className={btn("outline", "sm") + " ml-auto shrink-0"}>Sign out</button>
        </div>
      </Card>

      <Card>
        <h2 className="panel-h-lg mb-1">Appearance</h2>
        <p className="text-cocoa text-[13px] mb-4">Graphite and signal green, in dark or a cool neutral light.</p>
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-liness">
          <span className="flex items-center gap-3 text-[13.5px] font-semibold">
            <Ic d={d.theme === "dark" ? DP.moon : DP.sun} size={16} />
            {d.theme === "dark" ? "Dark (graphite)" : "Light (cool neutral)"}
          </span>
          <Toggle on={d.theme === "dark"} flip={d.toggleTheme} />
        </div>
      </Card>

      <Card>
        <h2 className="panel-h-lg mb-1">What the board holds</h2>
        <p className="text-cocoa text-[13px] mb-4">
          {board.issues.length} tracked issue{board.issues.length === 1 ? "" : "s"},{" "}
          {board.repositories.length} repositor{board.repositories.length === 1 ? "y" : "ies"},{" "}
          {board.organizations.length} organization{board.organizations.length === 1 ? "" : "s"}.
          {d.serverUser ? " Mirrored to the private rows on your account." : " Stored in this browser only."}
        </p>
        <div className="flex gap-2.5 flex-wrap">
          <button onClick={exportBoard} className={btn("outline", "sm")}>
            <Ic d={DP.download} size={13} /> Export as JSON
          </button>
          <button onClick={d.clearIssues} disabled={!board.issues.length}
            className={btn("outline", "sm") + " disabled:opacity-45"}>Clear issue ledger</button>
          <button onClick={() => { d.unfollowAll(); d.toast("Board cleared."); }} disabled={nothingFollowed}
            className={btn("outline", "sm") + " disabled:opacity-45"}>Unfollow everything</button>
        </div>
      </Card>

      <Card>
        <h2 className="panel-h-lg mb-1">Your tracked selections</h2>
        <p className="text-cocoa text-[13px] mb-1">{OWNERSHIP_COPY.account}</p>
        <p className="text-dim text-[12.5px] mb-4">{OWNERSHIP_COPY.crawl}</p>
        {entries.length === 0 ? (
          <p className="text-cocoa text-[13px]">Nothing is tracked on this account.</p>
        ) : (
          <ul className="border-t border-liness" aria-label="Tracked issues, repositories and organizations">
            {entries.map((e) => (
              <li key={idOf(e)} className="border-b border-liness">
                <label className="flex items-center gap-3 py-2.5 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={picked.includes(idOf(e))} onChange={() => togglePick(e)} />
                  <span className="font-mono text-[10px] uppercase tracking-[.1em] text-dim w-[92px] shrink-0">{e.kind}</span>
                  <span className="truncate">{e.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {selected.length > 0 && !confirming && (
          <button onClick={() => setConfirming(true)} className={btn("outline", "sm") + " mt-4"}>
            Remove {selected.length} selected
          </button>
        )}
        {selected.length > 0 && confirming && (
          <div role="alertdialog" aria-live="polite" className="mt-4 border border-liness rounded-lg p-4">
            <p className="text-[13px] mb-1">{removalNotice(selected)}</p>
            {listByKind(selected).map((line) => (
              <p key={line} className="text-cocoa text-[12.5px]">{line}</p>
            ))}
            <div className="flex gap-2.5 mt-3">
              <button onClick={removeSelected} className={btn("outline", "sm")}>Confirm removal</button>
              <button onClick={() => setConfirming(false)} className={btn("outline", "sm")}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="panel-h-lg mb-4">Where the numbers come from</h2>
        <div>
          {sources.map((row, i) => (
            <div key={row[0]}
              className={"grid grid-cols-[150px_1fr_160px] gap-4 py-3 text-[13px] max-[760px]:grid-cols-1 max-[760px]:gap-1" + (i ? " border-t border-liness" : "")}>
              <b className="font-semibold">{row[0]}</b>
              <span className="text-cocoa">{row[1]}</span>
              <span className="font-mono text-[10.5px] text-dim max-[760px]:hidden">{row[2]}</span>
            </div>
          ))}
        </div>
        <p className="text-dim text-[12px] leading-[1.6] mt-4">
          A repository can close or merge an issue between crawls, so every row links to
          the live thread and says when it was last touched. If a number is not in the
          crawl, the board does not show it.
        </p>
        <Link to="/platform/trust" className="font-mono text-[10.5px] uppercase tracking-[.1em] text-accent hover:underline mt-4 inline-block">
          Read the trust centre
        </Link>
      </Card>
    </>
  );
}
