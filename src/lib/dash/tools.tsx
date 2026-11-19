"use client"
/* ══ tools.tsx — the working tools on the board ══════════════════
   The co-pilot lives in copilot.tsx; mentor finder, compare orgs and
   the git initializer live here. Every number comes from data the site
   already keeps honest: the repo catalog, the real GSoC project archive
   (mentor names included) and the org profiles. Nothing is simulated;
   where a fact is not in the data the tools say so instead of guessing.
   ═══════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { REPOS } from "../../data/repos";
import { ORGS } from "../../data/orgs";
import { programsOf } from "../../data/programAssoc";
import { ArtBranch, ArtPeople, ArtScales } from "./art";
import { avatarOf, fmtCompact } from "../../lib/util";
import { btn, OrgImg } from "../../components/ui";
import { Card, DashHead, Ic } from "./shell";
import { DP, parseIssueUrl } from "./shared";
import { CoPilotSection } from "./copilot";
import { useMentorsCatalog } from "../../lib/mentorIndex";
import type { Dash } from "./useDash";

const fin = "w-full bg-cream border border-line rounded-[10px] pl-9 pr-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60 transition-colors placeholder:text-dim";
const sel = "bg-cream border border-line rounded-[10px] px-3 py-2.5 text-[13px] text-ink outline-none focus:border-accent/60 cursor-pointer";

function ToolNote({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-[1.8] mt-4">{children}</p>;
}

/* ── 2. mentor finder ─────────────────────────────────────────── */
const MENTOR_PROGRAMS = ["GSoC", "LFX Mentorship", "Summer of Bitcoin", "Season of KDE"];
const POPULAR_TECHS = ["python", "c++", "javascript", "typescript", "rust", "go", "react", "docker", "pytorch", "kubernetes", "linux"];

