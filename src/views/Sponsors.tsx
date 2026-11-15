"use client"
/* ══ Sponsors.tsx — who actually has the tip jar out ═══════════
   A directory built from one verifiable fact per row: the repository
   carries a .github/FUNDING.yml, the file that makes GitHub render a
   Sponsor button. We scanned the 260 most-starred projects in the
   catalog with the GitHub contents API; what you see is what those
   repos declared. No counts of money, no tiers, nothing invented -
   just the platforms each project named and the links it published.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { avatarOf, fmtCompact } from "../lib/util";
import { btn, OrgImg, Word } from "../components/ui";

type Funded = { repo: string; stars: number; lang: string; desc: string; url: string; platforms: Record<string, string[]> };
type Payload = { crawledAt: string; scanned: number; items: Funded[] };

const W = "max-w-[1240px] mx-auto px-6";

/* display order + where each declared handle actually points.
   tidelift values are package names we cannot turn into a URL safely,
   so those chips fall back to the repository page itself. */
const PLATFORMS: { key: string; label: string; short: string; href?: (v: string) => string }[] = [
  { key: "github", label: "GitHub Sponsors", short: "GitHub", href: (v) => `https://github.com/sponsors/${v}` },
  { key: "patreon", label: "Patreon", short: "Patreon", href: (v) => `https://www.patreon.com/${v}` },
  { key: "open_collective", label: "Open Collective", short: "Open Collective", href: (v) => `https://opencollective.com/${v}` },
  { key: "ko_fi", label: "Ko-fi", short: "Ko-fi", href: (v) => `https://ko-fi.com/${v}` },
  { key: "liberapay", label: "Liberapay", short: "Liberapay", href: (v) => `https://liberapay.com/${v}` },
  { key: "tidelift", label: "Tidelift", short: "Tidelift" },
  { key: "community_bridge", label: "Community Bridge", short: "Community Bridge" },
  { key: "custom", label: "Their own page", short: "Own page" },
];
const platOf = (k: string) => PLATFORMS.find((p) => p.key === k);

/* the one link a "Sponsor" button should open: prefer GitHub, then any
   named platform, then the project's own funding page */
function primaryLink(f: Funded): { href: string; label: string } {
  for (const k of ["github", "patreon", "open_collective", "ko_fi", "liberapay"]) {
    const p = platOf(k);
    const v = f.platforms[k]?.[0];
    if (p?.href && v) return { href: p.href(v), label: p.short };
  }
  const custom = f.platforms.custom?.[0];
  if (custom) return { href: custom, label: "Fund" };
  return { href: f.url, label: "Repo" };
}

function platformHref(k: string, v: string, repo: string) {
  const p = platOf(k);
  if (k === "custom") return v;
  return p?.href ? p.href(v) : `https://github.com/${repo}`;
}

