"use client"
/* ══ Skills.tsx — filter rail + sortable skill cards ════ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { REPOS, CATEGORIES } from "../data/repos";
import { ORGS } from "../data/orgs";
import { avatarOf, byStars, CAT_META, fmt, levelOf, LANG_COLORS } from "../lib/util";
import type { Level, Repo } from "../lib/types";
import { useStore } from "../lib/store";
import { btn, Chip, LevelChip, OrgImg, Tag, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";
const LANGS = ["TypeScript", "Python", "JavaScript", "Go", "Rust", "Shell"];
const FRAMEWORKS = ["React", "Next.js", "Django", "Flutter"];

/* ── filter groups, matched over name + description + tags ── */
type MatchGroup = { id: string; label: string; kws: string[]; not?: boolean };
const DOMAINS: MatchGroup[] = [
  { id: "writing", label: "Writing & docs", kws: ["writing", "writer", "copywrit", "blog", "documentation", "docs", "summariz", "translat", "paraphras", "essay", "content writ", "grammar", "note"] },
  { id: "design", label: "UI & design", kws: ["frontend", "front end", "design system", "figma", "css", "tailwind", "accessib", "a11y", "component", "landing", "website", "ui kit", "mockup", "ux"] },
  { id: "coding", label: "Coding", kws: ["backend", "code review", "refactor", "debug", "testing", "test generat", "code generat", "codegen", "api", "database", "programming", "pair program"] },
  { id: "data", label: "Data & analytics", kws: ["sql", "spreadsheet", "data analy", "data sci", "data visuali", "chart", "dashboard", "analytics", "pandas", "etl", "pipeline", "dataframe"] },
  { id: "devops", label: "DevOps & cloud", kws: ["devops", "ci cd", "docker", "kubernetes", "k8s", "terraform", "infra", "aws", "cloud", "deploy", "monitoring", "observab"] },
  { id: "security", label: "Security", kws: ["security", "pentest", "pen test", "vulnerab", "secret", "audit", "owasp", "threat", "malware", "guardrail"] },
  { id: "documents", label: "Documents", kws: ["pdf", "word", "powerpoint", "pptx", "docx", "xlsx", "excel", "slides", "invoice", "resume", "contract"] },
  { id: "research", label: "Research", kws: ["research", "citation", "literatur", "academic", "paper", "arxiv", "web search", "search engine", "scrap", "scholar"] },
  { id: "marketing", label: "Marketing & sales", kws: ["marketing", "seo", "sale", "sales", "lead generat", "campaign", "advertis", "social media", "newsletter", "growth"] },
  { id: "product", label: "Product & project mgmt", kws: ["project manag", "task manag", "jira", "spec ", "ticket", "roadmap", "agile", "scrum", "backlog", "planning"] },
  { id: "media", label: "Image, video & audio", kws: ["image", "video", "audio", "music", "voice", "speech", "3d", "animation", "podcast", "photo", "thumbnail"] },
  { id: "automation", label: "Productivity & automation", kws: ["automation", "workflow", "email", "calendar", "slack", "todo", "reminder", "productiv", "personal assistant", "schedul"] },
];
const TOOLS: MatchGroup[] = [
  { id: "claude", label: "Claude", kws: ["claude", "anthropic"] },
  { id: "chatgpt", label: "ChatGPT / Codex", kws: ["chatgpt", "openai", "gpt", "codex"] },
  { id: "gemini", label: "Gemini", kws: ["gemini"] },
  { id: "cursor", label: "Cursor", kws: ["cursor"] },
  { id: "copilot", label: "Copilot", kws: ["copilot"] },
  { id: "windsurf", label: "Windsurf", kws: ["windsurf"] },
  { id: "open", label: "Open models", kws: ["llama", "mistral", "deepseek", "ollama", "huggingface", "hugging face"] },
  { id: "agnostic", label: "Model-agnostic", kws: [], not: true },
];
const ALL_BRAND_KWS = TOOLS.filter((t) => !t.not).flatMap((t) => t.kws);
const KINDS: (MatchGroup & { cat?: string })[] = [
  { id: "skill", label: "Agent skill", kws: ["skill"] },
  { id: "mcp", label: "MCP server", kws: ["mcp"] },
  { id: "cursorrules", label: "Cursor rules", kws: ["cursor rule", "cursorrules"], cat: "cursor" },
  { id: "agentsmd", label: "AGENTS.md", kws: ["agents md", "agents.md", "claude md"], cat: "agentsmd" },
  { id: "prompt", label: "Prompt pack", kws: ["prompt"] },
  { id: "plugin", label: "Plugin or extension", kws: ["plugin", "extension"] },
  { id: "agent", label: "Full agent", kws: ["ai agent", "autonomous", "agentic"] },
  { id: "cli", label: "CLI tool", kws: ["cli", "command line", "terminal"] },
  { id: "lib", label: "Library or SDK", kws: ["sdk", "library"] },
];

