"use client"
/* ══ ProgramDetail.tsx — one open source program, deep ══════ */
import { useMemo } from "react";
import { Link, useParams } from "@/lib/router";
import { PROGRAMS } from "../data/orgs";
import { TOPIC_ID_OF, useRoster } from "../lib/programRoster";
import { publishesAreas, useProgramOrgs } from "../lib/contriboOrgs";
import { PROGRAM_META, PROGRAM_REPOS } from "../data/programRepos";
import type { ProgramName } from "../data/programRepos";
import { PROGRAM_DETAILS, programLink } from "../data/programDetails";
import { filterNameOf, useArchiveIndex } from "../lib/programProjects";
import { byStars, fmtCompact, avatarOf, inkOn } from "../lib/util";
import type { Program } from "../lib/types";
import { btn, Chip, OrgImg, SectionHead, Tag, Word } from "../components/ui";
import NotFound from "./NotFound";

const W = "max-w-[1240px] mx-auto px-6";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = (m: number) => MON[Math.min(11, Math.max(0, Math.floor(m)) % 12)];

/* ── 12-month phase bar ────────────────────────────────────── */
function MonthBar({ p }: { p: Program }) {
  const now = 9.1; // early October snapshot
  return (
    <div>
      <div className="relative h-10 rounded-[12px] overflow-hidden border border-line bg-cream">
        {p.phases.map((ph, i) => (
          <div key={i} title={`${ph.label} - ${mon(ph.s)} to ${mon(ph.e)}`}
            className={`absolute top-0 bottom-0 grid place-items-center transition-opacity ${ph.active ? "opacity-100" : "opacity-55"}`}
            style={{ left: `${(ph.s / 12) * 100}%`, width: `${((ph.e - ph.s) / 12) * 100}%`, background: ph.c }}>
            {/* the band colour comes from the program record, so the ink has to
                be decided against it: white on the amber season marker was
                3.8:1, and near-black is what that fill can actually carry. */}
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.08em] px-1 truncate max-w-full"
              style={{ color: inkOn(ph.c) }}>{ph.label}</span>
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-[2px] bg-coffee" style={{ left: `${(now / 12) * 100}%` }} aria-hidden />
      </div>
      <div className="grid grid-cols-12 mt-1.5">
        {MON.map((m) => (
          <span key={m} className={`font-mono text-[9.5px] text-center ${m === "Oct" ? "text-accent font-bold" : "text-dim"}`}>{m}</span>
        ))}
      </div>
      <ul className="grid gap-1.5 mt-4 list-none">
        {p.phases.map((ph, i) => (
          <li key={i} className="flex items-center gap-2.5 text-[12.5px] text-cocoa">
            <i className="w-3 h-3 rounded-[4px] shrink-0 not-italic" style={{ background: ph.c }} />
            <b className="font-semibold text-ink">{ph.label}</b>
            <span className="font-mono text-[10.5px] text-dim">{mon(ph.s)} - {mon(ph.e)}</span>
            {ph.active && <Chip tone="green">in session</Chip>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const MetaRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 py-2.5 border-b border-liness last:border-0">
    <span className="font-mono text-[9.5px] uppercase tracking-[.11em] text-dim shrink-0 pt-0.5">{k}</span>
    <b className="text-right text-[12.5px] leading-[1.5] text-ink">{v}</b>
  </div>
);

/* ── the organization directory: one compact band, the list lives on its own page ──
   This used to unroll every row of a program's record inline, which pushed the
   timeline, the mentors and the projects off the screen. The band keeps the
   invitation and points to /programs/<id>/organizations, where the same rows
   are cards with logos, sectors, technologies and filters. No counts here:
   the explorer is the place that shows them, and a number on this page would
   only be a worse version of the list behind the button.                  ═ */
function OrgDirectoryBand({ id, topicId, name }: { id: string; topicId?: string; name: string }) {
  const r = useRoster(id, topicId);
  const merged = useProgramOrgs(id);

  if (!r.ready || !merged.ready) {
    return (
      <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
        <h2 className="panel-h text-[17px]">Organizations</h2>
        <p className="text-cocoa text-[13px] mt-2">Reading the participation record...</p>
      </section>
    );
  }

  if (!merged.rows.length) {
    return (
      <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
        <h2 className="panel-h text-[17px] mb-2">Organizations in {name}</h2>
        <p className="text-cocoa text-[13px] leading-[1.65]">
          {name} publishes the people it accepted and the project each of them worked on, not a list of
          participating organizations - so there is nothing here we could show you honestly. The
          organizer's own page, linked above, is the only source for that.
        </p>
      </section>
    );
  }

  const areas = publishesAreas(id);
  const unit = areas ? "project area" : "organization";

  return (
    <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="min-w-0 max-w-[620px]">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[.14em] text-dim mb-2">Organization directory</h2>
          <h3 className="font-display font-extrabold text-[21px] tracking-[-.02em] leading-[1.15]">
            Explore the {areas ? "areas" : "organizations"} of <Word>{name}</Word>
          </h3>
          <p className="text-cocoa text-[13px] leading-[1.65] mt-2">
            Every {unit} this program's own record names, as a card with its logo, its field and the
            projects it took. Filter by year, technology and field on that page - and where a row
            carries no logo or no blurb, it shows nothing rather than inventing one.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 shrink-0 w-[212px] max-[560px]:w-full">
          <Link to={`/programs/${id}/organizations`} className={btn("primary", "md", "w-full")}>
            {areas ? "Explore the areas" : "Explore organizations"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M5 12h13m-5-6 6 6-6 6" />
            </svg>
          </Link>
          <Link to="/dashboard/matcher" className={btn("outline", "md", "w-full")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M12 3.5 13.9 8l4.6 1.6-4.6 1.6L12 15.7 10.1 11.2 5.5 9.6 10.1 8z" />
              <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
            </svg>
            AI project matcher
          </Link>
        </div>
      </div>

      {r.meta?.note && (
        <p className="text-dim text-[11px] leading-[1.6] mt-4 max-w-[860px]">
          {r.meta.note} <span className="text-dim">Source: {r.meta.source}.</span>
        </p>
      )}
    </section>
  );
}

export default function ProgramDetail() {
  const { id } = useParams();
  const p = PROGRAMS.find((x) => x.id === id);
  const d = p ? PROGRAM_DETAILS[p.id] : undefined;

  const shelfName = useMemo(() =>
    p ? (Object.keys(PROGRAM_META) as ProgramName[]).find((n) => programLink(n) === `/programs/${p.id}`) : undefined,
    [p]);
  const shelf = useMemo(() =>
    shelfName ? PROGRAM_REPOS.filter((r) => r.programs.includes(shelfName)).sort(byStars).slice(0, 6) : [],
    [shelfName]);

  /* The label /projects matches ?prog= against for this program. It is the
     archive index's own word, not the marketing name - "GSoC" rather than
     "Google Summer of Code" - because that is the string the rows carry, and a
     link built from anything else opens an empty listing. */
  const arcIdx = useArchiveIndex();
  const arcEntry = p ? arcIdx?.programs?.[p.id] : undefined;
  const toArchive = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra);
    const f = arcEntry ? filterNameOf(p!.id, arcEntry.label) : "";
    if (f) q.set("prog", f);
    const s = q.toString();
    return `/projects${s ? `?${s}` : ""}`;
  };

  if (!p || !d) return <NotFound />;
  const others = PROGRAMS.filter((x) => x.id !== p.id);

  return (
    <>
      {/* ── cover banner ── */}
      <header className="on-dark relative overflow-hidden bg-coffee">
        {p.img && <img src={p.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-75" />}
        {/* the cover has to stay readable under white text, but it was sitting at
            30% under a 95% black wash - i.e. invisible. Reveal the photo on the
            top-right and keep the shade where the words are. */}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-tr from-[#0f1012]/92 via-[#0f1012]/62 to-[#0f1012]/25" />
        <div className={`${W} py-14 relative z-[1]`}>
          <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-foam/55 mb-5">
            <Link to="/" className="hover:text-white">Home</Link> / <Link to="/programs" className="hover:text-white">Programs</Link> / <span className="text-foam/80">{p.name}</span>
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-14 h-14 rounded-[15px] overflow-hidden shrink-0 bg-white border border-white/25 shadow-soft">
              <OrgImg src={avatarOf(p.owner, 96)} name={p.owner} className="w-full h-full object-cover" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-foam/70 mb-1.5">
                Organized by <b className="text-[#eab261]">{p.owner}</b>
              </p>
              <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] text-[clamp(26px,3.4vw,40px)] text-white">{p.name}</h1>
            </div>
            <div className="ml-auto flex gap-2.5 items-center flex-wrap">
              <span className={`font-mono text-[10px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full border ${p.status === "live" ? "bg-[#3e7d4f]/25 text-[#9fd6ae] border-[#9fd6ae]/40" : p.status === "upcoming" ? "bg-[#eab261]/15 text-[#eab261] border-[#eab261]/40" : "bg-white/5 text-foam/60 border-white/20"}`}>{p.status}</span>
              <a href={p.url} target="_blank" rel="noopener" className={btn("primary", "md")}>Official website</a>
            </div>
          </div>
          <p className="text-foam/80 mt-4 max-w-[760px] text-[15.5px] leading-[1.65]">{p.tag}</p>
          <div className="flex gap-1.5 flex-wrap mt-4">
            {d.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#9fd6ae]">
                <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className={`${W} pt-9 pb-10 grid grid-cols-[1fr_310px] gap-7 items-start max-[980px]:grid-cols-1`}>
        {/* ── main column ── */}
        <div className="grid gap-7 min-w-0">
          <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
            <h2 className="font-mono text-[10.5px] tracking-[.14em] uppercase text-accent mb-3.5">About the program</h2>
            {d.about.map((para) => (
              <p key={para.slice(0, 24)} className="text-cocoa text-[14.5px] leading-[1.7] [&+p]:mt-3.5">{para}</p>
            ))}
            <div className="grid grid-cols-2 gap-5 mt-6 pt-5 border-t border-liness max-[640px]:grid-cols-1">
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[.12em] text-dim mb-2.5">Primary stack</h3>
                <div className="flex gap-1.5 flex-wrap">{d.stack.map((s) => <Chip key={s} tone="lang">{s}</Chip>)}</div>
              </div>
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[.12em] text-dim mb-2.5">Technical focus</h3>
                <div className="flex gap-1.5 flex-wrap">{d.focus.map((f) => <Tag key={f}>{f}</Tag>)}</div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-mono text-[10.5px] tracking-[.14em] uppercase text-accent mb-4">The path</h2>
            <ol className="grid gap-3 list-none">
              {d.howItWorks.map(([title, text], i) => (
                <li key={title} className="flex gap-4 bg-card border border-line rounded-[18px] p-5 shadow-soft">
                  <span className="font-display font-extrabold text-[20px] leading-none text-dim w-8 shrink-0 text-right pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <b className="panel-h block mb-1">{title}</b>
                    <p className="text-cocoa text-[13px] leading-[1.65]">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid grid-cols-2 gap-5 max-[820px]:grid-cols-1">
            <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
              <h2 className="panel-h text-[17px] mb-3.5">Who it's <Word>for</Word></h2>
              <ul className="grid gap-2.5 list-none">
                {d.whoFor.map((x) => (
                  <li key={x.slice(0, 20)} className="flex gap-2.5 text-[13px] leading-[1.6] text-cocoa">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-[8px]" />{x}
                  </li>
                ))}
              </ul>
            </section>
            <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
              <h2 className="panel-h text-[17px] mb-3.5">What you <Word>walk away with</Word></h2>
              <ul className="grid gap-2.5 list-none">
                {d.outcomes.map((x) => (
                  <li key={x.slice(0, 20)} className="flex gap-2.5 text-[13px] leading-[1.6] text-cocoa">
                    <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 mt-0.5 text-leaf" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {x}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="bg-card border border-line rounded-[20px] p-6 shadow-soft">
            <h2 className="panel-h text-[17px] mb-1">Program <Word>timeline</Word></h2>
            <p className="text-cocoa text-[12.5px] mb-5">Calendar positions for the 2026 cycle - the marker shows October, where you are now.</p>
            <MonthBar p={p} />
          </section>

          <OrgDirectoryBand id={p.id} topicId={TOPIC_ID_OF[p.id]} name={p.name} />

          {shelf.length > 0 && (            <section>
              <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
                <h2 className="font-display font-extrabold text-[22px] tracking-[-.02em]">Flagship <Word>{p.name}</Word> projects</h2>
                <Link to={toArchive()} className={btn("ghost", "sm")}>Browse all program projects</Link>
              </div>
              <div className="grid grid-cols-3 gap-4 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
                {shelf.map((r) => (
                  <Link key={r.repo} to={`/repo/${encodeURIComponent(r.repo)}`}
                    className="bg-card border border-line rounded-[18px] p-4.5 flex flex-col gap-2.5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <OrgImg src={avatarOf(r.repo.split("/")[0], 64)} name={r.repo} className="w-8 h-8 rounded-[9px] object-cover bg-clay shrink-0" />
                      <b className="card-title text-[13.5px] truncate">{r.repo.split("/")[1]}</b>
                      <span className="ml-auto font-mono text-[10.5px] text-honey font-bold shrink-0">★ {fmtCompact(r.stars)}</span>
                    </div>
                    <p className="text-cocoa text-[12px] leading-[1.55] line-clamp-2">{r.desc}</p>
                    <div className="flex gap-1.5"><Chip tone="lang">{r.lang}</Chip><Chip tone={PROGRAM_META[shelfName as ProgramName]?.tone ?? ""}>{PROGRAM_META[shelfName as ProgramName]?.label}</Chip></div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── sidebar ── */}
        <aside className="grid gap-5 max-[980px]:order-first sticky top-[86px] max-[980px]:static">
          <div className="bg-card border border-line rounded-[20px] p-5 shadow-soft">
            <h2 className="font-mono text-[10px] uppercase tracking-[.14em] text-dim mb-2">Program meta</h2>
            <MetaRow k="Stipend" v={`${p.pay} (${p.payNote.toLowerCase()})`} />
            <MetaRow k="Duration" v={d.duration} />
            <MetaRow k="Window" v={p.window} />
            <MetaRow k="Tier" v={d.tier} />
            <MetaRow k="Difficulty" v={d.difficulty} />
            <MetaRow k="Eligibility" v={d.eligibility} />
            <div className="grid gap-2.5 mt-4">
              {shelf.length > 0 && <Link to={toArchive()} className={btn("primary", "md", "w-full")}>Browse {PROGRAM_META[shelfName as ProgramName].label} projects</Link>}
              <Link to="/organizations" className={btn("outline", "md", "w-full")}>View organizations</Link>
              <a href={p.url} target="_blank" rel="noopener" className={btn("dark", "md", "w-full")}>Official website</a>
            </div>
          </div>

          <div className="bg-peach border border-accent/25 rounded-[20px] p-5">
            <h2 className="panel-h text-rust mb-1.5">Stack your seasons</h2>
            <p className="text-cocoa text-[12.5px] leading-[1.6]">
              Programs run on staggered calendars. Pair this one with a winter or spring season so your
              contribution history never idles - check the full 12-month view from the home timeline.
            </p>
            <Link to="/#timeline" className={btn("outline", "sm", "mt-3.5")}>12-month timeline</Link>
          </div>
        </aside>
      </div>

      {/* ── other programs ── */}
      <section className={`${W} pt-4 pb-16`}>
        <SectionHead tag="// keep going" title={<>More <Word>programs</Word> we track</>}
          sub={`Everything else on the calendar - ${others.length} other mentored routes from first PR to paid season.`} />
        <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
          {others.map((x) => (
            <Link key={x.id} to={`/programs/${x.id}`}
              className="group bg-card border border-line rounded-[18px] p-4 flex items-center gap-3.5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
              <OrgImg src={avatarOf(x.owner, 64)} name={x.owner} className="w-10 h-10 rounded-[11px] object-cover bg-white border border-line shrink-0" />
              <div className="min-w-0">
                <b className="font-display text-[14px] block truncate">{x.name}</b>
                <span className="font-mono text-[10px] text-dim block truncate">{x.pay} · {x.window}</span>
              </div>
              <span className="ml-auto text-dim group-hover:text-accent transition-colors font-mono text-[13px]"></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