function MentorsSection() {
  const { mentors, loading } = useMentorsCatalog();
  const [q, setQ] = useState("");
  const [org, setOrg] = useState("all");
  const [prog, setProg] = useState("all");
  const [tech, setTech] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const orgOptions = useMemo(() => {
    if (!mentors) return [];
    return [...new Set(mentors.flatMap((m) => m.orgs))].sort((a, b) => a.localeCompare(b)).slice(0, 500);
  }, [mentors]);

  const filtered = useMemo(() => {
    if (!mentors) return [];
    const needle = q.trim().toLowerCase();
    return mentors.filter((m) => {
      const matchOrg = org === "all" || m.orgs.includes(org);
      const matchProg = prog === "all" || m.progs.some((p) => p.toLowerCase().includes(prog.toLowerCase()));
      const matchTech = tech === "all" || m.techs.some((t) => t.toLowerCase() === tech.toLowerCase());
      const matchSearch =
        !needle ||
        m.name.toLowerCase().includes(needle) ||
        m.orgs.some((o) => o.toLowerCase().includes(needle)) ||
        m.techs.some((t) => t.toLowerCase().includes(needle));
      return matchOrg && matchProg && matchTech && matchSearch;
    });
  }, [mentors, q, org, prog, tech]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [q, org, prog, tech]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const shown = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <DashHead
          title="Mentor directory & finder"
          sub={
            mentors
              ? `Showing ${filtered.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filtered.length)} of ${filtered.length.toLocaleString()}` : "0"} verified mentors across ${MENTOR_PROGRAMS.join(", ")}.`
              : "Loading complete verified mentor catalog..."
          }
        />
        <Link to="/mentorship" className={btn("primary", "sm", "shrink-0")}>
          Open Full Mentorship Explorer ↗
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_140px] gap-3 mt-5 [&>*]:min-w-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"><Ic d={DP.search} size={14} /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by mentor name, org, or skill…"
            className={fin}
            aria-label="Search mentors"
          />
        </div>
        <select value={prog} onChange={(e) => setProg(e.target.value)} className={sel} aria-label="Filter by Program">
          <option value="all">All programs</option>
          {MENTOR_PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={tech} onChange={(e) => setTech(e.target.value)} className={sel} aria-label="Filter by Tech Stack">
          <option value="all">All technologies</option>
          {POPULAR_TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={org} onChange={(e) => setOrg(e.target.value)} className={sel} aria-label="Filter by Organization">
          <option value="all">All organizations</option>
          {orgOptions.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {loading || !mentors ? (
        <div className="grid gap-2 mt-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[64px] rounded-[12px] border border-line bg-cream/40 animate-pulse" />
          ))}
        </div>
      ) : shown.length ? (
        <>
          <div className="grid gap-2 mt-5 [&>*]:min-w-0">
            {shown.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-3.5 rounded-[12px] border border-line bg-cream px-4 py-3 flex-wrap hover:border-accent/40 transition-colors"
              >
                <span className="min-w-0 flex-1 basis-[220px]">
                  <b className="block text-[14px] font-semibold text-ink truncate">{m.name}</b>
                  <span className="block font-mono text-[10px] text-dim truncate mt-0.5">
                    {m.orgs.join(", ") || "Open Source Organization"} · active {m.years.join(", ")}
                  </span>
                </span>
                <span className="flex gap-1.5 shrink-0 flex-wrap">
                  {m.progs.map((p) => (
                    <span key={p} className="font-mono text-[9.5px] rounded-full border border-line bg-card px-2.5 py-[2px] text-cocoa">
                      {p}
                    </span>
                  ))}
                  {m.techs.slice(0, 3).map((t) => (
                    <span key={t} className="font-mono text-[9px] rounded-full border border-accent/20 bg-accent/5 px-2 py-[2px] text-accent font-medium truncate max-w-[95px]">
                      {t}
                    </span>
                  ))}
                </span>
                <span className="font-mono text-[11px] font-bold text-accent shrink-0">
                  {m.projects} {m.projects === 1 ? "project" : "projects"}
                </span>
                {m.sampleUrl ? (
                  <a href={m.sampleUrl} target="_blank" rel="noopener noreferrer" className={btn("outline", "sm", "shrink-0")}>
                    Project ↗
                  </a>
                ) : null}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-line flex-wrap">
            <span className="font-mono text-[11px] text-dim">
              Page {page} of {totalPages} ({filtered.length.toLocaleString()} mentors)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={btn("outline", "sm")}
                aria-label="Previous page"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5 && page > 3) {
                    pNum = Math.min(totalPages - 4 + i, page - 2 + i);
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`min-w-[32px] h-[32px] rounded-[8px] font-mono text-[11px] border font-semibold transition-colors ${
                        page === pNum
                          ? "bg-coffee text-foam border-coffee"
                          : "bg-card border-line text-cocoa hover:bg-cream"
                      }`}
                      aria-label={`Go to page ${pNum}`}
                      aria-current={page === pNum ? "page" : undefined}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={btn("outline", "sm")}
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 flex items-center gap-6 flex-wrap">
          <div className="text-dim shrink-0 w-[190px]"><ArtPeople /></div>
          <div>
            <p className="text-[13.5px] text-dim max-w-[420px] leading-[1.7]">
              No mentors match your search criteria. Try removing filters or searching for another mentor name, tech stack, or organization.
            </p>
            <button
              type="button"
              onClick={() => { setQ(""); setOrg("all"); setProg("all"); setTech("all"); }}
              className={btn("outline", "sm", "mt-3")}
            >
              Reset filters
            </button>
          </div>
        </div>
      )}
      <ToolNote>
        Verified mentors compiled directly from official program exports across Google Summer of Code, LFX Mentorship, Summer of Bitcoin, and Season of KDE archives. Every mentor name and participating organization is preserved.
      </ToolNote>
    </Card>
  );
}

/* ── 3. compare orgs ──────────────────────────────────────────── */
function CompareSection() {
  const [a, setA] = useState("google");
  const [b, setB] = useState("vercel");
  const oa = ORGS.find((o) => o.login === a) ?? ORGS[0];
  const ob = ORGS.find((o) => o.login === b) ?? ORGS[1];
  const max = { stars: Math.max(oa.stars, ob.stars, 1), repos: Math.max(oa.repos, ob.repos, 1), issues: Math.max(oa.issues, ob.issues, 1) };

  const Bar = ({ label, va, vb, fmtv }: { label: string; va: number; vb: number; fmtv: (n: number) => string }) => (
    <div className="grid grid-cols-[1fr_110px_1fr] items-center gap-3 py-3 border-b border-liness last:border-0">
      <span className="flex justify-end"><i className="not-italic block h-[7px] rounded-full bg-accent/70" style={{ width: `${Math.max(4, (va / (label === "Stars" ? max.stars : label === "Repositories" ? max.repos : max.issues)) * 100)}%` }} /></span>
      <span className="text-center">
        <b className="block font-mono text-[9px] uppercase tracking-[.12em] text-dim">{label}</b>
        <span className="flex justify-center gap-2 font-mono text-[11px] mt-0.5"><b className="text-accent">{fmtv(va)}</b><span className="text-dim">/</span><b className="text-denim">{fmtv(vb)}</b></span>
      </span>
      <span className="flex"><i className="not-italic block h-[7px] rounded-full bg-denim/70" style={{ width: `${Math.max(4, (vb / (label === "Stars" ? max.stars : label === "Repositories" ? max.repos : max.issues)) * 100)}%` }} /></span>
    </div>
  );

  const Side = ({ o, which, set }: { o: typeof oa; which: string; set: (v: string) => void }) => (
    <div className="flex items-center gap-3 min-w-0">
      <OrgImg src={avatarOf(o.login, 64)} name={o.login} className="w-[38px] h-[38px] rounded-[10px] object-cover bg-sand shrink-0" />
      <div className="min-w-0 flex-1">
        <select value={which} onChange={(e) => set(e.target.value)} className={sel + " w-full"} aria-label={`Organization ${which}`}>
          {ORGS.map((x) => <option key={x.login} value={x.login}>{x.name}</option>)}
        </select>
        <span className="flex items-center gap-2 font-mono text-[9.5px] text-dim mt-1.5">
          <Link to={`/organizations/${o.login}`} className="hover:text-accent transition-colors">profile ›</Link>
          <span>· {o.level}</span>
        </span>
      </div>
    </div>
  );

  const progs = (login: string) => programsOf(login);

  return (
    <Card>
      <DashHead title="Compare orgs" sub="Two organizations, every public number we track for them, side by side." />
      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <Side o={oa} which={a} set={setA} />
        <Side o={ob} which={b} set={setB} />
      </div>
      <div className="mt-5">
        {oa.login === ob.login ? (
          <div className="flex items-center gap-6 flex-wrap py-2">
            <div className="text-dim shrink-0 w-[190px]"><ArtScales /></div>
            <p className="text-[13.5px] text-dim max-w-[400px] leading-[1.7]">
              Both sides are {oa.name}. Choose a second organization on the right and the stars,
              repositories and open issues face off here.
            </p>
          </div>
        ) : (
          <>
            <Bar label="Stars" va={oa.stars} vb={ob.stars} fmtv={fmtCompact} />
            <Bar label="Repositories" va={oa.repos} vb={ob.repos} fmtv={(n) => String(n)} />
            <Bar label="Open issues" va={oa.issues} vb={ob.issues} fmtv={fmtCompact} />
          </>
        )}
      </div>
      {oa.login !== ob.login && (
        <div className="grid md:grid-cols-2 gap-5 mt-5">
        {[oa, ob].map((o) => (
          <div key={o.login} className="rounded-[12px] border border-line bg-cream p-4">
            <b className="block font-mono text-[9px] uppercase tracking-[.14em] text-dim mb-2">{o.login} runs</b>
            {progs(o.login).length ? (
              <span className="flex flex-wrap gap-1.5">
                {progs(o.login).map((p) => <Link key={p.id} to={`/programs/${p.id}`} className="font-mono text-[9.5px] rounded-full border border-denim/35 bg-denim/8 text-denim px-2 py-[3px] hover:border-denim/70 transition-colors">{p.label} · {p.n}</Link>)}
              </span>
            ) : <span className="font-mono text-[10.5px] text-dim">No mentored program found in our data.</span>}
            <span className="flex flex-wrap gap-1.5 mt-3">
              {o.tags.slice(0, 5).map((t) => <span key={t} className="font-mono text-[9px] rounded-[5px] border border-line bg-card px-1.5 py-px text-cocoa">{t}</span>)}
            </span>
          </div>
        ))}
        </div>
      )}
      <ToolNote>Numbers are the crawl behind the org pages, not a live API call - open either profile to see the freshest figures.</ToolNote>
    </Card>
  );
}

/* ── 4. git initializer ───────────────────────────────────────── */
function GitStartSection({ d }: { d: Dash }) {
  const [raw, setRaw] = useState("");
  const parsed = parseIssueUrl(raw);
  const loose = !parsed && /^[\w.-]+\/[\w.-]+$/.test(raw.trim()) ? { repo: raw.trim(), number: 0 } : null;
  const target = parsed ?? loose;
  const repoMeta = target ? REPOS.find((r) => r.repo.toLowerCase() === target.repo.toLowerCase()) : undefined;

  const branch = target ? `fix/${target.repo.split("/")[1].toLowerCase()}-${target.number || "issue"}` : "";
  const script = target ? [
    `git clone https://github.com/${target.repo}.git`,
    `cd ${target.repo.split("/")[1]}`,
    `git switch -c ${branch}`,
    `# make one small, honest change`,
    `git add .`,
    `git commit -m "${target.number ? `Fix #${target.number}: ` : ""}describe what changed and why"`,
    `git push -u origin ${branch}`,
  ].join("\n") : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(script); d.toast("Commands copied - paste them into your terminal."); }
    catch { d.toast("Your browser blocked the clipboard; select the text and copy it manually."); }
  };

  return (
    <Card>
      <DashHead title="Git initializer" sub="Paste the issue you claimed. You get the exact seven commands that turn it into a branch, a commit and an open pull request." />
      <div className="relative mt-6 max-w-[520px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"><Ic d={DP.link} size={14} /></span>
        <input value={raw} onChange={(e) => setRaw(e.target.value)}
          placeholder="https://github.com/owner/repo/issues/123" className={fin} aria-label="GitHub issue URL" />
      </div>
      {!target ? (
        <div className="mt-6 flex items-center gap-6 flex-wrap">
          <div className="text-dim shrink-0 w-[190px]"><ArtBranch /></div>
          <p className="text-[13.5px] text-dim max-w-[380px] leading-[1.7]">
            Waiting for a link. An <code className="font-mono text-[12px] text-cocoa">owner/repo</code> works too
            if you have not picked the issue yet - the branch, the commit and the push are the same three moves
            either way.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            <span className="font-mono text-[11px] text-cocoa bg-cream border border-line rounded-full px-3 py-1">{target.repo}</span>
            {target.number > 0 && <span className="font-mono text-[11px] text-accent bg-peach border border-accent/35 rounded-full px-3 py-1">#{target.number}</span>}
            {repoMeta && <span className="font-mono text-[10px] text-dim">{repoMeta.lang} · {fmtCompact(repoMeta.issues)} open issues · ★ {fmtCompact(repoMeta.stars)}</span>}
            {target.number > 0 && (
              <button type="button" onClick={() => d.trackIssue(`https://github.com/${target.repo}/issues/${target.number}`)} className={btn("outline", "sm", "ml-auto")}>Track it on the board</button>
            )}
          </div>
          <pre className="mt-4 bg-coffee text-foam rounded-[12px] p-4 text-[12px] leading-[1.9] overflow-x-auto font-mono">{script}</pre>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button type="button" onClick={copy} className={btn("primary", "sm")}><Ic d={DP.check} size={13} /> Copy commands</button>
            <a href={`https://github.com/${target.repo}/issues${target.number ? `/${target.number}` : ""}`} target="_blank" rel="noopener" className={btn("outline", "sm")}>Open the issue ↗</a>
          </div>
          <div className="mt-5 rounded-[12px] border border-dashed border-line p-4">
            <b className="block font-mono text-[9px] uppercase tracking-[.14em] text-dim mb-2">Before you press create pull request</b>
            <ul className="text-[12.5px] leading-[1.9] text-cocoa list-disc pl-5">
              <li>Read the issue thread once more - someone may already be on it.</li>
              <li>Run the project&apos;s test command and paste the result in the PR body.</li>
              <li>Keep the diff to one concern; reviewers close sprawl.</li>
              <li>Link the issue (Fixes #n) so it closes itself when you merge.</li>
            </ul>
          </div>
        </>
      )}
      <ToolNote>Generated locally from the link you paste; nothing is sent anywhere and no repository knowledge is faked - the language and counts shown only appear for catalog repos.</ToolNote>
    </Card>
  );
}

export const TOOL_SECTIONS: Record<string, (p: { d: Dash }) => ReactNode> = {
  matcher: CoPilotSection,
  mentors: MentorsSection,
  compare: CompareSection,
  gitstart: GitStartSection,
};
