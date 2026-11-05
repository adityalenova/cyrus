"use client"
/* == repos.tsx - My Repositories ================================
   Followed repositories and organizations, each with the dotted stat
   row that decides where a contributor puts their evening: stars, open
   issues, forks, last update. All of it is catalog data.           == */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { btn, Tag } from "../../components/ui";
import { CAT_META, avatarOf, fmtCompact } from "../util";
import { ORGS } from "../../data/orgs";
import { Card, DashHead, Ic, StatRow } from "./shell";
import { ArtShelf } from "./art";
import { DP, norm } from "./shared";
import type { Dash } from "./useDash";

export function ReposSection({ d }: { d: Dash }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = norm(q);
    return d.savedRepos.filter((r) => !s || norm(`${r.repo} ${r.desc} ${r.lang} ${r.tags.join(" ")}`).includes(s));
  }, [d.savedRepos, q]);

  const tiles: [string, string][] = [
    [fmtCompact(d.savedRepos.length), "followed"],
    [fmtCompact(d.stars), "combined stars"],
    [fmtCompact(d.openIssues), "open issues in them"],
    [String(d.langs.length), "languages"],
  ];

  return (
    <>
      <DashHead title="My Repositories"
        sub="The repositories you follow. Stars, open issues and last update decide where the next evening goes."
        action={<Link to="/skills" className={btn("outline", "sm")}>Follow more</Link>} />

      <Card>
        <div className="grid grid-cols-4 gap-4 max-[760px]:grid-cols-2">
          {tiles.map(([v, l]) => (
            <div key={l}>
              <b className="block font-display text-[24px] font-extrabold tracking-[-.02em]">{v}</b>
              <span className="text-cocoa text-[12px]">{l}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-2.5 h-[44px] px-3.5 rounded-[12px] bg-card border border-line focus-within:border-accent transition-colors">
        <Ic d={DP.search} size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          aria-label="Filter followed repositories"
          placeholder="Filter by name, language or description"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-ink placeholder:text-dim" />
        <span className="font-mono text-[11px] text-dim shrink-0">{rows.length} of {d.savedRepos.length}</span>
      </div>

      {rows.length ? (
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {rows.map((r) => (
            <article key={r.repo}
              className="bg-card border border-line rounded-[18px] p-5 shadow-soft hover:border-accent/45 transition-colors">
              <div className="flex items-start gap-3">
                <span className="w-[34px] h-[34px] grid place-items-center rounded-[10px] bg-white border border-line overflow-hidden shrink-0">
                  <img src={avatarOf(r.repo.split("/")[0], 68)} alt="" loading="lazy"
                    className="w-[22px] h-[22px] object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/repo/${encodeURIComponent(r.repo)}`}
                    className="card-title block truncate hover:text-accent transition-colors">{r.repo}</Link>
                  <span className="font-mono text-[10.5px] text-dim">{CAT_META[r.cat]?.label ?? r.cat} · {r.license}</span>
                </div>
                <button onClick={() => d.toggleSaved(r.repo)} aria-label={"Unfollow " + r.repo}
                  className="w-[30px] h-[30px] grid place-items-center rounded-[9px] text-accent hover:text-brick transition-colors cursor-pointer shrink-0">
                  <Ic d={DP.bookmark} size={15} filled />
                </button>
              </div>
              <p className="card-desc mt-3 line-clamp-2">{r.desc}</p>
              <div className="flex gap-1.5 flex-wrap mt-3">
                {r.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
              <StatRow items={[
                ["Stars", fmtCompact(r.stars)],
                ["Open issues", fmtCompact(r.issues)],
                ["Forks", fmtCompact(r.forks)],
                ["Last update", r.updated],
              ]} />
            </article>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <div className="flex justify-center mb-5 text-dim">
            <ArtShelf className="max-w-[210px]" />
          </div>
          <p className="text-[14px] font-semibold">
            {d.savedRepos.length ? "No followed repository matches that filter" : "You are not following a repository yet"}
          </p>
          <p className="text-cocoa text-[13px] mt-1.5 max-w-[430px] mx-auto">
            Tap the bookmark on any repository in the catalog and it lands here with its
            stars, open issues and last update.
          </p>
          <Link to="/skills" className={btn("primary", "md") + " mt-5"}>
            Browse {fmtCompact(d.index.catalog)} repositories
          </Link>
        </Card>
      )}

      {d.orgList.length > 0 && (
        <Card>
          <div className="flex items-baseline gap-3 flex-wrap mb-4">
            <h2 className="panel-h-lg">Organizations you follow</h2>
            <Link to="/organizations"
              className="ml-auto font-mono text-[10.5px] uppercase tracking-[.1em] text-dim hover:text-accent">
              All {ORGS.length}
            </Link>
          </div>
          <div className="grid gap-2.5">
            {d.orgList.map((o) => (
              <div key={o.login} className="flex items-center gap-3.5 px-4 py-3 rounded-[14px] bg-cream border border-liness">
                <span className="w-[30px] h-[30px] grid place-items-center rounded-[9px] bg-white border border-line overflow-hidden shrink-0">
                  <img src={avatarOf(o.login, 60)} alt="" loading="lazy" className="w-[20px] h-[20px] object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/organizations/${encodeURIComponent(o.login)}`}
                    className="block text-[13.5px] font-semibold truncate hover:text-accent transition-colors">{o.name}</Link>
                  <span className="text-cocoa text-[12px] truncate block">{o.tagline}</span>
                </div>
                <span className="flex items-baseline gap-2.5 font-mono text-[10.5px] text-dim shrink-0 max-[680px]:hidden">
                  <span><b className="text-ink font-semibold">{fmtCompact(o.stars)}</b> stars</span>
                  <span><b className="text-ink font-semibold">{String(o.repos)}</b> repos</span>
                </span>
                <button onClick={() => d.toggleSavedOrg(o.login)} aria-label={"Unfollow " + o.login}
                  className="w-[28px] h-[28px] grid place-items-center rounded-[8px] text-accent hover:text-brick transition-colors cursor-pointer shrink-0">
                  <Ic d={DP.x} size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
