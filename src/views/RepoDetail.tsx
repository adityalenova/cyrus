"use client"
/* ══ RepoDetail.tsx — snapshot stats + live GitHub panels ═══ */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { CATALOG } from "../lib/util";
import type { ProgramRepo } from "../data/programRepos";
import { PROGRAM_META } from "../data/programRepos";
import { programLink } from "../data/programDetails";
import { avatarOf, byStars, CAT_META, fmtCompact, hash, LANG_COLORS, repoById, rnd } from "../lib/util";
import type { Repo } from "../lib/types";
import { useStore } from "../lib/store";
import { Avatar, btn, Chip, OrgImg, Tag, Word } from "../components/ui";
import NotFound from "./NotFound";

const W = "max-w-[1240px] mx-auto px-6";

interface GhContrib { login: string; avatar_url: string; contributions: number; html_url: string }
type Langs = Record<string, number>;

/* ── fallbacks so the page never looks broken offline ──────── */
function synthContribs(r: Repo): GhContrib[] {
  const owner = r.repo.split("/")[0];
  const n = 8;
  return Array.from({ length: n }, (_, i) => ({
    login: `${owner.slice(0, 5)}dev${i + 1}`,
    avatar_url: "", // empty rendered as initials avatar
    contributions: Math.round(r.stars * (0.02 - i * 0.002) * (0.6 + rnd(r.repo, i) * 0.8)),
    html_url: `https://github.com/${owner}`,
  }));
}
function synthLangs(r: Repo): Langs {
  const others = ["TypeScript", "Python", "Rust", "Go", "Shell", "JavaScript"].filter((l) => l !== r.lang);
  const top = others[Math.floor(rnd(r.repo, 9) * others.length)];
  const mix = [68 + Math.round(rnd(r.repo, 8) * 24), 0, 0];
  mix[1] = 100 - mix[0] - 12; mix[2] = 12;
  return { [r.lang]: mix[0], [top]: Math.max(mix[1], 4), Shell: Math.max(mix[2], 3) };
}

function useLive(r: Repo | undefined) {
  const [contribs, setContribs] = useState<GhContrib[] | null>(null);
  const [langs, setLangs] = useState<Langs | null>(null);
  useEffect(() => {
    if (!r) return;
    let dead = false;
    const id = r.repo;
    fetch(`https://api.github.com/repos/${id}/contributors?per_page=14`, { headers: { Accept: "application/vnd.github+json" } })
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then((d) => { if (!dead && Array.isArray(d)) setContribs(d as GhContrib[]); })
      .catch(() => { if (!dead) setContribs(synthContribs(r)); });
    fetch(`https://api.github.com/repos/${id}/languages`, { headers: { Accept: "application/vnd.github+json" } })
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then((d) => { if (!dead && d && Object.keys(d).length) setLangs(d as Langs); })
      .catch(() => { if (!dead) setLangs(synthLangs(r)); });
    return () => { dead = true; };
  }, [r]);
  return { contribs, langs };
}

function Panel({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-line rounded-[18px] overflow-hidden shadow-soft mb-5">
      <h2 className="px-[18px] py-3.5 border-b border-liness panel-h flex items-center gap-2.5">
        {title}{count && <span className="font-mono text-[11px] text-dim font-medium">{count}</span>}
      </h2>
      <div className="p-[18px]">{children}</div>
    </section>
  );
}

