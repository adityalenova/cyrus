"use client"
/* ══ copilot.tsx — the co-pilot: four steps from skills to work ═══════
   You say what you write and whether you want targets or tasks; it answers
   with one of the two, never both at once. Organizations come from the live
   GitHub profiles and the program participation record, issues and catalog
   repositories from the crawl snapshot and the catalog that ships with the
   site. Nothing is generated: every card names the input that put it there.
   The scoring is three arithmetic rules you can read below, chosen so
   a result can be explained rather than trusted.
   ═════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { REPOS } from "../../data/repos";
import { ORGS, PROGRAMS } from "../../data/orgs";
import { programsOf } from "../../data/programAssoc";
import { loadRosterOrgs, useRosterIndex, rosterUnit } from "../programRoster";
import type { RosterOrg } from "../programRoster";
import { SECTOR_FACETS, sectorOfOrg } from "../orgClasses";
import { CRAWL } from "../../data/crawlStats";
import type { Repo } from "../types";
import { avatarOf, fmtCompact } from "../util";
import { btn, OrgImg } from "../../components/ui";
import { Card, DashHead, Ic } from "./shell";
import { DP } from "./shared";
import type { Dash } from "./useDash";

/* ── the skill vocabulary, and what each one really matches ──────────
   Every language string is a `lang` value that appears in the catalog and
   every tag is a topic some catalog repository actually carries, so a chip
   can never be dead. The count under each group is how many of the 1,528
   repositories a single chip of that group can reach. */
type Skill = { id: string; label: string; langs: string[]; tags: string[]; desc?: RegExp };
const S = (label: string, langs: string[], tags: string[], desc?: RegExp): Skill => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, langs, tags, desc,
});

const GROUPS: { name: string; skills: Skill[] }[] = [
  { name: "Languages", skills: [
    S("Python", ["Python"], ["python"]),
    S("TypeScript", ["TypeScript"], ["typescript"]),
    S("JavaScript", ["JavaScript"], ["javascript"]),
    S("Go", ["Go"], ["go", "golang"]),
    S("Rust", ["Rust"], ["rust"]),
    S("Java", ["Java"], ["java"]),
    S("C / C++", ["C++", "C"], []),
    S("Shell", ["Shell"], ["bash"]),
    S("HTML / CSS", ["HTML", "CSS"], ["web", "frontend"]),
    S("Notebooks", ["Jupyter Notebook"], ["data-analysis"]),
  ] },
  { name: "AI and agents", skills: [
    S("AI agents", [], ["ai-agents", "agent", "agents", "ai-agent", "agentic-ai", "autonomous-agents"]),
    S("Agent skills", [], ["agent-skills", "claude-skills", "skills", "agent-harness"]),
    S("MCP", [], ["mcp", "mcp-server", "mcp-client"]),
    S("LLMs", [], ["llm", "large-language-models", "generative-ai", "genai", "openai", "anthropic", "gemini", "deepseek"]),
    S("Deep learning", [], ["deep-learning", "machine-learning", "pytorch", "deep-neural-networks"]),
    S("Computer vision", [], ["computer-vision", "image-generation"]),
    S("Prompt and codegen", [], ["prompt-engineering", "code-generation", "ai-coding", "ai-coding-agent"]),
    S("Chatbots", [], ["chatbot", "chat", "ai-assistant"]),
  ] },
  { name: "Tools and infrastructure", skills: [
    S("CLI tools", [], ["cli", "command-line", "developer-tools", "devtools"]),
    S("DevOps and CI", [], ["devops", "cicd", "ci-cd", "ci"]),
    S("Containers", [], ["docker", "containers", "kubernetes", "cloud-native"]),
    S("Cloud", [], ["aws", "azure", "cloud"]),
    S("APIs and backends", [], ["api", "backend"]),
    S("Databases", [], ["database"]),
    S("Testing", [], ["testing", "api-testing"]),
    S("Automation", [], ["automation", "browser-automation"]),
  ] },
  { name: "Data and frontend", skills: [
    S("Data science", [], ["data-science", "data-analysis", "data-engineering"]),
    S("Data visualization", [], ["data-visualization", "charts", "chart"]),
    S("Dashboards", [], ["dashboard", "analytics", "business-intelligence"]),
    S("React", [], ["react"]),
    S("Web apps", [], ["frontend", "framework"]),
    S("Crawlers", [], ["crawler"]),
  ] },
  { name: "Mobile and desktop", skills: [
    S("Android", ["Kotlin"], ["android"]),
    S("iOS", ["Swift"], ["ios"]),
    S("Desktop apps", ["Dart"], ["desktop-app", "electron", "macos", "cross-platform"]),
    S("Bots", [], ["bot"]),
  ] },
  { name: "Docs and community", skills: [
    S("Documentation", ["Markdown"], ["documentation", "docs", "book"], /doc|guide|readme/i),
    S("Awesome lists", [], ["awesome-list", "awesome"]),
    S("Accessibility", [], ["accessibility"]),
    S("Hacktoberfest", [], ["hacktoberfest"]),
  ] },
];
const ALL_SKILLS: Skill[] = GROUPS.flatMap((g) => g.skills);

