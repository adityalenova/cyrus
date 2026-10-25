"use client"
/* ══ Organizations.tsx — searchable org directory + programs ═ */
import { useMemo, useState } from "react";
import Image from "next/image";
import { Link, useSearchParams } from "@/lib/router";
import { ORGS, PROGRAMS } from "../data/orgs";
import { avatarOf, byStars, fmt } from "../lib/util";
import type { Org, Program } from "../lib/types";
import { useStore } from "../lib/store";
import { btn, Chip, LevelChip, OrgImg, SectionHead, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";

/* ── page head ─────────────────────────────────────────────── */
function PageHead() {
  return (
    <header className={`${W} pt-14 pb-2`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Home</Link> / <span className="text-cocoa">Organizations</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Find your <Word>people.</Word> Then your<br />first good issue.
      </h1>
      <p className="text-ink font-medium max-w-[640px] text-[16.5px] leading-[1.6]">
        {ORGS.length} major open-source organizations, tracked live from GitHub. Every profile shows both sides -
        what they ship and the mentored programs they build, with real participation stats.
      </p>
    </header>
  );
}

/* ── featured-org rail ─────────────────────────────────────── */
function PillRail() {
  const top = useMemo(() => [...ORGS].sort(byStars).slice(0, 14), []);
  const slide = (o: Org) => (
    <Link key={o.login} to={`/organizations/${o.login}`}
      className="flex none shrink-0 inline-flex items-center gap-2.5 py-2 pl-2.5 pr-4 bg-card border border-line rounded-full text-[13px] font-semibold text-cocoa transition-all hover:border-accent hover:text-rust hover:-translate-y-0.5">
      <OrgImg src={avatarOf(o.login, 52)} name={o.login} className="w-[26px] h-[26px] rounded-full object-cover bg-clay" />
      {o.login}
      <span className="font-mono text-[10.5px] text-honey font-bold">★ {fmt(o.stars)}</span>
    </Link>
  );
  return (
    <div className="marq-mask overflow-hidden mt-6">
      <div className="marq-track animate-marq-slow">{top.map(slide)}{top.map(slide)}</div>
    </div>
  );
}

/* ── org card ──────────────────────────────────────────────── */
function OrgCard({ org }: { org: Org }) {
  const { savedOrgs, toggleSavedOrg, toast } = useStore();
  const on = savedOrgs.includes(org.login);
  return (
    <article className="group bg-card border border-line rounded-[20px] p-5 flex flex-col gap-2.5 shadow-soft transition-all duration-200 hover:-translate-y-[5px] hover:shadow-lift hover:border-accent/40">
      <div className="flex items-center gap-3">
        <OrgImg src={avatarOf(org.login, 88)} name={org.login} className="w-11 h-11 rounded-[13px] object-cover bg-clay" />
        <div className="min-w-0">
          <b className="block card-title truncate">{org.name}</b>
          <span className="font-mono text-[10.5px] text-dim">@{org.login} · {org.domain}</span>
        </div>
        <span className="ml-auto shrink-0"><LevelChip level={org.level} /></span>
      </div>
      <p className="text-cocoa text-[13px] leading-[1.6] flex-1 line-clamp-2">{org.tagline}</p>
      <div className="flex gap-1.5 flex-wrap">{org.tags.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}</div>
      <div className="flex items-center gap-2 pt-1">
        <span className="font-mono text-[11px] text-honey font-bold">★ {fmt(org.stars)}</span>
        <span className="font-mono text-[10.5px] text-dim">{org.repos} repos</span>
        <button aria-label={on ? "Unsave organization" : "Save organization"} onClick={() => {
          const added = toggleSavedOrg(org.login);
          toast(added ? `Saved ${org.login} - see your dashboard` : `Removed ${org.login}`);
        }} className={`w-[34px] h-[34px] rounded-[10px] border grid place-items-center text-[13px] transition-all ${on ? "bg-accent border-accent text-white" : "bg-cream border-line text-dim hover:border-accent hover:text-accent"}`}>
          {on ? "★" : "☆"}
        </button>
        <Link to={`/organizations/${org.login}`} className={btn("outline", "sm", "flex-1 justify-center")}>Explore</Link>
      </div>
    </article>
  );
}

/* ── programs shelf ("All programs" landing) ───────────────── */
const STATUS_CLS: Record<Program["status"], string> = {
  live: "bg-leaf/15 text-[#5d8a4f] border-[#5d8a4f]/40",
  upcoming: "bg-[#e5c07b]/20 text-[#8a6d1f] border-[#8a6d1f]/35",
  closed: "bg-clay text-cocoa border-line",
};
function ProgramCard({ p }: { p: Program }) {
  return (
    <article className="bg-card border border-line rounded-[20px] overflow-hidden flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
      <div className="relative h-40">
        <Image src={p.img} alt="" width={1200} height={800} sizes="(max-width: 768px) 100vw, 400px" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-coffee/95 via-coffee/35 to-transparent" />
        <span className={`absolute top-3.5 right-3.5 font-mono text-[10px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full border backdrop-blur-sm ${STATUS_CLS[p.status]}`}>
          {p.status}
        </span>
        <div className="absolute left-4 bottom-3.5 right-4">
          <OrgImg src={avatarOf(p.owner, 64)} name={p.owner} className="w-9 h-9 rounded-[10px] bg-white object-cover mb-2" />
          <h3 className="font-display text-white text-[17px] font-bold leading-tight">
            <Link to={`/programs/${p.id}`} className="hover:underline decoration-accent underline-offset-4">{p.name}</Link>
          </h3>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="card-desc line-clamp-2 flex-1">{p.tag}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <b className="block font-display text-[16px] text-accent">{p.pay}</b>
            <span className="font-mono text-[9.5px] tracking-[.12em] uppercase text-dim">{p.payNote}</span>
          </div>
          <span className="flex gap-2">
            <Link to={`/programs/${p.id}`} className={btn("outline", "sm")}>Details</Link>
            <a href={p.url} target="_blank" rel="noopener" className={btn("primary", "sm")}>Official</a>
          </span>
        </div>
        <div className="border-t border-liness pt-3 flex items-center justify-between font-mono text-[10.5px] text-dim">
          <span>{p.window}</span><span>{p.orgs} · {p.slots}</span>
        </div>
      </div>
    </article>
  );
}

/* ── page ──────────────────────────────────────────────────── */
export default function Organizations() {
  const [params, setParams] = useSearchParams();
  const LEVEL_VALUES = ["all", "beginner", "intermediate", "advanced"] as const;
  const rawLevel = params.get("level");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [level, setLevel] = useState<string>(
    LEVEL_VALUES.includes(rawLevel as any) ? (rawLevel as string) : "all"
  );
  const [tag, setTag] = useState(params.get("tag") ?? "all");

  const setQUrl = (v: string) => { setQ(v); setParams({ q: v }); };
  const setLevelUrl = (v: string) => { setLevel(v); setParams({ level: v }); };
  const setTagUrl = (v: string) => { setTag(v); setParams({ tag: v }); };
  const clearUrl = () => { setQ(""); setLevel("all"); setTag("all"); setParams({}); };

  const allTags = useMemo(() => {
    const c: Record<string, number> = {};
    ORGS.forEach((o) => o.tags.forEach((t) => { c[t] = (c[t] ?? 0) + 1; }));
    return Object.entries(c).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, []);

  const list = useMemo(() => ORGS.filter((o) =>
    (level === "all" || o.level === level) &&
    (tag === "all" || o.tags.includes(tag)) &&
    (!q.trim() || (o.login + " " + o.name + " " + o.tagline + " " + o.tags.join(" ")).toLowerCase().includes(q.trim().toLowerCase()))
  ).sort(byStars), [q, level, tag]);

  const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(180, 96, 44,.12)]";

  return (
    <>
      <PageHead />

      <section className={`${W} pt-6`}>
        <div className="grid grid-cols-[1fr_210px_210px] gap-3.5 max-[760px]:grid-cols-1">
          <input className={fin} placeholder="Search organizations - “google”, “ai”, “infra”…" value={q} onChange={(e) => setQUrl(e.target.value)} />
          <select className={`${fin} select-warm pr-8`} value={level} onChange={(e) => setLevelUrl(e.target.value)} aria-label="Difficulty level">
            <option value="all">Any level</option>
            <option value="beginner">Beginner-friendly</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select className={`${fin} select-warm pr-8`} value={tag} onChange={(e) => setTagUrl(e.target.value)} aria-label="Focus tag">
            <option value="all">Any focus</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <PillRail />
      </section>

      <section className={`${W} pt-10 pb-4`}>
        <p className="font-mono text-[11.5px] tracking-[.1em] uppercase text-cocoa mb-5">
          <b className="text-accent">{list.length}</b> organization{list.length === 1 ? "" : "s"} found
        </p>
        {list.length ? (
          <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[840px]:grid-cols-2 max-[540px]:grid-cols-1">
            {list.map((o) => <OrgCard key={o.login} org={o} />)}
          </div>
        ) : (
          <div className="text-center py-16 text-dim">
            No organizations match those filters. <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={clearUrl}>Clear filters</button>
          </div>
        )}
      </section>

      <section className={`${W} pt-14 pb-6`}>
        <SectionHead tag="// get mentored & paid" title={<>Open source <Word>programs</Word></>}
          sub="Contribution windows for the eight mentored open-source programs we track - stipends, dates and the orgs that join them."
          side={<span className={btn("ghost", "sm")}>Snapshot · Oct 2026</span>} />
        <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[840px]:grid-cols-2 max-[540px]:grid-cols-1">
          {PROGRAMS.map((p) => <ProgramCard key={p.id} p={p} />)}
        </div>
        <div className="flex justify-center mt-10">
          <Link to="/#timeline" className={btn("dark", "md")}>See the 12-month timeline</Link>
        </div>
      </section>
    </>
  );
}
