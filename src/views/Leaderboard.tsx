"use client";
/* ══ Leaderboard.tsx — who is actually merging ═══════════════════
   A ranked list of contributors, ordered by GitHub's own counts. The
   board is honest about two things most leaderboards are not: how the
   pool was found, and that a merge count is a measure of activity
   rather than of worth.

   The pool is a sample, so the ranking is "first among the people we
   read", not "first on GitHub". That sentence is on the page, next to
   the numbers, not buried in a footnote.

   Sort, search and the automation toggle all live in the URL, so the
   view you are looking at is a link you can send someone.
   ═══════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { BOTS, BOARD_META, LEADERS } from "../data/leaderboard";
import { CRAWL } from "../data/crawlStats";
import {
  METRICS, RANKABLE, humans, num, ordinal, rank, search, total,
} from "../lib/leaderboard";
import type { Metric, Ranked } from "../lib/leaderboard";
import { fmt } from "../lib/util";
import { btn, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";
const num_ = (n: number) => n.toLocaleString("en-US");

const isMetric = (v: string | null): v is Metric => METRICS.some((m) => m.key === v);

function Person({ r, size = 38 }: { r: Ranked; size?: number }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span className="relative shrink-0">
        <img src={r.avatar} alt="" loading="lazy" width={size} height={size}
          className="rounded-full object-cover bg-sand border border-line" style={{ width: size, height: size }} />
        {r.bot && (
          <i className="not-italic absolute -bottom-1 -right-1 font-mono text-[7.5px] uppercase tracking-[.08em] leading-none rounded-full border border-line bg-card text-dim px-[4px] py-[2px]">
            app
          </i>
        )}
      </span>
      <span className="min-w-0">
        <a href={r.html} target="_blank" rel="noopener"
          className="block font-semibold text-[14.5px] leading-tight text-ink hover:text-accent transition-colors truncate">
          {r.name || r.login}
        </a>
        <span className="flex items-center gap-1.5 flex-wrap font-mono text-[10.5px] text-dim mt-[3px]">
          <span className="truncate">@{r.login}</span>
          {r.company && <span className="truncate max-w-[150px]">· {r.company}</span>}
          {r.location && <span className="truncate max-w-[130px] hidden sm:inline">· {r.location}</span>}
        </span>
      </span>
    </span>
  );
}

/* the top three, given the space the rest of the board does not get */
function Podium({ rows }: { rows: Ranked[] }) {
  const three = rows.slice(0, 3);
  if (three.length < 3) return null;
  return (
    <div className="grid grid-cols-1 min-[520px]:grid-cols-3 gap-3 md:gap-5 mt-9">
      {three.map((r) => (
        <article key={r.login} className="frame bg-card/60 p-4 md:p-6 relative">
          <span className="mark tr" aria-hidden>+</span>
          <span className="absolute left-4 md:left-6 -top-[13px] bg-paper px-2 font-mono text-[10px] uppercase tracking-[.16em] text-accent">
            {ordinal(r.rank)}
          </span>
          <Person r={r} size={r.rank === 1 ? 46 : 38} />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-4">
            <b className="font-display font-extrabold tracking-[-.02em] leading-none text-[clamp(24px,3.4vw,38px)] text-ink">
              {num_(num(r.merged_total))}
            </b>
            <span className="font-mono text-[10px] uppercase tracking-[.1em] text-dim">merged</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 mt-3 border-t border-dashed border-line font-mono text-[10.5px]">
            {([["reviews", r.reviews_total], ["open", r.open_total], ["followers", r.followers]] as [string, number | null][]).map(([l, v]) => (
              <span key={l} className="flex items-baseline gap-1">
                <span className="text-dim">{l}</span>
                <b className="text-cocoa font-semibold">{v === null ? "n/a" : fmt(num(v))}</b>
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

const labelCls = "block font-mono text-[10px] uppercase tracking-[.14em] text-dim mb-2";

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <b className="block font-display font-extrabold text-[clamp(20px,2.4vw,28px)] tracking-[-.02em] leading-none text-accent">{v}</b>
      <span className="block font-mono text-[10px] uppercase tracking-[.1em] text-dim mt-1.5">{l}</span>
    </div>
  );
}

export default function Leaderboard() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setTerm(params.get("q") ?? ""); }, [params]);

  const metric: Metric = isMetric(params.get("by")) ? (params.get("by") as Metric) : "merged_total";
  const withBots = params.get("bots") === "1";
  const limit = Number(params.get("n") ?? 100) || 100;

  const push = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    setParams(p);
  };

  const onTerm = (v: string) => {
    setTerm(v);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => push({ q: v.trim(), n: "" }), 300);
  };

  const pool = useMemo(() => (withBots ? [...LEADERS, ...BOTS] : LEADERS), [withBots]);
  const rows = useMemo(() => rank(search(pool, params.get("q") ?? ""), metric), [pool, metric, params]);
  const shown = rows.slice(0, limit);
  const active = METRICS.find((m) => m.key === metric)!;

  const botMerged = total(BOTS, "merged_total");
  const humanMerged = total(humans([...LEADERS, ...BOTS]), "merged_total");

  return (
    <>
      <header className={`${W} pt-14 pb-3`}>
        <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
          <Link to="/" className="hover:text-accent">Home</Link> / <span className="text-cocoa">Leaderboard</span>
        </p>
        <h1 className="font-display font-extrabold tracking-[-.022em] leading-[1.07] mt-3.5 mb-3 text-[clamp(32px,4.2vw,50px)]">
          Who is <Word>actually merging</Word>.
        </h1>
        <p className="text-cocoa text-[16px] leading-[1.6] max-w-[640px]">
          {num_(BOARD_META.humans)} contributors, read off GitHub as pull requests merged since {BOARD_META.since.slice(0, 4)}.
          Every count is GitHub's own total for that author, all time, taken on {BOARD_META.crawledAt}.
        </p>
      </header>

      <div className={`${W} mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 border-y border-line py-6`}>
        <Stat v={num_(BOARD_META.humans)} l="people ranked" />
        <Stat v={fmt(humanMerged)} l="merged PRs between them" />
        <Stat v={num_(BOARD_META.bots)} l="automation accounts held back" />
        <Stat v={fmt(botMerged)} l="merges those accounts made" />
      </div>

      <div className={W}>
        <Podium rows={rows} />

        {/* ── controls ── */}
        <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-5">
          <div className="min-w-[240px]">
            <span className={labelCls}>Search</span>
            <input value={term} onChange={(e) => onTerm(e.target.value)} placeholder="name, handle, company, place…"
              aria-label="Search contributors" autoComplete="off"
              className="w-full max-w-[300px] bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent" />
          </div>

          <div>
            <span className={labelCls}>Rank by</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rank by">
              {RANKABLE.map((m) => (
                <button key={m.key} onClick={() => push({ by: m.key === "merged_total" ? "" : m.key, n: "" })}
                  aria-pressed={m.key === metric}
                  className={`font-mono text-[10.5px] uppercase tracking-[.08em] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${
                    m.key === metric ? "border-accent/45 bg-peach text-accent" : "border-line bg-card text-cocoa hover:border-accent/40"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelCls}>Show</span>
            <div className="flex gap-1.5" role="group" aria-label="How many rows">
              {[100, 200].filter((n) => n <= BOARD_META.pool).map((n) => (
                <button key={n} onClick={() => push({ n: n === 100 ? "" : String(n) })} aria-pressed={limit === n}
                  className={`font-mono text-[10.5px] uppercase tracking-[.08em] rounded-full px-3 py-[7px] border transition-colors cursor-pointer ${
                    limit === n ? "border-accent/45 bg-peach text-accent" : "border-line bg-card text-cocoa hover:border-accent/40"
                  }`}>
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none pb-[6px]">
            <input type="checkbox" checked={withBots} onChange={(e) => push({ bots: e.target.checked ? "1" : "", n: "" })}
              className="sr-only" />
            <i className={`not-italic w-[38px] h-[22px] rounded-full relative transition-colors ${withBots ? "bg-accent" : "bg-roast"}`}>
              <span className={`absolute top-[3px] w-4 h-4 rounded-full transition-all duration-200 ${withBots ? "left-[19px] bg-white" : "left-[3px] bg-steam"}`} />
            </i>
            <span className="text-[13px] text-cocoa">Include automation accounts</span>
          </label>
        </div>

        <p className="font-mono text-[10.5px] text-dim mt-4">
          {active.note} <span className="text-cocoa">{num_(rows.length)} {rows.length === 1 ? "row" : "rows"} · {num_(shown.length)} shown</span>
        </p>

        {/* ── the board ── */}
        <div className="mt-4 mb-6">
          {/* column heads: desktop only, the phone rows carry their own labels */}
          <div className="hidden md:grid grid-cols-[56px_minmax(0,1fr)_repeat(5,84px)] gap-3 items-center px-4 py-3 border-b border-line">
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">Rank</span>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">Contributor</span>
            {METRICS.map((m) => (
              <span key={m.key} className={`font-mono text-[10px] uppercase tracking-[.12em] text-right ${m.key === metric ? "text-accent" : "text-dim"}`}>
                {m.unit}
              </span>
            ))}
          </div>

          <ol>
            {shown.map((r) => (
              <li key={r.login}
                className={`grid md:grid-cols-[56px_minmax(0,1fr)_repeat(5,84px)] gap-x-3 gap-y-2 items-center px-4 py-3.5 border-b border-liness transition-colors hover:bg-clay ${
                  r.rank <= 3 ? "bg-card" : ""
                }`}>
                <span className="flex items-baseline gap-1.5 font-mono text-[13px] text-dim shrink-0">
                  <b className={`font-bold ${r.rank <= 3 ? "text-accent" : "text-cocoa"}`}>{String(r.rank).padStart(2, "0")}</b>
                </span>
                <Person r={r} />
                {METRICS.map((m) => {
                  const raw = r[m.key];
                  const isThis = m.key === metric;
                  return (
                    <span key={m.key} className="flex md:block items-baseline justify-between gap-2 md:text-right">
                      <span className="md:hidden font-mono text-[10px] uppercase tracking-[.1em] text-dim">{m.unit}</span>
                      <b className={`font-mono text-[13px] ${isThis ? "text-accent font-bold" : "text-cocoa font-semibold"}`}>
                        {raw === null ? "n/a" : fmt(num(raw))}
                      </b>
                    </span>
                  );
                })}
              </li>
            ))}
          </ol>

          {shown.length === 0 && (
            <div className="py-16 text-center">
              <p className="font-display font-bold text-[19px] mb-1.5">No one here by that name.</p>
              <p className="text-cocoa text-[14px] mb-5">The board is {num_(BOARD_META.humans)} people deep. Try a handle, a company or a place.</p>
              <button className={btn("outline", "sm")} onClick={() => { setTerm(""); push({ q: "", n: "" }); }}>Clear search</button>
            </div>
          )}

          {rows.length > shown.length && (
            <button className={`${btn("outline", "sm")} mt-5`} onClick={() => push({ n: String(Math.min(rows.length, limit + 100)) })}>
              Show {Math.min(100, rows.length - shown.length)} more
            </button>
          )}
        </div>

        {/* ── methodology, in the same frame language as the board ── */}
        <section className="frame bg-card/50 p-5 md:p-8 mb-24 mt-6">
          <span className="mark tr" aria-hidden>+</span>
          <span className="mark bl" aria-hidden>+</span>
          <h2 className="font-display font-extrabold tracking-[-.02em] text-[clamp(20px,2.6vw,28px)] mb-5">
            How this board was built
          </h2>
          <ol className="grid gap-4">
            {[
              ["The pool", `We asked GitHub for pull requests merged since ${BOARD_META.since} in ${CRAWL.languages} languages, sorted by recent activity, and counted the authors. The ${num_(BOARD_META.pool)} most-merged authors in that sample became the pool.`],
              ["The numbers", "For each author we ran three author-scoped searches - merged, open, and reviewed-by - and took GitHub's total_count. Those are exact all-time figures, not estimates and not our own tally."],
              ["The bots", `${num_(BOARD_META.bots)} of the ${num_(BOARD_META.pool)} accounts are automation: a handle ending in [bot], a handle ending in bot, or a GitHub App avatar. They are held back by default because ${fmt(botMerged)} of their merges would otherwise outrank every person on the list.`],
              ["The limit", `This is a ranking of the people we read, not of GitHub. Someone who merges a lot in languages we did not sample, or whose work landed before ${BOARD_META.since.slice(0, 4)} and stopped showing up in the recent feed, is simply not here.`],
            ].map(([t, d], i) => (
              <li key={t} className="grid md:grid-cols-[190px_minmax(0,1fr)] gap-2 md:gap-6 items-baseline">
                <span className="font-mono text-[10.5px] uppercase tracking-[.12em] text-accent">
                  {String(i + 1).padStart(2, "0")} · {t}
                </span>
                <p className="text-cocoa text-[14.5px] leading-[1.62]">{d}</p>
              </li>
            ))}
          </ol>
          <p className="text-dim text-[13px] leading-[1.6] mt-6 pt-5 border-t border-dashed border-line">
            A merge count measures activity, not quality, and it is not a score of who contributes most to the software you use.
            Use it to find people whose review you might want, not to settle an argument.
          </p>
        </section>
      </div>
    </>
  );
}