/* ── one funded project ─────────────────────────────────────── */
function FundCard({ f }: { f: Funded }) {
  const [owner] = f.repo.split("/");
  const go = primaryLink(f);
  const keys = Object.keys(f.platforms).sort((a, b) => {
    const ia = PLATFORMS.findIndex((p) => p.key === a);
    const ib = PLATFORMS.findIndex((p) => p.key === b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return (
    <article className="bg-card border border-line rounded-[18px] p-5 flex flex-col gap-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:border-accent/40">
      <div className="flex items-center gap-3 min-w-0">
        <OrgImg src={avatarOf(owner, 64)} name={owner} className="w-[38px] h-[38px] rounded-[10px] object-cover bg-sand shrink-0" />
        <span className="min-w-0 flex-1">
          <a href={f.url} target="_blank" rel="noopener" className="block font-display font-bold text-[15px] leading-tight text-ink hover:text-accent transition-colors truncate">
            {f.repo}
          </a>
          <span className="flex items-center gap-2 font-mono text-[10px] text-dim mt-[3px]">
            <span className="truncate">{f.lang}</span>
            <span className="shrink-0 text-honey font-bold">★ {fmtCompact(f.stars)}</span>
          </span>
        </span>
      </div>
      <p className="text-[12.5px] leading-[1.55] text-cocoa line-clamp-2 min-h-[2.6em]">{f.desc}</p>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((k) =>
          f.platforms[k].slice(0, 2).map((v) => (
            <a key={k + v} href={platformHref(k, v, f.repo)} target="_blank" rel="noopener"
              className="font-mono text-[9.5px] rounded-full border border-line bg-cream px-2 py-[3px] text-cocoa hover:border-accent/50 hover:text-accent transition-colors truncate max-w-[170px]">
              {platOf(k)?.short ?? k}{k !== "custom" && v ? ` · ${v}` : ""}
            </a>
          )))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line mt-auto">
        <span className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim">via {platOf(keys[0])?.short ?? "funding.yml"}</span>
        <a href={go.href} target="_blank" rel="noopener" className={btn("primary", "sm")}>
          Sponsor
          {/* the ↗ glyph sat on the text baseline and looked typed in; an SVG
              on the same optical centre as the label reads as part of the
              button, and it says "leaves the site" more clearly than ↗ does */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
      </div>
    </article>
  );
}

export default function Sponsors() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [q, setQ] = useState("");
  const [plat, setPlat] = useState("all");

  /* the router's search arrives one effect after mount - keep in sync */
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setPlat(["all", ...PLATFORMS.map((p) => p.key)].includes(params.get("plat") ?? "") ? params.get("plat")! : "all");
  }, [params]);
  const write = (over: Partial<{ q: string; plat: string }>) => {
    const m = { q, plat, ...over };
    const rec: Record<string, string> = {};
    if (m.q) rec.q = m.q;
    if (m.plat !== "all") rec.plat = m.plat;
    setParams(rec);
  };

  useEffect(() => {
    let live = true;
    fetch("/data/sponsors.json").then((r) => (r.ok ? r.json() : null)).then((d) => live && setData(d)).catch(() => live && setData({ crawledAt: "", scanned: 0, items: [] }));
    return () => { live = false; };
  }, []);

  const items = data?.items ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const p of PLATFORMS) c[p.key] = items.filter((f) => f.platforms[p.key]?.length).length;
    return c;
  }, [items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((f) =>
      (plat === "all" || f.platforms[plat]?.length) &&
      (!needle || f.repo.toLowerCase().includes(needle) || f.desc.toLowerCase().includes(needle) || f.lang.toLowerCase().includes(needle)));
  }, [items, q, plat]);

  return (
    <div className="pb-24">
      {/* ── header ─────────────────────────────────────────────── */}
      <header className="pt-[104px] max-[700px]:pt-[88px]">
        <div className={`${W} !px-6`}>
          <nav className="font-mono text-[10.5px] uppercase tracking-[.16em] text-dim flex items-center gap-2">
            <Link to="/" className="hover:text-cocoa transition-colors">Home</Link>
            <span aria-hidden>›</span>
            <span className="text-cocoa">Sponsors</span>
          </nav>
          <h1 className="font-display font-extrabold tracking-[-.03em] leading-[1.05] mt-5 text-[clamp(34px,5.2vw,58px)] max-w-[820px]">
            The projects with<br className="max-[700px]:hidden" /> a real <Word>Sponsor</Word> button.
          </h1>
          <p className="mt-4 max-w-[640px] text-[15px] leading-[1.65] text-cocoa">
            {data ? <>We read each project's <code className="font-mono text-[13.5px] text-ink">FUNDING.yml</code> and list only the ones that declare where the money goes. Every link below is the address the project published, nothing we guessed.</> : "Reading each repository's declared funding file, one by one."}
          </p>
        </div>
      </header>

      {/* ── toolbar ────────────────────────────────────────────── */}
      <div className={`${W} mt-9`}>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-[420px]">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input aria-label="Search sponsored projects" value={q} onChange={(e) => { setQ(e.target.value); write({ q: e.target.value }); }}
              placeholder="project, language, description…"
              className="w-full bg-card border border-line rounded-full pl-11 pr-4 py-3 text-[14px] text-ink placeholder:text-dim outline-none focus:border-accent/60 transition-colors" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
            {PLATFORMS.filter((p) => counts[p.key]).map((p) => (
              <button key={p.key} type="button" onClick={() => { setPlat(p.key); write({ plat: p.key }); }}
                className={`font-mono text-[10px] uppercase tracking-[.08em] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${plat === p.key ? "border-accent bg-peach text-accent font-bold" : "border-line bg-card text-cocoa hover:border-accent/40"}`}>
                {p.short}
              </button>
            ))}
            {plat !== "all" && (
              <button type="button" onClick={() => { setPlat("all"); write({ plat: "all" }); }} className="font-mono text-[10px] uppercase tracking-[.08em] text-dim hover:text-ink px-2 cursor-pointer">clear</button>
            )}
          </div>
        </div>
        <p className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim mt-4">
          <b className="text-accent">{fmtCompact(shown.length)}</b> {shown.length === 1 ? "project" : "projects"} {plat === "all" ? "with funding" : `on ${platOf(plat)?.label.toLowerCase()}`}
          {data?.crawledAt && <span className="normal-case tracking-normal"> · read from GitHub {data.crawledAt}</span>}
        </p>
      </div>

      {/* ── the directory ──────────────────────────────────────── */}
      <div className={`${W} mt-5`}>
        {shown.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {shown.map((f) => <FundCard key={f.repo} f={f} />)}
          </div>
        ) : data ? (
          <div className="frame bg-card/50 p-10 text-center relative">
            <span className="mark tr" aria-hidden>+</span>
            <p className="font-display font-bold text-[17px] text-ink">Nothing matches that yet.</p>
            <p className="text-[13.5px] text-dim mt-1.5">Clear the search{plat !== "all" ? " or the platform filter" : ""} to see all {fmtCompact(items.length)} funded projects again.</p>
            <button type="button" onClick={() => { setQ(""); setPlat("all"); write({ q: "", plat: "all" }); }} className={btn("outline", "sm", "mt-4")}>Show everything</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-[228px] rounded-[18px] border border-line bg-card/40 animate-pulse" />)}
          </div>
        )}
      </div>

      {/* ── the other way money moves ──────────────────────────── */}
      <div className={`${W} mt-14`}>
        <div className="frame relative overflow-hidden rounded-[24px] bg-gradient-to-br from-card to-cream p-7 md:p-10">
          <span className="mark tr" aria-hidden>+</span>
          <span className="mark bl" aria-hidden>+</span>
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 md:gap-12 items-start">
            <div>
              <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(21px,2.6vw,28px)] leading-tight">
                Funding is one door. A stipend is another.
              </h2>
              <p className="text-[14px] leading-[1.65] text-cocoa mt-3 max-w-[520px]">
                Sponsor buttons pay maintainers. Mentored programs pay <i className="not-italic text-ink font-semibold">you</i> - Google funds every GSoC slot, Outreachy runs on donations from people and companies, and the Linux Foundation backs LFX. {data ? <>Of the projects below, many are the same repositories those programs work in.</> : ""}
              </p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <Link to="/programs" className={btn("primary", "md")}>See who pays contributors</Link>
                <Link to="/leaderboard" className={btn("outline", "md")}>Who the PRs come from</Link>
              </div>
            </div>
            {/* where the money actually lands. Named, not counted - the filter
                rail above already answers "how many of each". */}
            <div className="md:border-l md:border-dashed md:border-line md:pl-8">
              <p className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
                Platforms these projects declare
              </p>
              <ul className="mt-3 space-y-2">
                {PLATFORMS.filter((p) => counts[p.key]).map((p) => (
                  <li key={p.key} className="flex items-center gap-2.5 text-[13px] text-cocoa">
                    <span className="h-[5px] w-[5px] rounded-full bg-accent shrink-0" aria-hidden />
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="font-mono text-[10px] leading-[1.8] text-dim mt-4 max-w-[720px]">
          Method: for the most-starred repositories in the catalog we fetched
          <code className="text-cocoa"> .github/FUNDING.yml</code> from the default branch via the GitHub contents API.
          A project appears only when that file names at least one platform; the handles shown are copied from it verbatim.
          Amounts, tiers and donor lists are not public through the API, so they are not shown here.
        </p>
      </div>
    </div>
  );
}