/* One question per run. Asking for organizations and issues together produced
   a list that was neither a target nor a task, so the co-pilot now answers
   exactly one of the two and the shortlist is the whole answer. */
const GOALS: [string, string, string][] = [
  ["orgs", "Find organizations", "Who runs the programs you want, in the languages you write. Optionally only those one program or one field names."],
  ["issues", "Find open issues", "Work you can claim this week from the crawl snapshot, in the same skills, across the index or inside one organization."],
];
const LEVELS: [string, string, string][] = [
  ["first", "First contributions", "Beginner-labelled work, nobody assigned, quiet repositories."],
  ["some", "A few merges in", "Either way - the full range of what matches."],
  ["deep", "Maintainer-grade", "Large, fast-moving codebases with real review behind them."],
];
const HOURS: [number, string][] = [[1, "Up to 4 hours a week"], [2, "A full weekend of work"], [3, "Ten hours or more"]];
const STARS: [number, string][] = [[0, "Any size"], [1000, "1k stars and up"], [10000, "10k stars and up"]];

/* ── scoring ─────────────────────────────────────────────────────────
   Repository: a language you picked is worth 5, a topic you picked 3,
   a documentation phrase 1. Organization: 4 for every skill GitHub
   reports as one of its own primary languages, 2 for each of its
   catalogued repositories that matches, and 4 when the program you
   filtered on is one it demonstrably runs. Stars only break ties. */
function matchRepo(r: Repo, skills: Skill[]): { s: number; why: string[] } {
  let s = 0;
  const why: string[] = [];
  for (const k of skills) {
    let p = 0;
    if (k.langs.includes(r.lang)) p += 5;
    if (k.tags.some((t) => r.tags.some((x) => x.toLowerCase() === t))) p += 3;
    if (k.desc?.test(r.desc)) p += 1;
    if (p) { s += p; if (why.length < 3) why.push(k.label); }
  }
  return { s, why };
}

const OWNER_REPOS: Map<string, Repo[]> = (() => {
  const m = new Map<string, Repo[]>();
  for (const r of REPOS) {
    const k = r.repo.split("/")[0].toLowerCase();
    const a = m.get(k);
    if (a) a.push(r); else m.set(k, [r]);
  }
  return m;
})();

const nnm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* ── the live issue half ───────────────────────────────────────────── */
type LiveIssue = { url: string; repo: string; number: number; title: string; labels: string[]; lang: string | null; stars: number; updated: string; comments: number; assignees: number; beginner: boolean };
type Res = { issues?: LiveIssue[]; total?: number; meta?: { generated: string; issues: number } };
type Live = { state: "idle" | "load" | "ok" | "err"; total: number; rows: { i: LiveIssue; s: number }[]; generated: string; widened: boolean; scope: string };
const NO_LIVE: Live = { state: "idle", total: 0, rows: [], generated: "", widened: false, scope: "" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* words a chosen skill is really about: its own name plus its topics */
const wordsOf = (skills: Skill[]) => [...new Set(skills.flatMap((k) => [esc(k.label.toLowerCase()), ...k.tags.map(esc)]))];

function rankIssues(rows: LiveIssue[], words: string[], wantBeginner: boolean) {
  return rows
    .map((i) => {
      const hay = (i.title + " " + i.repo + " " + i.labels.join(" ")).toLowerCase();
      const s = words.reduce((n, w) => n + (w.length > 2 && hay.includes(w) ? 1 : 0), 0) + (wantBeginner && i.beginner ? 1 : 0);
      return { i, s };
    })
    .sort((a, b) => b.s - a.s || b.i.stars - a.i.stars || +new Date(b.i.updated) - +new Date(a.i.updated));
}

const SEL = "w-full max-w-[360px] bg-cream border border-line rounded-[10px] px-3.5 py-2.5 text-[13px] outline-none focus:border-accent/60 transition-colors placeholder:text-dim";

const Seg = ({ on, done, label, go }: { on: boolean; done: boolean; label: string; go: () => void }) => (
  <button type="button" onClick={go}
    className="group flex-1 min-w-0 text-left cursor-pointer bg-transparent border-0 p-0 font-[inherit]">
    <span className={`block h-[3px] rounded-full transition-colors ${on ? "bg-accent" : done ? "bg-accent/40" : "bg-clay"}`} />
    <span className={`block font-mono text-[9.5px] uppercase tracking-[.12em] mt-2 transition-colors ${on ? "text-accent font-bold" : "text-dim group-hover:text-cocoa"}`}>
      {label}
    </span>
  </button>
);

function Choice({ on, title, note, onClick }: { on: boolean; title: string; note: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`text-left rounded-[14px] border p-4 transition-all cursor-pointer ${on ? "border-accent/60 bg-peach shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]" : "border-line bg-cream hover:border-accent/40"}`}>
      <b className={`block text-[13.5px] font-semibold ${on ? "text-accent" : "text-ink"}`}>{title}</b>
      <span className="block text-cocoa text-[12px] leading-[1.55] mt-1">{note}</span>
    </button>
  );
}