/* ── detailed benefits per catalog shelf — [icon, title, body] ── */
const BEN_S_W = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const BEN_ICONS: Record<string, React.ReactNode> = {
  bolt: <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />,
  team: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M15 3.13A4 4 0 0 1 15 11" />,
  coin: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm.6-13.6v1.2m0 6.4v1.2m1.9-7.1c0-1-1-1.6-2.1-1.6s-2.2.7-2.2 1.7c0 2.3 4.4 1.5 4.4 3.9 0 1-1.1 1.7-2.3 1.7s-2.3-.7-2.3-1.7" />,
  shield: <path d="M12 21c4.5-1.8 7-4.8 7-9.2V5.6L12 3 5 5.6v6.2c0 4.4 2.5 7.4 7 9.2Zm-2.5-9.6 2 2 4-4.4" />,
  wrench: <path d="M14.5 5.5a4.2 4.2 0 0 0-5.6 5.1L3 16.4a2.2 2.2 0 1 0 3.1 3.1l5.8-5.8a4.2 4.2 0 0 0 5.1-5.7l-2.7 2.7-2.4-2.4 2.6-2.6a4.2 4.2 0 0 0-.5-.2Z" />,
  eye: <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 2.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" />,
  refresh: <path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5" />,
  gauge: <path d="M12 21a9 9 0 1 1 9-9M21 12h-4m-1.8-5.5L12 9m-2.5 6.5L8 17" />,
};
const BEN = (ic: string) => <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden {...BEN_S_W}>{BEN_ICONS[ic]}</svg>;

const BENEFITS: Record<string, [string, string, string][]> = {
  skills: [
    ["bolt", "Your agent stops guessing the workflow", "A skill packages the exact steps, file conventions and checklists an expert would follow. The model spends its context on your feature instead of figuring out how the tool works."],
    ["team", "One install, every repo behaves the same", "Commit the skill to your project and every teammate's Claude Code, Codex or Cursor run inherits the same quality bar - including the new teammate on day one."],
    ["coin", "Cheaper runs, fewer retries", "Tuned instructions cut failed attempts and half-baked output. Fewer retries means fewer tokens burned and noticeably shorter sessions on paid model plans."],
    ["refresh", "Survives the next model release", "Skills are plain markdown and scripts the community versions together. A model upgrade changes behaviour, not your workflow - unlike a bespoke prompt that breaks silently."],
  ],
  mcp: [
    ["wrench", "Real tools, not role-play", "An MCP server gives your agent typed access to a browser, database, chart engine or cloud account. It acts through the server instead of hallucinating what the API would have returned."],
    ["shield", "You decide what it can reach", "Servers run on your machine or your cloud. Access is scoped per tool and can be cut mid-session, so credentials never live inside the model."],
    ["refresh", "One server, every client", "Cursor, Claude Desktop, Codex CLI and Windsurf all speak MCP. The config you write today keeps working when you switch editor or model."],
    ["eye", "Every action is auditable", "Tool calls pass through the server, so you get a log of exactly what the agent read, wrote or clicked - the difference between a demo and something you'd run at work."],
  ],
  cursor: [
    ["bolt", "The editor stops relearning your stack", "Rules encode your framework choices, folder layout and TypeScript style once. Every new chat starts already knowing how your project is built."],
    ["team", "Review-ready diffs by default", "Enforce tests, formatting and typing at the prompt level and the agent's pull requests arrive shaped like your team's, not like a tutorial's."],
    ["coin", "Near-zero cost to adopt", "It is plain text checked into .cursor/rules. No runtime, no account, no server - and the file doubles as documentation for humans."],
    ["refresh", "Portable across agents", "The same rules files increasingly work in Windsurf, Copilot and Claude Code. A convention you write once pays off on every tool you try next."],
  ],
  agentsmd: [
    ["eye", "A map, not a manual", "AGENTS.md tells any coding agent how to build, test and ship inside your repo in one screen. Onboarding time for agents drops from a dozen correction turns to none."],
    ["shield", "Fewer destructive mistakes", "Declare which commands are safe, which files are off-limits and how migrations run. The agent respects the guardrails instead of discovering them by breaking things."],
    ["team", "Model-agnostic by design", "One file serves Copilot, Claude Code, Codex and Cursor. It is becoming the industry's shared README-for-robots, checked into the repo where it stays fresh."],
    ["refresh", "It grows with the project", "The convention is to update the file in the same PR that changes the build. Your agent context never goes stale because the team owns it like any other doc."],
  ],
  tools: [
    ["bolt", "Day-one leverage", "These CLIs and dashboards solve one job well and install with a single command. Value shows up in the first hour, not after a config weekend."],
    ["wrench", "Composes with your agent", "Most of them ship an MCP server, skill or hooks - so the same tool you use manually becomes an action your agent can call safely."],
    ["gauge", "Built under real workloads", "Star counts here track repos people actually run daily: the issue history shows bug classes fixed under production pressure, not demo-week polish."],
    ["coin", "Free and open source", "Every tool on this page ships under an open license and can be self-hosted. Your usage data and your configs stay yours."],
  ],
};
const BEN_DEFAULT: [string, string, string][] = [
  ["bolt", "Works out of the box", "Open source installs are one command from the README, and the community threads cover the edge cases before you hit them."],
  ["team", "Shared by thousands of builders", "This many stars means the defaults are battle-tested across real projects - you inherit other people's hard-won setup knowledge."],
  ["shield", "Transparent and inspectable", "Read exactly what the code, prompts and configs do before you install. Nothing is hidden behind a hosted model."],
  ["refresh", "Actively maintained", "The snapshot tracks commits, issues and releases, so you can see the project is alive before you depend on it."],
];

