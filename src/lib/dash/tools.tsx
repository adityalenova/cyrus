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
import type { Dash } from "./useDash";

const GSOC_URL = "https://summerofcode.withgoogle.com";

const fin = "w-full bg-cream border border-line rounded-[10px] pl-9 pr-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60 transition-colors placeholder:text-dim";
const sel = "bg-cream border border-line rounded-[10px] px-3 py-2.5 text-[13px] text-ink outline-none focus:border-accent/60 cursor-pointer";

function ToolNote({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-[1.8] mt-4">{children}</p>;
}


/* ── 2. mentor finder ─────────────────────────────────────────── */
type GRow = { y: number; u: string; t: string; o: string; tt?: string[]; m?: string; url?: string; program?: string };

/** where a project record's own page lives: GSoC builds the url from year + uid,
    the LFX / Outreachy / Summer of Bitcoin archive rows carry the real link. */
const projectUrl = (p: GRow) =>
  p.url || `${GSOC_URL}/programs/${p.y}/projects/${p.u}`;

const MENTOR_PROGRAMS = ["GSoC", "LFX", "Summer of Bitcoin"];

function MentorsSection() {
  const [rows, setRows] = useState<GRow[] | null>(null);
  const [q, setQ] = useState("");
  const [org, setOrg] = useState("all");
  const [prog, setProg] = useState("all");

  /* every archive that names its mentors. Outreachy is deliberately absent: its
     API publishes the project and the org but not the people, so 437 Outreachy
     projects contribute 0 mentor rows and saying so beats padding the count. */
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/data/gsoc-projects.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/data/otherProjects.json").then((r) => (r.ok ? r.json() : null)),
    ]).then(([g, o]) => {
      if (!live) return;
      const gsoc: GRow[] = (g?.projects ?? []).map((p: GRow) => ({ ...p, program: "GSoC" }));
      const rest: GRow[] = (o?.projects ?? []).filter((p: GRow) => p.m).map((p: GRow) => ({ ...p, program: p.program ?? "LFX" }));
      setRows([...gsoc, ...rest]);
    }).catch(() => live && setRows([]));
    return () => { live = false; };
  }, []);

  const mentors = useMemo(() => {
    if (!rows) return null;
    const map = new Map<string, { parts: Set<string>; progs: Set<string>; n: number; techs: Set<string>; last: number; sample: GRow }>();
    for (const p of rows) {
      if (!p.m) continue;
      for (const raw of p.m.split(",")) {
        const name = raw.trim().replace(/\s+/g, " ");
        if (name.length < 3 || /^\d+$/.test(name)) continue;
        const key = name.toLowerCase();
        const e = map.get(key);
        if (e) {
          e.n++; e.parts.add(p.o); e.last = Math.max(e.last, p.y);
          e.progs.add(p.program ?? "GSoC");
          (p.tt ?? []).forEach((t) => e.techs.add(t));
        } else map.set(key, { parts: new Set([p.o]), progs: new Set([p.program ?? "GSoC"]), n: 1, techs: new Set(p.tt ?? []), last: p.y, sample: p });
      }
    }
    return [...map.entries()].map(([key, e]) => ({
      name: (e.sample.m ?? "").split(",").find((x) => x.trim().toLowerCase() === key)?.trim() ?? key,
      n: e.n, orgs: [...e.parts], progs: [...e.progs], techs: [...e.techs].slice(0, 4), last: e.last, sample: e.sample,
    }));
  }, [rows]);

  const orgOptions = useMemo(() => {
    if (!mentors) return [];
    return [...new Set(mentors.flatMap((m) => m.orgs))].sort((a, b) => a.localeCompare(b)).slice(0, 400);
  }, [mentors]);

  const shown = useMemo(() => {
    if (!mentors) return [];
    const needle = q.trim().toLowerCase();
    return mentors
      .filter((m) => (org === "all" || m.orgs.includes(org))
        && (prog === "all" || m.progs.includes(prog))
        && (!needle || m.name.toLowerCase().includes(needle) || m.orgs.some((o) => o.toLowerCase().includes(needle))))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, 24);
  }, [mentors, q, org, prog]);

  return (
    <Card>
      <DashHead title="Mentor finder" sub={rows ? `${shown.length} of ${fmtCompact(mentors?.length ?? 0)} people named as a mentor on an accepted ${MENTOR_PROGRAMS.join(", ")} project, searchable by name or organization.` : "Reading the mentor names out of the project archives."} />
      <div className="grid md:grid-cols-[1fr_190px_170px] gap-3 mt-6 [&>*]:min-w-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"><Ic d={DP.search} size={14} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mentor or organization…" className={fin} />
        </div>
        <select value={prog} onChange={(e) => setProg(e.target.value)} className={sel} aria-label="Program">
          <option value="all">Any program</option>
          {MENTOR_PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={org} onChange={(e) => setOrg(e.target.value)} className={sel} aria-label="Organization">
          <option value="all">Any organization</option>
          {orgOptions.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {!mentors ? (
        <div className="grid gap-2 mt-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[58px] rounded-[12px] border border-line bg-cream/40 animate-pulse" />)}</div>
      ) : shown.length ? (
        <div className="grid gap-2 mt-5 [&>*]:min-w-0">
          {shown.map((m) => (
            <div key={m.name} className="flex items-center gap-3 rounded-[12px] border border-line bg-cream px-3.5 py-3 flex-wrap">
              <span className="min-w-0 flex-1 basis-[200px]">
                <b className="block text-[13.5px] font-semibold text-ink truncate">{m.name}</b>
                <span className="block font-mono text-[9.5px] text-dim truncate">
                  {m.orgs.slice(0, 2).join(", ")}{m.orgs.length > 2 ? ` +${m.orgs.length - 2}` : ""} · last mentored {m.last}
                </span>
              </span>
              <span className="flex gap-1.5 shrink-0">
                {m.progs.map((p) => <span key={p} className="font-mono text-[9px] rounded-full border border-line bg-card px-2 py-[3px] text-cocoa">{p}</span>)}
                {m.techs.slice(0, 2).map((t) => <span key={t} className="font-mono text-[9px] rounded-full border border-line bg-card px-2 py-[3px] text-cocoa truncate max-w-[90px]">{t}</span>)}
              </span>
              <span className="font-mono text-[10.5px] font-bold text-accent shrink-0">{m.n} {m.n === 1 ? "project" : "projects"}</span>
              <a href={projectUrl(m.sample)} target="_blank" rel="noopener" className={btn("outline", "sm", "shrink-0")}>Project ↗</a>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-6 flex-wrap">
          <div className="text-dim shrink-0 w-[190px]"><ArtPeople /></div>
          <p className="text-[13.5px] text-dim max-w-[420px] leading-[1.7]">
            No mentor by that name in the archive. The {fmtCompact(rows?.length ?? 0)} projects we read
            cover 2022 through 2026, and only the mentors the program itself published on the
            project record are here - a person can mentor without ever being named on one.
          </p>
        </div>
      )}
      <ToolNote>Names and organizations copied verbatim from the official project exports in /data/gsoc-projects.json and /data/otherProjects.json. Outreachy publishes its 437 accepted projects but not who mentored them, so no Outreachy mentor appears here. Availability is not implied.</ToolNote>
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