const HAY = new Map<string, string>();
function hay(r: Repo): string {
  let h = HAY.get(r.repo);
  if (!h) {
    h = " " + `${r.repo} ${r.desc} ${r.tags.join(" ")}`.toLowerCase().replace(/[-_/]/g, " ").replace(/[^a-z0-9 .]/g, " ").replace(/\s+/g, " ") + " ";
    HAY.set(r.repo, h);
  }
  return h;
}
const inGroup = (r: Repo, g: MatchGroup): boolean =>
  g.not ? !ALL_BRAND_KWS.some((k) => hay(r).includes(" " + k)) : g.kws.some((k) => hay(r).includes(" " + k));
const inKind = (r: Repo, g: MatchGroup & { cat?: string }): boolean =>
  (g.cat !== undefined && r.cat === g.cat) || g.kws.some((k) => hay(r).includes(" " + k));

type Sort = "stars" | "forks" | "issues" | "recent" | "name" | "dl";
const SORTERS: Record<Exclude<Sort, "dl">, (a: Repo, b: Repo) => number> = {
  stars: byStars,
  forks: (a, b) => b.forks - a.forks,
  issues: (a, b) => b.issues - a.issues,
  recent: (a, b) => b.updated.localeCompare(a.updated),
  name: (a, b) => a.repo.localeCompare(b.repo),
};