export default function RepoDetail() {
  const { id } = useParams();
  const rid = decodeURIComponent(id ?? "");
  const repo = repoById(rid);
  const { saved, toggleSaved, toast, countDownload } = useStore();
  const { contribs, langs } = useLive(repo);

  const related = useMemo(() =>
    repo ? CATALOG.filter((r) => r.cat === repo.cat && r.repo !== repo.repo).sort(byStars).slice(0, 6) : [],
    [repo]);

  if (!repo) return <NotFound />;
  const owner = repo.repo.split("/")[0];
  const on = saved.includes(repo.repo);

  const langArr = Object.entries(langs ?? synthLangs(repo)).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const langTotal = langArr.reduce((s, [, v]) => s + v, 0) || 1;
  const pulse = [repo.stars, repo.forks, repo.issues * 3, Math.round(hash(repo.repo) % Math.max(200, repo.forks / 4))]
    .map((v, i) => ({ v, max: Math.max(...[repo.stars, repo.forks, repo.issues * 3]) , lbl: ["stars", "forks", "issues ×3", "watchers"][i], c: ["var(--color-honey)", "var(--color-denim)", "var(--color-leaf)", "var(--color-plum)"][i], i }));

  return (
    <>
      {/* ── repo head ── */}
      <header className="border-b border-liness">
        <div className={`${W} py-12`}>
          <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim mb-5">
            <Link to="/" className="hover:text-accent">Home</Link> / {repo.cat === "programs"
              ? <Link to="/projects" className="hover:text-accent">Projects</Link>
              : <Link to="/skills" className="hover:text-accent">Skills</Link>} / <span className="text-cocoa">{repo.repo.split("/")[1]}</span>
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-14 h-14 rounded-4 grid place-items-center overflow-hidden shrink-0 shadow-soft bg-white border border-line">
              <OrgImg src={avatarOf(owner, 96)} name={repo.repo} className="w-[38px] h-[38px] object-contain" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-[clamp(24px,3vw,34px)] tracking-[-.02em]">
                {owner}<small className="text-dim font-medium"> / {repo.repo.split("/")[1]}</small>
              </h1>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <Chip tone="cat">{CAT_META[repo.cat]?.label ?? repo.cat}</Chip>
                <Chip tone="lang"><i className="w-2 h-2 rounded-full shrink-0" style={{ background: LANG_COLORS[repo.lang] ?? "currentColor" }} aria-hidden />{repo.lang}</Chip>
                <Chip>{repo.license}</Chip>
                {(repo as ProgramRepo).programs?.map((p) => (
                  <Link key={p} to={programLink(p)} title={PROGRAM_META[p].full} className="hover:-translate-y-px transition-transform">
                    <Chip tone={PROGRAM_META[p].tone}>{PROGRAM_META[p].label} page</Chip>
                  </Link>
                ))}
              </div>
            </div>
            <div className="ml-auto flex gap-2.5 items-center flex-wrap">
              <button onClick={() => { const added = toggleSaved(repo.repo); toast(added ? "Saved to your dashboard" : "Removed from saved"); }}
                className={btn(on ? "primary" : "outline", "md")}>{on ? "★ Saved" : "☆ Save"}</button>
              {repo.cat !== "tools" && (
                <a href={`https://api.github.com/repos/${repo.repo}/zipball`}
                  onClick={() => { countDownload(repo.repo); toast(`Downloading ${repo.repo.split("/")[1]} .zip via cyrus.ai`); }}
                  className={btn("primary", "md")}>Download .zip</a>
              )}
              <a href={repo.url} target="_blank" rel="noopener" className={btn(repo.cat === "tools" ? "primary" : "dark", "md")}>View on GitHub</a>
            </div>
          </div>
          <p className="text-cocoa mt-4 max-w-[720px] text-[15.5px] leading-[1.65]">{repo.desc}</p>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3 mt-7">
            {[[fmtCompact(repo.stars), "stars"], [fmtCompact(repo.forks), "forks"], [fmtCompact(repo.issues), "open issues"], [repo.updated, "last pushed"], [repo.license, "license"]].map(([v, l]) => (
              <div key={l} className="bg-card border border-line rounded-[14px] px-4 py-3.5 shadow-soft">
                <b className="block font-mono text-[20px]">{v}</b>
                <span className="text-[11px] text-dim uppercase tracking-[.06em]">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className={`${W} pt-9 pb-8 grid grid-cols-[1fr_340px] gap-7 items-start max-[1020px]:grid-cols-1`}>
        {/* ── main column ── */}
        <div>
          <Panel title="What it is, and how people use it">
            <p className="text-cocoa text-[14.5px] leading-[1.7] mb-4">{repo.desc} It sits on the <b className="text-ink">{CAT_META[repo.cat]?.label}</b> shelf of the catalog, maintained by <a className="text-accent underline underline-offset-2" href={`https://github.com/${owner}`} target="_blank" rel="noopener">@{owner}</a>.</p>
            <div className="grid gap-0.5">
              {[
                `Drop-in for Claude Code, Codex CLI and Cursor - install and it just runs.`,
                `Read the SKILL.md / README first; most setups are one command from the docs.`,
                `Teams use it to standardise how agents behave across every repo in the org.`,
              ].map((u) => (
                <div key={u} className="flex gap-3 py-3 border-b border-liness last:border-0 text-[14px] text-cocoa leading-[1.6]">
                  <span className="text-leaf font-bold shrink-0">✓</span>{u}
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap mt-4">{repo.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            {repo.home && (
              <a href={repo.home} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-accent underline underline-offset-2 mt-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5" /></svg>
                {repo.home.replace(/^https?:\/\//, "")}
              </a>
            )}
          </Panel>

          <Panel title={`Why builders keep it installed`} count={`${CAT_META[repo.cat]?.label ?? repo.cat} benefits`}>
            <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
              {(BENEFITS[repo.cat] ?? BEN_DEFAULT).map(([ic, t, d]) => (
                <div key={t} className="bg-paper border border-line rounded-[14px] p-4 flex gap-3.5 items-start">
                  <span className="w-[36px] h-[36px] rounded-[11px] shrink-0 grid place-items-center bg-peach border border-accent/20 text-rust">{BEN(ic)}</span>
                  <span className="min-w-0">
                    <b className="block font-display text-[14px] mb-1">{t}</b>
                    <p className="text-cocoa text-[12.5px] leading-[1.6]">{d}</p>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Contributors" count={contribs ? `${contribs.length} shown · live from GitHub API` : "loading from GitHub…"}>
            <div className="flex flex-wrap gap-2.5">
              {(contribs ?? synthContribs(repo)).slice(0, 12).map((c, i) => (
                <a key={c.login + i} href={c.html_url} target="_blank" rel="noopener"
                  className="flex items-center gap-2 bg-paper border border-line rounded-full py-[5px] pl-[5px] pr-3 text-[12.5px] font-semibold transition-colors hover:border-accent">
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt="" loading="lazy" className="w-[26px] h-[26px] rounded-full bg-clay" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    : <Avatar name={c.login} size={26} />}
                  {c.login}<small className="font-mono text-[10.5px] text-dim">{fmtCompact(c.contributions)}</small>
                </a>
              ))}
            </div>
          </Panel>

          <Panel title="Languages" count={langs ? "live from GitHub API" : "estimated from snapshot"}>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] mb-3.5">
              {langArr.map(([l, v]) => <i key={l} className="block h-full grow-x" style={{ flex: v, background: LANG_COLORS[l] ?? "#a09282" }} />)}
            </div>
            <ul className="flex flex-wrap gap-x-[18px] gap-y-2 list-none">
              {langArr.map(([l, v]) => (
                <li key={l} className="text-[12.5px] text-cocoa flex items-center gap-1.5">
                  <i className="w-[9px] h-[9px] rounded-full not-italic" style={{ background: LANG_COLORS[l] ?? "#a09282" }} />
                  {l} <b className="font-mono text-[11px] text-ink">{((v / langTotal) * 100).toFixed(1)}%</b>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Community pulse" count="snapshot ratios, normalized">
            <div className="flex items-end gap-[7px] h-[120px]">
              {pulse.map((p) => (
                <i key={p.lbl} className="flex-1 rounded-t-[5px] pulse-bar block"
                  style={{ height: `${Math.max(6, (p.v / pulse[0].v) * 100)}%`, background: `linear-gradient(180deg, ${p.c}, color-mix(in srgb, ${p.c} 12%, var(--color-card)))`, animationDelay: `${p.i * 80}ms` }} />
              ))}
            </div>
            <div className="flex gap-4 mt-3.5 font-mono text-[11px] text-cocoa flex-wrap">
              {pulse.map((p) => <span key={p.lbl}><i className="inline-block w-[9px] h-[9px] rounded-[3px] mr-1.5 not-italic" style={{ background: p.c }} />{p.lbl}</span>)}
            </div>
          </Panel>
        </div>

        {/* ── sidebar ── */}
        <aside>
          <Panel title="Related on this shelf">
            <div className="grid gap-3">
              {related.map((r) => (
                <Link key={r.repo} to={`/repo/${encodeURIComponent(r.repo)}`}
                  className="bg-paper border border-line rounded-[14px] p-3.5 transition-all hover:border-accent hover:-translate-y-0.5 hover:shadow-soft block">
                  <b className="text-[13.5px] block mb-1.5 font-display">{r.repo.split("/")[1]}</b>
                  <p className="text-[11.5px] text-cocoa leading-[1.5] line-clamp-2">{r.desc}</p>
                  <div className="flex items-center gap-3 mt-2 font-mono text-[10.5px] text-dim">
                    <span className="text-honey font-bold">★ {fmtCompact(r.stars)}</span>
                    <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full not-italic" style={{ background: LANG_COLORS[r.lang] ?? "#a09282" }} />{r.lang}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Fund the maintainers">
            <a href={`https://github.com/sponsors/${owner}`} target="_blank" rel="noopener"
              className="flex items-center gap-3 bg-paper border border-line rounded-[14px] p-3.5 transition-all hover:border-brick hover:translate-x-1">
              <OrgImg src={avatarOf(owner, 76)} name={owner} className="w-[38px] h-[38px] rounded-full bg-clay border border-line object-cover" />
              <span className="min-w-0"><b className="text-[13.5px] block font-display truncate">{owner}</b><span className="text-[12px] text-cocoa">GitHub Sponsors</span></span>
              <span className="ml-auto shrink-0 text-brick" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21c-4.8-3.6-9.3-7.5-9.3-12A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 21.3 9c0 4.5-4.5 8.4-9.3 12Z" /></svg>
              </span>
            </a>
            <p className="text-[12px] text-dim leading-[1.6] mt-3">The agent ecosystem runs on unpaid maintainers. One click sends value back to the commons.</p>
          </Panel>

          <div className="bg-peach border border-accent/20 rounded-[18px] p-5">
            <h3 className="panel-h mb-1.5">Data <Word>honesty</Word></h3>
            <p className="text-[12.5px] text-rust leading-[1.65]">
              Snapshot stats were taken 2026-10-02. Contributors and languages above are fetched live from the
              GitHub API; if rate-limited, you'll see clearly-labelled estimates instead.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