const Why = ({ children }: { children: ReactNode }) => (
  <span className="flex flex-wrap gap-1 mt-2">{children}</span>
);
const Word = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[9px] uppercase tracking-[.09em] rounded-[6px] border border-accent/30 bg-peach px-1.5 py-px text-accent">{children}</span>
);

export function CoPilotSection({ d }: { d: Dash }) {
  const [step, setStep] = useState(0);
  const [reach, setReach] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState<Skill[]>([]);
  const [custom, setCustom] = useState("");
  const [goal, setGoal] = useState("orgs");
  const [level, setLevel] = useState("some");
  const [hours, setHours] = useState(2);
  const [program, setProgram] = useState("all");
  const [field, setField] = useState("all");
  const [orgScope, setOrgScope] = useState("");
  const [beginner, setBeginner] = useState<boolean | null>(null);
  const [minStars, setMinStars] = useState(0);
  const [rosterRows, setRosterRows] = useState<RosterOrg[]>([]);
  const rst = useRosterIndex();
  const [live, setLive] = useState<Live>(NO_LIVE);

  const catalogSkills = useMemo(() => [...ALL_SKILLS, ...extra], [extra]);
  const byId = useMemo(() => new Map(catalogSkills.map((s) => [s.id, s])), [catalogSkills]);
  const skills = useMemo(() => picked.map((p) => byId.get(p)).filter((x): x is Skill => !!x), [picked, byId]);

  useEffect(() => {
    if (program === "all") { setRosterRows([]); return; }
    let go = true;
    loadRosterOrgs(program).then((rows) => { if (go) setRosterRows(rows); });
    return () => { go = false; };
  }, [program]);

  const beginnerOn = beginner ?? level === "first";
  const showOrgs = goal === "orgs";
  const showIssues = goal === "issues";

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const addCustom = () => {
    const label = custom.trim().replace(/\s+/g, " ").slice(0, 22);
    if (!label) return;
    const id = "x-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!byId.has(id)) {
      const word = label.toLowerCase();
      setExtra((e) => [...e, { id, label, langs: [], tags: [word], desc: new RegExp(esc(word), "i") }]);
    }
    setPicked((p) => (p.includes(id) ? p : [...p, id]));
    setCustom("");
  };
  const goto = (n: number) => { setStep(n); setReach((r) => Math.max(r, n)); };

  /* ── repositories ───────────────────────────────────────────────── */
  const repoHits = useMemo(() => {
    if (!skills.length) return [];
    return REPOS
      .map((r) => ({ r, m: matchRepo(r, skills) }))
      .filter((x) => x.m.s > 0 && x.r.stars >= minStars)
      .sort((a, b) => b.m.s - a.m.s || b.r.stars - a.r.stars)
      .slice(0, 8);
  }, [skills, minStars]);

  /* ── organizations ──────────────────────────────────────────────── */
  const orgHits = useMemo(() => {
    if (!skills.length) return [];
    const rn = new Map<string, number>();
    if (program !== "all") for (const o of rosterRows) rn.set(nnm(o.name), o.n);
    return ORGS
      .map((o) => {
        const langs = skills.filter((k) => k.langs.some((l) => o.tags.includes(l)));
        const repos = (OWNER_REPOS.get(o.login.toLowerCase()) ?? []).map((r) => matchRepo(r, skills)).filter((m) => m.s > 0);
        const runs = programsOf(o.login);
        const runsIt = program !== "all" && runs.some((a) => a.id === program);
        const listed = rn.get(nnm(o.login)) ?? rn.get(nnm(o.name)) ?? 0;
        const inField = field === "all" || sectorOfOrg(o.login) === field;
        const ok = inField && (program === "all" || runsIt || listed > 0);
        const score = ok ? langs.length * 4 + Math.min(repos.length, 8) * 2 + (runsIt ? 4 : 0) + (listed ? 3 : 0) : -1;
        return { o, langs, repos: repos.length, runsIt, listed, score };
      })
      .filter((x) => x.score > 0 && x.o.stars >= minStars)
      .sort((a, b) => b.score - a.score || b.o.stars - a.o.stars)
      .slice(0, 6);
  }, [skills, rosterRows, program, field, minStars]);

  /* the same program record, read as participants rather than profiles */
  const alsoIn = useMemo(() => {
    if (program === "all" || !rosterRows.length) return [];
    const shown = new Set(orgHits.map((x) => nnm(x.o.name)).concat(orgHits.map((x) => nnm(x.o.login))));
    return rosterRows.filter((o) => !shown.has(nnm(o.name))).slice(0, 8);
  }, [rosterRows, program, orgHits]);

  /* ── live issues, straight from the crawl snapshot ──────────────── */
  const langsSel = useMemo(() => [...new Set(skills.flatMap((s) => s.langs))].slice(0, 6), [skills]);
  const words = useMemo(() => wordsOf(skills), [skills]);

  useEffect(() => {
    if (step !== 3 || !showIssues || (!langsSel.length && !skills.length)) { setLive(NO_LIVE); return; }
    let go = true;
    const ctrl = new AbortController();
    setLive((l) => ({ ...l, state: "load" }));

    const langs = langsSel.join(",");
    const kw = langsSel.length ? "" : skills[0]?.tags[0] ?? "";
    const scope = orgScope.trim().toLowerCase().replace(/^@+/, "").replace(/\/+$/, "");
    const ask = async (key: string) => {
      const p = new URLSearchParams();
      if (langs) p.set("lang", langs);
      if (key) p.set("q", key);
      if (scope) p.set("org", scope);
      if (beginnerOn) p.set("beginner", "1");
      if (level === "first") p.set("unassigned", "1");
      p.set("sort", level === "deep" ? "stars" : "updated");
      p.set("per", "40");
      const r = await fetch(`/api/issues?${p}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as Res;
    };

    (async () => {
      try {
        let j = await ask(kw);
        let widened = false;
        if (!j.issues?.length && kw) { j = await ask(""); widened = true; }
        if (!go) return;
        setLive({
          state: "ok", total: j.total ?? 0, rows: rankIssues(j.issues ?? [], words, beginnerOn).slice(0, 8),
          generated: j.meta?.generated ?? "", widened, scope: [scope ? `${scope}/*` : "", langsSel.join(" / "), kw].filter(Boolean).join(" · "),
        });
      } catch {
        if (go) setLive({ ...NO_LIVE, state: "err" });
      }
    })();
    return () => { go = false; ctrl.abort(); };
    /* the wizard only asks once per page of results, on purpose: 60
       searches a minute is the ceiling this endpoint gives one visitor */
  }, [step, showIssues, langsSel, kwKey(skills), beginnerOn, level, words, orgScope]);

  const finderHref = useMemo(() => {
    const p = new URLSearchParams();
    if (langsSel.length) p.set("lang", langsSel.join(","));
    if (orgScope.trim()) p.set("org", orgScope.trim().toLowerCase().replace(/^@+/, ""));
    if (beginnerOn) p.set("beginner", "1");
    const s = p.toString();
    return `/issues${s ? `?${s}` : ""}`;
  }, [langsSel, orgScope, beginnerOn]);

  /* the same shortlist, on the page where every organization lives */
  const directoryHref = useMemo(() => {
    const p = new URLSearchParams();
    if (field !== "all") p.set("sector", field);
    if (program !== "all") p.set("prog", program);
    const s = p.toString();
    return `/organizations${s ? `?${s}` : ""}`;
  }, [field, program]);

  const done = skills.length > 0 && (showIssues ? live.rows.length + repoHits.length > 0 : orgHits.length > 0);
  const canNext = step !== 0 || skills.length > 0;

  return (
    <Card>
      <DashHead title="Co-pilot" sub="Four steps: what you write, whether you want organizations or issues, what fits, and the answer. One question per run, and every card names the input that produced it." />

      <div className="flex gap-2.5 mt-6">
        {["Skills", "Goal", "Fit", "Results"].map((l, i) => (
          <Seg key={l} label={l} on={i === step} done={i < reach} go={() => i <= reach && goto(i)} />
        ))}
      </div>

      {/* ── 1 skills ── */}
      {step === 0 && (
        <div className="mt-6">
          <div className="flex items-baseline gap-3 flex-wrap mb-4">
            <p className="text-[13.5px] text-cocoa">Pick the languages you are comfortable in and the kind of work you want. Nothing is stored.</p>
            <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[.12em] text-accent">{skills.length} selected</span>
          </div>
          <div className="grid gap-4">
            {GROUPS.map((g) => (
              <div key={g.name}>
                <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">{g.name}</b>
                <div className="flex flex-wrap gap-1.5">
                  {g.skills.map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={on}
                        className={`font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${on ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {extra.length > 0 && (
              <div>
                <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Yours</b>
                <div className="flex flex-wrap gap-1.5">
                  {extra.map((s) => (
                    <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={picked.includes(s.id)}
                      className={`font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer flex items-center gap-1.5 ${picked.includes(s.id) ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                      {s.label}<Ic d={DP.x} size={10} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form className="flex gap-2.5 flex-wrap mt-1" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else - zig, ros, playwright"
                aria-label="Add your own skill"
                className="flex-1 min-w-[200px] bg-cream border border-line rounded-[10px] px-3.5 py-2.5 text-[13px] outline-none focus:border-accent/60 transition-colors placeholder:text-dim" />
              <button type="submit" className={btn("outline", "sm")}>Add skill</button>
            </form>
          </div>
        </div>
      )}

      {/* ── 2 goal ── */}
      {step === 1 && (
        <div className="mt-6 grid gap-6">
          <div>
            <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">What should the co-pilot bring back?</b>
            <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
              {GOALS.map(([v, t, n]) => <Choice key={v} on={goal === v} title={t} note={n} onClick={() => setGoal(v)} />)}
            </div>
          </div>
          <div>
            <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Where are you with contributions?</b>
            <div className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
              {LEVELS.map(([v, t, n]) => <Choice key={v} on={level === v} title={t} note={n} onClick={() => setLevel(v)} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── 3 fit ── */}
      {step === 2 && (
        <div className="mt-6 grid gap-6">
          {showOrgs && (
            <>
              <div>
                <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Restrict to one program</b>
                <div className="no-scrollbar flex gap-1.5 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1" role="group" aria-label="Program filter">
                  <button type="button" onClick={() => setProgram("all")} aria-pressed={program === "all"}
                    className={`shrink-0 font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${program === "all" ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                    Any program
                  </button>
                  {PROGRAMS.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProgram(p.id)} aria-pressed={program === p.id}
                      className={`shrink-0 font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${program === p.id ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="text-[12.5px] text-dim mt-2 leading-[1.6]">
                  {program === "all"
                    ? "No filter: organizations are ranked purely on the languages and repositories they match."
                    : rst.byId[program]
                      ? `The record for ${PROGRAMS.find((p) => p.id === program)?.name} names ${fmtCompact(rst.byId[program].orgs)} organizations and ${fmtCompact(rst.byId[program].projects)} ${rosterUnit(program, rst.byId[program].source)}. Only profiles we hold live GitHub numbers for get a language reason.`
                      : `${PROGRAMS.find((p) => p.id === program)?.name} publishes no participant list, so this filter can only use the organizations whose own repositories advertise it. The program page says so too.`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1">
                <div>
                  <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Field</b>
                  <select value={field} onChange={(e) => setField(e.target.value)} aria-label="Field filter" className={SEL}>
                    <option value="all">Any field ({ORGS.length} organizations)</option>
                    {SECTOR_FACETS.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.n})</option>)}
                  </select>
                  <p className="text-[12.5px] text-dim mt-2 leading-[1.6]">
                    One field per run - the same buckets the organization directory filters on, so a shortlist card and a directory
                    row mean the same work.
                  </p>
                </div>
                <div>
                  <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Organization size</b>
                  <div className="flex gap-1.5 flex-wrap">
                    {STARS.map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setMinStars(v)} aria-pressed={minStars === v}
                        className={`font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${minStars === v ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12.5px] text-dim mt-2 leading-[1.6]">
                    Stars are read from GitHub, so this is today&apos;s floor, not the archive&apos;s.
                  </p>
                </div>
              </div>
            </>
          )}

          {showIssues && (
            <>
              <div>
                <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Search inside one organization</b>
                <input value={orgScope} onChange={(e) => setOrgScope(e.target.value)} placeholder="kubernetes, google, sentry &hellip;"
                  aria-label="Limit issues to one GitHub organization" className={SEL} />
                <p className="text-[12.5px] text-dim mt-2 leading-[1.6]">
                  Optional. Left blank, the whole {fmtCompact(CRAWL.issues)}-issue snapshot is in scope. Typed in, only repositories owned by
                  that account answer - &ldquo;google&rdquo; also covers google-gemini and google-research.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1">
                <div>
                  <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Repository size</b>
                  <div className="flex gap-1.5 flex-wrap">
                    {STARS.map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setMinStars(v)} aria-pressed={minStars === v}
                        className={`font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${minStars === v ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Time you have</b>
                  <div className="flex gap-1.5 flex-wrap">
                    {HOURS.map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setHours(v)} aria-pressed={hours === v}
                        className={`font-mono text-[10.5px] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${hours === v ? "border-accent/50 bg-peach text-accent font-bold" : "border-line bg-cream text-cocoa hover:border-accent/40"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12.5px] text-dim mt-2 leading-[1.6]">Sets how many issues the shortlist keeps.</p>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={beginnerOn} onChange={(e) => setBeginner(e.target.checked)} className="mt-1 accent-[var(--color-accent)]" />
                <span>
                  <b className="block text-[13.5px] font-semibold text-ink">Only beginner-labelled issues</b>
                  <span className="block text-cocoa text-[12px] leading-[1.55] mt-0.5">
                    GitHub puts a beginner label - good first issue, help wanted, easy, starter - on {fmtCompact(CRAWL.beginnerLabelled)} of
                    the {fmtCompact(CRAWL.issues)} indexed issues. This asks for those, and for nothing anyone already holds.
                  </span>
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {/* ── 4 results ── */}
      {step === 3 && (
        <div className="mt-6 grid gap-6">
          <div className="flex items-center gap-5 flex-wrap rounded-[14px] border border-line bg-cream px-4 py-3.5">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-accent">
              {showIssues ? "Looking for issues" : "Looking for organizations"}
            </span>
            <span className="flex flex-wrap gap-1">
              {skills.map((s) => <Word key={s.id}>{s.label}</Word>)}
              {showOrgs && program !== "all" && <Word>{PROGRAMS.find((p) => p.id === program)?.name}</Word>}
              {showOrgs && field !== "all" && <Word>{field}</Word>}
              {showIssues && orgScope.trim() && <Word>{orgScope.trim()}/*</Word>}
              {showIssues && beginnerOn && <Word>beginner only</Word>}
            </span>
            <span className="ml-auto font-mono text-[10.5px] text-dim">
              {showOrgs
                ? `${orgHits.length} organizations`
                : `${live.state === "ok" ? fmtCompact(live.total) : "…"} open issues · ${repoHits.length} catalog {repoHits.length === 1 ? "repo" : "repos"}`}
            </span>
          </div>

          {!skills.length && <p className="text-[13.5px] text-dim">Go back to the first step and pick at least one skill.</p>}

          {showOrgs && skills.length > 0 && (
            <div>
              <div className="flex items-baseline gap-3 flex-wrap mb-3">
                <b className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim">
                  Organizations that match{field !== "all" ? ` in ${field}` : ""}
                </b>
                <Link to={`/organizations${directoryHref}`} className={btn("ghost", "sm", "ml-auto")}>Open in organization directory</Link>
              </div>
              {orgHits.length ? (
                <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
                  {orgHits.map(({ o, langs, repos, runsIt, listed, score }) => (
                    <div key={o.login} className="rounded-[14px] border border-line bg-cream p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <OrgImg src={avatarOf(o.login, 64)} name={o.login} className="w-[30px] h-[30px] rounded-[9px] object-cover bg-sand shrink-0" />
                        <Link to={`/organizations/${o.login}`} className="min-w-0 flex-1">
                          <b className="block text-[13.5px] font-semibold text-ink hover:text-accent transition-colors truncate">{o.name}</b>
                          <span className="block font-mono text-[9.5px] text-dim truncate">{fmtCompact(o.repos)} repos · {fmtCompact(o.stars)} stars · {fmtCompact(o.issues)} open issues</span>
                        </Link>
                        <span className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim shrink-0">{score >= 10 ? "strong" : score >= 6 ? "good" : "some"}</span>
                      </div>
                      <p className="text-cocoa text-[12px] leading-[1.55] mt-2.5 line-clamp-2">{o.tagline}</p>
                      <Why>
                        {langs.map((k) => <Word key={k.id}>{k.label}</Word>)}
                        {repos > 0 && <Word>{repos} catalog {repos === 1 ? "repo" : "repos"}</Word>}
                        {runsIt && <Word>runs {PROGRAMS.find((p) => p.id === program)?.name}</Word>}
                        {listed > 0 && <Word>{listed} listed {listed === 1 ? "project" : "projects"}</Word>}
                        {programsOf(o.login).filter((a) => a.id !== program).slice(0, 2).map((a) => <Word key={a.id}>{a.label}</Word>)}
                      </Why>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => { d.toggleSavedOrg(o.login); d.toast(d.savedOrgs.includes(o.login) ? `Unfollowed ${o.login}` : `Following ${o.login}`); }}
                          className={btn(d.savedOrgs.includes(o.login) ? "primary" : "outline", "sm")}>
                          {d.savedOrgs.includes(o.login) ? "Following" : "Follow"}
                        </button>
                        <a href={`https://github.com/${o.login}`} target="_blank" rel="noopener" className={btn("ghost", "sm")}>
                          <Ic d={DP.external} size={12} /> GitHub
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-dim">
                  None of the {ORGS.length} organization profiles we hold live GitHub numbers for match that combination
                  {program !== "all" ? " in this program" : ""}{field !== "all" ? ` in ${field}` : ""}. Take a filter off, or one skill
                  out - the directory{"'"}s own {field === "all" ? "filters" : `${field} filter`} are one click away above.
                </p>
              )}
              {alsoIn.length > 0 && (
                <div className="mt-4 rounded-[14px] border border-line bg-card p-4">
                  <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2.5">
                    Also in {PROGRAMS.find((p) => p.id === program)?.name}, from its project record
                  </b>
                  <div className="flex flex-wrap gap-1.5">
                    {alsoIn.map((o) => (
                      <a key={o.name} href={o.url || `https://github.com/search?q=${encodeURIComponent(o.name)}&type=organizations`} target="_blank" rel="noopener"
                        className="flex items-center gap-1.5 font-mono text-[10.5px] rounded-full border border-line bg-cream px-2.5 py-[6px] text-cocoa hover:border-accent/50 hover:text-accent transition-colors">
                        {o.name}<span className="text-dim">{o.n}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {showIssues && skills.length > 0 && (
            <div>
              <div className="flex items-baseline gap-3 flex-wrap mb-3">
                <b className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim">Open issues in the snapshot</b>
                {live.state === "ok" && (
                  <span className="font-mono text-[10px] text-dim ml-auto">
                    {fmtCompact(live.total)} matched{live.scope ? ` · ${live.scope}` : ""} · crawled {live.generated}
                  </span>
                )}
                {live.state === "ok" && <Link to={finderHref} className={btn("ghost", "sm")}>Open in issue finder</Link>}
              </div>
              {live.state === "load" && <p className="text-[13px] text-dim">Reading the index…</p>}
              {live.state === "err" && (
                <p className="text-[13px] text-dim">The issue index did not answer. The repositories above are unaffected - the snapshot is served from the same data the finder uses.</p>
              )}
              {live.state === "ok" && !live.rows.length && (
                <p className="text-[13px] text-dim">No open issue carries those words right now. Clear the beginner filter, or add a language instead of a topic.</p>
              )}
              {live.state === "ok" && live.widened && (
                <p className="text-[12px] text-dim mb-2">Nothing carried that skill word, so this is the wider language list.</p>
              )}
              <div className="grid gap-1">
                {live.rows.slice(0, hours === 1 ? 4 : hours === 2 ? 6 : 8).map(({ i, s }) => (
                  <div key={i.url} className="flex items-center gap-3 py-2.5 border-b border-liness last:border-0">
                    <span className="w-[18px] h-[18px] grid place-items-center rounded-[6px] shrink-0 border border-line bg-cream">
                      <Ic d={DP.issue} size={11} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <a href={i.url} target="_blank" rel="noopener" className="block text-[13px] font-semibold text-ink hover:text-accent transition-colors truncate">{i.title}</a>
                      <span className="block font-mono text-[9.5px] text-dim truncate">{i.repo} · #{i.number} · {i.lang ?? "no language"} · ★ {fmtCompact(i.stars)} · {i.comments} comments</span>
                    </span>
                    {i.beginner && <span className="font-mono text-[8.5px] rounded-[5px] border border-accent/35 bg-peach px-1.5 py-px text-accent shrink-0">first issue</span>}
                    {!i.assignees && <span className="font-mono text-[8.5px] rounded-[5px] border border-line px-1.5 py-px text-dim shrink-0 max-[640px]:hidden">open</span>}
                    <span className="font-mono text-[9px] text-dim shrink-0 max-[720px]:hidden">{s > 0 ? `${s} hit${s === 1 ? "" : "s"}` : "in scope"}</span>
                    <button type="button" onClick={() => d.trackIssue(i.url)}
                      className="shrink-0 font-mono text-[9.5px] font-bold uppercase px-2.5 py-2 rounded-[8px] border border-line bg-card text-cocoa hover:border-accent hover:text-accent transition-colors cursor-pointer">
                      {d.ledger[i.url] ? "Tracked" : "Track"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showIssues && skills.length > 0 && (
            <div>
              <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-3">Catalog repositories that ask for those skills</b>
              <div className="grid gap-2">
                {repoHits.map(({ r, m }) => {
                  const [owner, name] = r.repo.split("/");
                  const on = d.saved.includes(r.repo);
                  return (
                    <div key={r.repo} className="flex items-center gap-3 rounded-[12px] border border-line bg-cream px-3.5 py-3">
                      <OrgImg src={avatarOf(owner, 48)} name={owner} className="w-[26px] h-[26px] rounded-[7px] object-cover bg-sand shrink-0" />
                      <span className="min-w-0 flex-1">
                        <Link to={`/repo/${encodeURIComponent(r.repo)}`} className="block text-[13px] font-semibold text-ink hover:text-accent transition-colors truncate">{r.repo}</Link>
                        <span className="block font-mono text-[9.5px] text-dim truncate">{r.lang} · {r.license} · {fmtCompact(r.issues)} open issues</span>
                        <Why>{m.why.map((w) => <Word key={w}>{w}</Word>)}</Why>
                      </span>
                      <span className="font-mono text-[10.5px] font-bold text-honey shrink-0">★ {fmtCompact(r.stars)}</span>
                      <button type="button" onClick={() => d.toggleSaved(r.repo)}
                        className={btn(on ? "primary" : "outline", "sm", "shrink-0 max-[640px]:hidden")}>
                        {on ? "Following" : "Follow"}
                      </button>
                      <Link to={`/issues?q=${encodeURIComponent(name)}`} className={btn("ghost", "sm", "shrink-0 max-[640px]:hidden")}>Issues</Link>
                    </div>
                  );
                })}
                {!repoHits.length && <p className="text-[13px] text-dim">No catalog repository asks for that combination yet - try one skill at a time, or lower the star floor.</p>}
              </div>
            </div>
          )}

          <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-[1.8]">
            Languages from the catalog&apos;s own language field; topics from its GitHub topics; organization languages from what GitHub
            reports for their repositories; issues from the {fmtCompact(CRAWL.issues)}-row snapshot, labelled with the day it was crawled.
            A match is a shared word, not a promise that the maintainer wants you.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-7 pt-5 border-t border-liness">
        {step > 0 && <button type="button" onClick={() => goto(step - 1)} className={btn("outline", "sm")}>Back</button>}
        {step < 3 && (
          <button type="button" onClick={() => goto(step + 1)} disabled={!canNext}
            className={btn("primary", "sm", canNext ? "" : "opacity-40 pointer-events-none")}>
            {step === 2 ? "See the shortlist" : "Continue"} <Ic d={DP.arrow} size={13} />
          </button>
        )}
        {step === 3 && (
          <>
            <button type="button" onClick={() => goto(0)} className={btn("outline", "sm")}>Change skills</button>
            {done && <Link to="/dashboard/issues" className={btn("ghost", "sm")}>My issue ledger</Link>}
          </>
        )}
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[.1em] text-dim">
          {step < 3 ? `step ${step + 1} of 4` : `step 4 of 4${skills.length ? ` · ${skills.length} skills` : ""}`}
        </span>
      </div>
    </Card>
  );
}

/* the effect must re-run when the chosen skills change, but only then */
function kwKey(skills: Skill[]) { return skills.map((s) => s.id).join(","); }