function PCard({ r }: { r: Repo }) {
  const { saved, toggleSaved, toast, countDownload, downloads } = useStore();
  const on = saved.includes(r.repo);
  const owner = r.repo.split("/")[0];
  const dl = downloads[r.repo] || 0;
  return (
    <article className="bg-card border border-line rounded-[20px] p-[22px] flex flex-col gap-3 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
      <div className="flex items-center gap-3.5">
        <OrgImg src={avatarOf(owner, 88)} name={r.repo} className="w-11 h-11 rounded-[13px] object-cover bg-clay" />
        <div className="min-w-0">
          <h3 className="card-title text-[16.5px] truncate">{r.repo.split("/")[1]}</h3>
          <span className="font-mono text-[10.5px] text-dim tracking-[.05em]">{owner} · {CAT_META[r.cat]?.label ?? r.cat}</span>
        </div>
        <span className="ml-auto shrink-0"><LevelChip level={levelOf(r.stars)} /></span>
      </div>
      <div className="flex gap-[7px] flex-wrap">
        <Chip tone="stars">★ {fmt(r.stars)}</Chip>
        <Chip tone="cat">{CAT_META[r.cat]?.label?.split(" ")[0] ?? r.cat}</Chip>
        <Chip tone="lang"><i className="w-2 h-2 rounded-full shrink-0" style={{ background: LANG_COLORS[r.lang] ?? "currentColor" }} aria-hidden />{r.lang}</Chip>
        <Chip>⎇ {fmt(r.forks)}</Chip>
      </div>
      <p className="card-desc line-clamp-2">{r.desc}</p>
      <div className="flex gap-1.5 flex-wrap">{r.tags.slice(0, 4).map((t) => <Tag key={t}>{t}</Tag>)}</div>
      <div className="flex items-center gap-2.5 mt-auto pt-1.5">
        <span className="font-mono text-[10.5px] text-dim">pushed {r.updated}</span>
        <button aria-label={on ? "Unsave project" : "Save project"} onClick={() => {
          const added = toggleSaved(r.repo);
          toast(added ? `Saved ${r.repo.split("/")[1]} to your dashboard` : `Removed ${r.repo.split("/")[1]}`);
        }} className={`ml-auto w-9 h-9 cursor-pointer rounded-[11px] border grid place-items-center text-[14px] transition-all ${on ? "bg-accent border-accent text-accentfg" : "bg-cream border-line text-dim hover:border-accent hover:text-accent"}`}>
          {on ? "★" : "☆"}
        </button>
        {r.cat === "tools" ? (
          <a href={r.url} target="_blank" rel="noopener" title="Application-oriented project - opens its GitHub page"
            className={btn("primary", "sm")}>GitHub</a>
        ) : (
          <a href={`https://api.github.com/repos/${r.repo}/zipball`} title="Download the whole skill as a .zip - cyrus.ai resolves the default branch"
            onClick={() => { countDownload(r.repo); toast(`Downloading ${r.repo.split("/")[1]} .zip via cyrus.ai`); }}
            className={btn("primary", "sm")}>Download .zip{dl > 0 ? ` (${dl})` : ""}</a>
        )}
        <Link to={`/repo/${encodeURIComponent(r.repo)}`} className={btn("dark", "sm")}>Open</Link>
      </div>
    </article>
  );
}

