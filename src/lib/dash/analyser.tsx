"use client"
/* ══ analyser.tsx — repo analyser ══════════════════════════════════
   Paste any public repository. Everything on the page is a live answer
   from the GitHub REST API for that repository: the stars, the last
   push, how many people have ever committed, how many commits landed
   in the last month, the good-first-issue count, and which of the four
   community files exist. Nothing here is modelled or remembered from a
   snapshot.

   The score underneath it is ours, not GitHub's, and the weights are
   printed next to every signal so you can disagree with them.        ══ */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { btn } from "../../components/ui";
import { fmtCompact } from "../util";
import { repoById } from "../util";
import { Card, DashHead, Ic } from "./shell";
import { ArtScope } from "./art";
import { DP } from "./shared";
import type { Dash } from "./useDash";

const API = "https://api.github.com";
const H = { Accept: "application/vnd.github+json" };

interface GhRepo {
  full_name: string; description: string | null; html_url: string; homepage: string | null;
  stargazers_count: number; forks_count: number; open_issues_count: number; subscribers_count?: number;
  watchers_count?: number; size: number; language: string | null; archived: boolean; has_issues: boolean;
  license: { spdx_id: string | null; name: string } | null; topics?: string[];
  created_at: string; pushed_at: string; updated_at: string; default_branch: string;
  network_count?: number; subscribers_count_n?: number;
}
interface GhFile { key?: string; name?: string | null; spdx_id?: string | null; url?: string | null; html_url?: string | null }
interface GhCommunity { health_percentage: number | null; files: Record<string, GhFile | null> | null }

/* GitHub keys these in lower case and only some of them carry a name, so
   "is the file there" has to be asked of the url, never of the label. */
const DOCS: [string, string][] = [
  ["readme", "README.md"],
  ["contributing", "CONTRIBUTING.md"],
  ["license", "LICENSE"],
  ["code_of_conduct", "CODE_OF_CONDUCT.md"],
];
const hasDoc = (files: GhCommunity["files"] | undefined, key: string) => Boolean(files?.[key]?.html_url || files?.[key]?.url);

interface Read {
  repo: string;
  meta: GhRepo | null;
  community: GhCommunity | null;
  langs: Record<string, number> | null;
  contributors: number | null;
  recentCommits: number | null;
  goodFirst: number | null;
  openIssues: number | null;
  error: string | null;
}