export default function Skills() {
  const [params, setParams] = useSearchParams();
  const { downloads } = useStore();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [level, setLevel] = useState<"all" | Level>((params.get("level") as Level) ?? "all");
  const [cat, setCat] = useState(params.get("cat") ?? "all");
  const [org, setOrg] = useState(params.get("org") ?? "all");
  const [langs, setLangs] = useState<string[]>([]);
  const [fw, setFw] = useState<string[]>([]);
  const [domain, setDomain] = useState(params.get("domain") ?? "all");
  const [tool, setTool] = useState(params.get("tool") ?? "all");
  const [kind, setKind] = useState(params.get("kind") ?? "all");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) ?? "stars");
  const [shown, setShown] = useState(48);

  const write = (over: Partial<{ q: string; level: string; cat: string; org: string; domain: string; tool: string; kind: string; sort: string }>) => {
    const m = { q, level, cat, org, domain, tool, kind, sort, ...over };
    const rec: Record<string, string> = {};
    if (m.q) rec.q = m.q;
    if (m.level !== "all") rec.level = m.level;
    if (m.cat !== "all") rec.cat = m.cat;
    if (m.org !== "all") rec.org = m.org;
    if (m.domain !== "all") rec.domain = m.domain;
    if (m.tool !== "all") rec.tool = m.tool;
    if (m.kind !== "all") rec.kind = m.kind;
    if (m.sort !== "stars") rec.sort = m.sort;
    setParams(rec);
  };

  const setQUrl = (v: string) => { setQ(v); write({ q: v }); setShown(48); };
  const setLevelUrl = (v: "all" | Level) => { setLevel(v); write({ level: v }); setShown(48); };
  const setCatUrl = (v: string) => { setCat(v); write({ cat: v }); setShown(48); };
  const setOrgUrl = (v: string) => { setOrg(v); write({ org: v }); setShown(48); };
  const setSortUrl = (v: Sort) => { setSort(v); write({ sort: v }); };
  const clearAll = () => {
    setQ(""); setLevel("all"); setCat("all"); setOrg("all");
    setLangs([]); setFw([]); setDomain("all"); setTool("all"); setKind("all"); setSort("stars");
    setParams({});
    setShown(48);
  };

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setLevel((params.get("level") as Level) ?? "all");
    setCat(params.get("cat") ?? "all");
    setOrg(params.get("org") ?? "all");
    setDomain(params.get("domain") ?? "all");
    setTool(params.get("tool") ?? "all");
    setKind(params.get("kind") ?? "all");
    setSort((params.get("sort") as Sort) ?? "stars");
  }, [params]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const dg = DOMAINS.find((d) => d.id === domain);
    const tg = TOOLS.find((t) => t.id === tool);
    const kg = KINDS.find((k) => k.id === kind);
    return REPOS.filter((r) =>
      (level === "all" || levelOf(r.stars) === level) &&
      (cat === "all" || r.cat === cat) &&
      (org === "all" || r.repo.split("/")[0].toLowerCase() === org) &&
      (!langs.length || langs.includes(r.lang)) &&
      (!fw.length || fw.some((f) => hay(r).includes(" " + f.toLowerCase()))) &&
      (!dg || inGroup(r, dg)) &&
      (!tg || inGroup(r, tg)) &&
      (!kg || inKind(r, kg)) &&
      (!term || (r.repo + " " + r.desc + " " + r.tags.join(" ") + " " + r.lang).toLowerCase().includes(term))
    ).sort((a, b) => sort === "dl" ? (downloads[b.repo] || 0) - (downloads[a.repo] || 0) || byStars(a, b) : SORTERS[sort](a, b));
  }, [q, level, cat, org, langs, fw, domain, tool, kind, sort, downloads]);

  const orgLogins = useMemo(() => {
    const set = new Map<string, string>();
    ORGS.forEach((o) => set.set(o.login.toLowerCase(), o.name));
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.12)]";
  const label = "block font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2.5";
  const rchip = (on: boolean) => `text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${on ? "bg-coffee border-coffee text-foam shadow-soft" : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"}`;
  const tog = (cur: string, id: string, set: (v: string) => void, key: "domain" | "tool" | "kind") => {
    const next = cur === id ? "all" : id;
    set(next);
    write({ [key]: next });
    setShown(48);
  };

  return (
    <>
      <header className={`${W} pt-14 pb-2`}>
        <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
          <Link to="/" className="hover:text-accent">Home</Link> / <span className="text-cocoa">Skills</span>
        </p>
        <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
          GitHub skills your <Word>AI tools</Word> plug into.
        </h1>
        <p className="text-ink font-medium max-w-[640px] text-[16.5px] leading-[1.6]">
          Agent skills, Cursor rules and MCP servers for any coding agent. Hit <b>Download .zip</b> on a card,
          unzip it into your project, done. <b>{REPOS.length} repos</b> to pick from. Mentored programs live on the <Link to="/projects" className="text-accent font-semibold hover:underline">projects page</Link>.
        </p>
      </header>

      <div className={`${W} pt-9 grid grid-cols-[280px_1fr] gap-7 items-start max-[980px]:grid-cols-1`}>
        {/* ── filter rail ── */}
        <aside className="sticky top-[86px] max-[980px]:static max-h-[calc(100vh-110px)] overflow-y-auto max-[980px]:max-h-none bg-card border border-line rounded-[22px] p-[22px] shadow-soft grid gap-5">
          <div>
            <label htmlFor="skills-search" className={label}>Search</label>
            <input id="skills-search" className={fin} placeholder="name, tag, description…" value={q} onChange={(e) => setQUrl(e.target.value)} />
          </div>
          <div>
            <span className={label}>What do you want to do</span>
            <div className="flex flex-wrap gap-[7px]">
              {DOMAINS.map((d) => (
                <button key={d.id} onClick={() => tog(domain, d.id, setDomain, "domain")} className={rchip(domain === d.id)}>{d.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>Works with</span>
            <div className="flex flex-wrap gap-[7px]">
              {TOOLS.map((t) => (
                <button key={t.id} onClick={() => tog(tool, t.id, setTool, "tool")} className={rchip(tool === t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>Format</span>
            <div className="flex flex-wrap gap-[7px]">
              {KINDS.map((k) => (
                <button key={k.id} onClick={() => tog(kind, k.id, setKind, "kind")} className={rchip(kind === k.id)}>{k.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>Tech stack</span>
            <div className="flex flex-wrap gap-[7px]">
              {[...LANGS, ...FRAMEWORKS].map((l) => {
                const on = langs.includes(l) || fw.includes(l);
                return (
                  <button key={l} onClick={() => {
                    if (FRAMEWORKS.includes(l)) setFw((s) => s.includes(l) ? s.filter((x) => x !== l) : [...s, l]);
                    else setLangs((s) => s.includes(l) ? s.filter((x) => x !== l) : [...s, l]);
                    setShown(48);
                  }} className={rchip(on)}>{l}</button>
                );
              })}
            </div>
          </div>
          <div>
            <span className={label}>Difficulty</span>
            <select className={`${fin} select-warm pr-8`} value={level} onChange={(e) => setLevelUrl(e.target.value as typeof level)}>
              <option value="all">Any difficulty</option>
              <option value="beginner">Beginner · under 10k★</option>
              <option value="intermediate">Intermediate · 10–50k★</option>
              <option value="advanced">Advanced · over 50k★</option>
            </select>
          </div>
          <div>
            <span className={label}>Program / org</span>
            <select className={`${fin} select-warm pr-8`} value={org} onChange={(e) => setOrgUrl(e.target.value)}>
              <option value="all">Any organization</option>
              {orgLogins.map(([l, n]) => <option key={l} value={l}>{n}</option>)}
            </select>
          </div>
          <div>
            <span className={label}>Shelf</span>
            <select className={`${fin} select-warm pr-8`} value={cat} onChange={(e) => setCatUrl(e.target.value)}>
              <option value="all">All shelves</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <button className={btn("primary", "md", "w-full")} onClick={clearAll}>
            Reset filters
          </button>
        </aside>

        {/* ── results ── */}
        <section>
          <div className="flex items-center gap-3.5 pt-1 pb-[18px] px-0.5 flex-wrap">
            <span className="font-mono text-[12px] tracking-[.1em] uppercase text-cocoa">
              <b className="text-accent">{list.length}</b> projects found
            </span>
            <span className="ml-auto text-[12px] text-dim">Sort by</span>
            <select className={`${fin} select-warm !w-auto rounded-full pr-8 py-2 text-[13px] font-semibold`} value={sort} onChange={(e) => setSortUrl(e.target.value as Sort)}>
              <option value="stars">Most stars</option>
              <option value="dl">Most downloaded on cyrus</option>
              <option value="forks">Most forks</option>
              <option value="issues">Open issues</option>
              <option value="recent">Recently pushed</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {list.length ? (
            <>
              {/* names the results block, so the h1 -> card h3 jump a heading
                  rotor would otherwise walk straight through is now a ladder:
                  page, results, project. */}
              <h2 className="sr-only">Matching skills</h2>
              <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                {list.slice(0, shown).map((r) => <PCard key={r.repo} r={r} />)}
              </div>
              {shown < list.length && (
                <div className="flex justify-center mt-8">
                  <button className={btn("outline", "lg")} onClick={() => setShown((s) => s + 48)}>
                    Show {Math.min(48, list.length - shown)} more
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-dim border border-dashed border-line rounded-[22px] bg-cream">
              <p className="font-display text-[20px] text-cocoa mb-2">Nothing matches that combination.</p>
              <p>Loosen a filter - or the empty shelf is a hint to <Link to="/organizations" className="text-accent font-semibold hover:underline">find an org</Link> instead.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