const days = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 864e5)) : null);
const ago = (iso?: string) => {
  const d = days(iso);
  if (d === null) return "unknown";
  return d === 0 ? "today" : d === 1 ? "yesterday" : d < 60 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} months ago` : `${(d / 365).toFixed(1)} years ago`;
};

async function json(path: string): Promise<any | null> {
  const r = await fetch(`${API}${path}`, { headers: H });
  if (r.status === 403 || r.status === 429) throw new Error("rate");
  return r.ok ? r.json() : null;
}

async function readRepo(full: string): Promise<Read> {
  const base: Read = { repo: full, meta: null, community: null, langs: null, contributors: null, recentCommits: null, goodFirst: null, openIssues: null, error: null };
  try {
    const meta = await json(`/repos/${full}`);
    if (!meta) return { ...base, error: "GitHub has no public repository at that path." };
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const q = (labels: string) => encodeURIComponent(`repo:${full} type:issue state:open${labels}`);
    const [community, langs, contribs, commits, gfi] = await Promise.all([
      json(`/repos/${full}/community/profile`).catch(() => null),
      json(`/repos/${full}/languages`).catch(() => null),
      json(`/repos/${full}/contributors?per_page=100&anon=false`).catch(() => null),
      json(`/repos/${full}/commits?since=${encodeURIComponent(since)}&per_page=100`).catch(() => null),
      json(`/search/issues?q=${q(' label:"good first issue"')}&per_page=1`).catch(() => null),
    ]);
    return {
      repo: full, meta, community, langs,
      contributors: Array.isArray(contribs) ? contribs.length : null,
      recentCommits: Array.isArray(commits) ? commits.length : null,
      goodFirst: gfi && typeof gfi.total_count === "number" ? gfi.total_count : null,
      openIssues: meta.open_issues_count ?? null,
      error: null,
    };
  } catch (e) {
    const rate = (e as Error).message === "rate";
    return { ...base, error: rate
      ? "GitHub paused us - the unauthenticated API allows sixty reads per hour per browser. Wait a while and try again, or open the repository directly on GitHub."
      : "GitHub did not answer. Check the network and the spelling of owner/repo." };
  }
}

/* ── the score: ours, with the arithmetic on the page ─────────── */
type Signal = { label: string; got: number; max: number; why: string };

function scoreOf(r: Read): { total: number; signals: Signal[]; band: string; bandNote: string } {
  const m = r.meta!;
  const files = r.community?.files ?? null;
  const present = DOCS.filter(([k]) => hasDoc(files, k)).map(([, n]) => n);
  const docCount = present.length;
  const d = days(m.pushed_at) ?? 999;
  const signals: Signal[] = [
    { label: "Someone pushed here recently", got: d <= 7 ? 25 : d <= 30 ? 18 : d <= 90 ? 9 : d <= 365 ? 4 : 0, max: 25,
      why: `Last push ${ago(m.pushed_at)}. Twenty-five points inside a week, four inside a year.` },
    { label: "The four community files are there", got: docCount * 6, max: 24,
      why: `${docCount} of 4 present${r.community ? ` (${present.join(", ") || "none"})` : " - GitHub returned no community profile"}. Six points each.` },
    { label: "More than one person maintains it", got: r.contributors === null ? 0 : Math.min(16, (r.contributors ?? 0) >= 11 ? 16 : (r.contributors ?? 0) >= 6 ? 12 : (r.contributors ?? 0) >= 3 ? 8 : (r.contributors ?? 0) >= 2 ? 5 : 2), max: 16,
      why: `${r.contributors === null ? "contributor count unknown" : `${r.contributors} contributors in the first page`}. One maintainer is a bus factor of one.` },
    { label: "Work is labelled for a newcomer", got: (r.goodFirst ?? 0) > 0 ? 17 : m.has_issues ? 5 : 0, max: 17,
      why: r.goodFirst ? `${r.goodFirst} open issues carry the good-first-issue label.` : m.has_issues ? "Issues are open but none wear a newcomer label - ask before you take one." : "Issues are switched off, so pull requests arrive unannounced." },
    { label: "Commits landed in the last month", got: r.recentCommits === null ? 0 : Math.min(18, (r.recentCommits ?? 0) >= 30 ? 18 : (r.recentCommits ?? 0) >= 10 ? 14 : (r.recentCommits ?? 0) >= 3 ? 9 : (r.recentCommits ?? 0) >= 1 ? 5 : 0), max: 18,
      why: `${r.recentCommits === null ? "unknown" : `${r.recentCommits} commit${r.recentCommits === 1 ? "" : "s"} in the last thirty days`} (page one, capped at a hundred).` },
  ];
  const total = Math.max(0, Math.min(100, signals.reduce((s, x) => s + x.got, 0) - (m.archived ? 40 : 0)));
  const band = m.archived ? "Archived" : total >= 75 ? "Ready for a first pull request" : total >= 50 ? "Alive, check the threads" : total >= 30 ? "Quiet" : "Dormant";
  const bandNote = m.archived
    ? "GitHub marks this repository read-only. Work put into it will not be merged."
    : total >= 75 ? "Active, documented and clearly open to newcomers. A safe place to spend an evening."
      : total >= 50 ? "Real activity and a real maintainer. Read the thread on any issue before you start."
        : total >= 30 ? "Some life in it. Expect slower reviews and open an issue first."
          : "Nothing has moved for a while. Your pull request may sit unmerged - fork it or pick elsewhere.";
  return { total, signals, band, bandNote };
}

const Ring = ({ n }: { n: number }) => {
  const r = 30; const c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`Read score ${n} out of 100`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={n >= 75 ? "var(--color-leaf)" : n >= 50 ? "var(--color-accent)" : "var(--color-dim)"}
        strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(n / 100) * c} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="42" textAnchor="middle" className="font-mono" fontSize="15" fontWeight="700" fill="var(--color-ink)">{n}</text>
    </svg>
  );
};

const Stat = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div className="rounded-[12px] border border-line bg-cream px-3.5 py-3 min-w-0">
    <b className="block font-mono text-[9px] uppercase tracking-[.14em] text-dim">{k}</b>
    <span className="block text-[17px] font-display font-extrabold tracking-[-.02em] text-ink mt-1 truncate" title={v}>{v}</span>
    {sub && <span className="block font-mono text-[9.5px] text-dim mt-0.5 truncate">{sub}</span>}
  </div>
);

const parseRepo = (s: string) => {
  const t = s.trim().replace(/\.git$/, "").replace(/^https?:\/\/github\.com\//, "");
  const m = t.match(/^([\w.-]+)\/([\w.-]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
};

export function AnalyserSection({ d }: { d: Dash }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Read | null>(null);
  const [asked, setAsked] = useState("");

  const guess = useMemo(() => parseRepo(raw), [raw]);
  const catalog = guess ? repoById(guess) : undefined;

  const run = async (target?: string) => {
    const full = parseRepo(target ?? raw ?? "");
    if (!full) { d.toast("That does not look like owner/repo yet."); return; }
    setBusy(true); setAsked(full); setRes(null);
    const out = await readRepo(full);
    setRes(out); setBusy(false);
    if (!out.error) setRaw(full);
  };

  const m = res?.meta;
  const score = m ? scoreOf(res!) : null;
  const langs = res?.langs ? Object.entries(res.langs).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  const totalBytes = langs.length ? Object.values(res!.langs!).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <Card>
        <DashHead title="Repo analyser" sub="Any public repository, read live from GitHub right now - activity, maintenance load, newcomer readiness and which community files are missing." />
        <div className="flex flex-wrap gap-2.5 mt-6 items-end">
          <label className="block min-w-0 flex-1 basis-[260px]">
            <span className="block font-mono text-[9px] uppercase tracking-[.14em] text-dim mb-1.5">owner / repository</span>
            <input value={raw} onChange={(e) => setRaw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="vercel/next.js" className="w-full bg-cream border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60 transition-colors" />
          </label>
          <button type="button" onClick={() => run()} disabled={busy || !guess}
            className={btn("primary", "md") + (busy || !guess ? " opacity-60 pointer-events-none" : "")}>
            <Ic d={DP.pulse} size={14} /> {busy ? "Reading GitHub…" : "Analyse"}
          </button>
        </div>
        {!res && !busy && (
          <>
            <div className="flex flex-wrap gap-1.5 mt-4" role="group" aria-label="Try one of these">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-dim self-center mr-1">Try</span>
              {["vercel/next.js", "sindresorhus/ky", "rust-lang/rust", "home-assistant/core"].map((x) => (
                <button key={x} type="button" onClick={() => { setRaw(x); run(x); }}
                  className="font-mono text-[10px] rounded-full px-2.5 py-[6px] border border-line bg-cream text-cocoa hover:border-accent/50 hover:text-accent transition-colors cursor-pointer">{x}</button>
              ))}
            </div>
            <div className="mt-7 pt-6 border-t border-liness flex items-center gap-7 flex-wrap">
              <div className="text-dim shrink-0 w-[210px]"><ArtScope /></div>
              <div className="min-w-[260px] flex-1">
                <b className="block font-mono text-[9px] uppercase tracking-[.14em] text-dim mb-2.5">What one reading covers</b>
                <ul className="grid sm:grid-cols-2 gap-x-7 gap-y-1.5 text-[12.5px] text-cocoa">
                  <li>Stars, forks and open issues</li>
                  <li>The day of the last push</li>
                  <li>How many people ever committed</li>
                  <li>Commits landed in the last month</li>
                  <li>Open issues labelled for newcomers</li>
                  <li>Which community files exist</li>
                </ul>
              </div>
            </div>
          </>
        )}
        {catalog && !res && (
          <p className="font-mono text-[10.5px] text-dim mt-3">
            That one is in our catalog ({catalog.lang}, ★ {fmtCompact(catalog.stars)} as of the 2026-10-02 crawl) - the analyser ignores the snapshot and asks GitHub instead.
          </p>
        )}
      </Card>

      {res?.error && (
        <Card>
          <h2 className="panel-h text-[16px] mb-2">{asked}</h2>
          <p className="text-[13.5px] text-cocoa leading-[1.7]">{res.error}</p>
          <a href={`https://github.com/${asked}`} target="_blank" rel="noopener" className={btn("outline", "sm", "mt-4")}>Open it on GitHub ↗</a>
        </Card>
      )}

      {busy && (
        <Card>
          <div className="grid gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[64px] rounded-[12px] border border-line bg-cream/40 animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
          <p className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim mt-3">Six reads in flight: the repository, its community profile, languages, contributors, last month of commits and its newcomer labels.</p>
        </Card>
      )}

      {res && m && score && (
        <>
          <Card>
            <div className="flex items-start gap-4 flex-wrap">
              <Ring n={score.total} />
              <div className="min-w-[240px] flex-1">
                <h2 className="font-display font-extrabold text-[22px] tracking-[-.02em] leading-tight">
                  <a href={m.html_url} target="_blank" rel="noopener" className="hover:text-accent transition-colors">{m.full_name}</a>
                </h2>
                <p className="text-cocoa text-[13px] leading-[1.6] mt-1.5 max-w-[640px]">{m.description || "No description on GitHub."}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className={`font-mono text-[10px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full border ${score.total >= 75 ? "text-leaf border-leaf/40 bg-leaf/8" : score.total >= 50 ? "text-accent border-accent/40 bg-peach" : "text-dim border-line bg-cream"}`}>{score.band}</span>
                  {m.license && <span className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-line bg-cream text-cocoa">{m.license.spdx_id === "NOASSERTION" ? m.license.name : m.license.spdx_id}</span>}
                  {m.topics?.slice(0, 4).map((t) => <span key={t} className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-line bg-card text-dim">{t}</span>)}
                </div>
              </div>
              <Link to={d.saved.includes(m.full_name) ? "/dashboard/repos" : "/skills"}
                className={btn("ghost", "sm", "shrink-0")}>{d.saved.includes(m.full_name) ? "On your board" : "Find it in the catalog"}</Link>
            </div>
            <p className="text-[13px] text-cocoa leading-[1.65] mt-4 max-w-[720px]">{score.bandNote}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5 mt-5">
              <Stat k="Stars" v={fmtCompact(m.stargazers_count)} />
              <Stat k="Forks" v={fmtCompact(m.forks_count)} />
              <Stat k="Open issues + PRs" v={fmtCompact(m.open_issues_count)} sub="GitHub counts both" />
              <Stat k="Last push" v={ago(m.pushed_at)} />
              <Stat k="Commits / 30 days" v={res.recentCommits === null ? "?" : String(res.recentCommits)} sub="capped at 100" />
              <Stat k="Contributors" v={res.contributors === null ? "?" : String(res.contributors)} sub="first page, capped at 100" />
              <Stat k="Good first issues" v={res.goodFirst === null ? "?" : fmtCompact(res.goodFirst)} sub="live label search" />
            </div>
            <StatRow2 created={m.created_at} size={m.size} archived={m.archived} hasIssues={m.has_issues} health={res.community?.health_percentage ?? null} />
          </Card>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <h2 className="panel-h text-[16px] mb-1">How the score is built</h2>
              <p className="text-cocoa text-[12.5px] mb-3">Out of a hundred, and every weight is printed so you can argue with it.</p>
              <ul className="grid gap-3 list-none">
                {score.signals.map((s) => (
                  <li key={s.label}>
                    <div className="flex items-baseline gap-2">
                      <b className="text-[13px] text-ink">{s.label}</b>
                      <span className="ml-auto font-mono text-[10.5px] text-dim shrink-0">{s.got}/{s.max}</span>
                    </div>
                    <div className="h-[6px] rounded-full bg-clay overflow-hidden mt-1.5">
                      <i className="not-italic block h-full rounded-full" style={{ width: `${(s.got / s.max) * 100}%`, background: s.got / s.max > 0.6 ? "var(--color-leaf)" : s.got / s.max > 0.25 ? "var(--color-accent)" : "var(--color-dim)" }} />
                    </div>
                    <p className="text-[12px] text-cocoa leading-[1.6] mt-1.5">{s.why}</p>
                  </li>
                ))}
              </ul>
              {m.archived && <p className="font-mono text-[10.5px] text-rust mt-3">Archived on GitHub: forty points off, because nothing you write will be merged.</p>}
            </Card>

            <Card>
              <h2 className="panel-h text-[16px] mb-1">Community files GitHub can see</h2>
              <p className="text-cocoa text-[12.5px] mb-3">The same four the health indicator on the repository page counts.</p>
              {(() => {
                const files = res.community?.files;
                return (
                  <ul className="grid gap-2.5 list-none">
                    {DOCS.map(([key, name]) => {
                      const have = hasDoc(files, key);
                      const kind = files?.[key]?.name;
                      const note = kind && (key === "license" || key === "code_of_conduct") ? kind : null;
                      return (
                        <li key={key} className="flex items-center gap-3 rounded-[10px] border border-line bg-cream px-3.5 py-2.5">
                          <span className={have ? "text-leaf" : "text-dim"}><Ic d={have ? DP.check : DP.x} size={14} /></span>
                          <code className="font-mono text-[12px] text-ink">{name}</code>
                          {note && <span className="font-mono text-[10px] text-dim truncate">{note}</span>}
                          {!have && <Link to="/dashboard/drafts" className="ml-auto font-mono text-[10px] uppercase tracking-[.1em] text-accent hover:text-rust transition-colors">draft it ›</Link>}
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
              <p className="font-mono text-[10px] text-dim mt-3 leading-[1.7]">
                {res.community?.health_percentage !== null && res.community?.health_percentage !== undefined
                  ? <>GitHub&apos;s own community health number for this repository: <b className="text-cocoa">{res.community.health_percentage}%</b>. Our score is a different question - it asks whether a newcomer should contribute, GitHub&apos;s asks how complete the files are.</>
                  : "GitHub returned no community profile for this repository."}
              </p>

              {langs.length > 0 && (
                <div className="mt-5">
                  <b className="block font-mono text-[9px] uppercase tracking-[.14em] text-dim mb-2">Languages, by bytes on the default branch</b>
                  <div className="flex h-[9px] rounded-full overflow-hidden border border-line">
                    {langs.map(([l], i) => <i key={l} className="not-italic block h-full" style={{ width: `${((res.langs![l] / totalBytes) * 100)}%`, background: [ "var(--color-accent)", "var(--color-denim)", "var(--color-leaf)", "var(--color-honey)", "var(--color-plum)" ][i] ?? "var(--color-dim)" }} />)}
                  </div>
                  <ul className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2.5 list-none">
                    {langs.map(([l, b]) => <li key={l} className="font-mono text-[10.5px] text-cocoa">{l} {((b / totalBytes) * 100).toFixed(1)}%</li>)}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="panel-h text-[16px] mb-2">What to do with this</h2>
            <ul className="grid gap-2.5 list-none text-[13px] leading-[1.65] text-cocoa">
              {(res.goodFirst ?? 0) > 0 && (
                <li className="flex gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-[8px]" />
                  <span>{res.goodFirst} labelled issues wait. <a href={`https://github.com/${m.full_name}/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22`} target="_blank" rel="noopener" className="text-accent hover:text-rust underline decoration-accent/40">Open the list on GitHub ↗</a> or search them in the <Link to={`/issues?q=${encodeURIComponent(m.full_name.split("/")[1])}`} className="text-accent hover:text-rust">issue finder</Link>.</span></li>
              )}
              {score.signals[0].got < 18 && (
                <li className="flex gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-honey shrink-0 mt-[8px]" />
                  <span>Last push {ago(m.pushed_at)}. Open an issue and wait for a reply before you spend an evening on a fix.</span></li>
              )}
              {(res.contributors ?? 0) <= 2 && res.contributors !== null && (
                <li className="flex gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-honey shrink-0 mt-[8px]" />
                  <span>{res.contributors} contributor{res.contributors === 1 ? "" : "s"} on the first page - reviews depend on one person&apos;s week.</span></li>
              )}
              {!hasDoc(res.community?.files, "contributing") && (
                <li className="flex gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-leaf shrink-0 mt-[8px]" />
                  <span>No CONTRIBUTING file. That is the quickest way in: draft one in the <Link to="/dashboard/drafts" className="text-accent hover:text-rust">Draft studio</Link> and open the pull request that adds it.</span></li>
              )}
              <li className="flex gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-denim shrink-0 mt-[8px]" />
                <span>Everything read here came from api.github.com in this browser session, so the numbers are as of right now, not from our {catalog ? "2026-10-02 crawl" : "snapshot"}.</span></li>
            </ul>
            <a href={`https://github.com/${asked}`} target="_blank" rel="noopener" className={btn("outline", "sm", "mt-4")}>Repository on GitHub ↗</a>
          </Card>
        </>
      )}
    </>
  );
}

function StatRow2({ created, size, archived, hasIssues, health }: { created: string; size: number; archived: boolean; hasIssues: boolean; health: number | null }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 font-mono text-[10.5px] text-dim">
      <span>created {ago(created)}</span>
      <span>{Math.round(size / 1024)} MB on the default branch</span>
      <span>issues {hasIssues ? "open to the public" : "disabled"}</span>
      <span>{archived ? "archived - read only" : "not archived"}</span>
      {health !== null && <span>GitHub health {health}%</span>}
    </div>
  );
}
