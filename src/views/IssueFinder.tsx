"use client"
/* ══ IssueFinder.tsx — search the crawl, not a guess ═══════════════
   Every card here is a GitHub issue API response from the snapshot named in
   the header. The finder filters over all of it - language, organization,
   label, beginner-labelled, nobody assigned - and keeps the two things a
   contributor actually needs visible on every card: when the thread was
   last touched, and whether somebody already has it.

   The layout is the same shape as the skills page: a filter panel on the
   left, a two-column card grid on the right, and a Show-more button that
   pulls the next page of the index into the list you are already reading.
   The query lives in the URL, so a search is a link you can send someone.
   ═══════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { CRAWL } from "../data/crawlStats";
import { avatarOf, fmt, levelOf, LANG_COLORS } from "../lib/util";
import { useStore } from "../lib/store";
import { useIssueLedger, type IssueMeta } from "../lib/issueLedger";
import type { Sort } from "../lib/server/issueIndex";
import { btn, Chip, LevelChip, OrgImg, Tag, Word } from "../components/ui";

const W = "max-w-[1240px] mx-auto px-6";

/* Stars and facet counts read better rounded ("490.9k"); the issue totals
   are the claim the page is built on, so those stay exact. */
const num = (n: number) => n.toLocaleString("en-US");

type Found = {
  url: string; repo: string; number: number; title: string; labels: string[];
  lang: string | null; stars: number; updated: string; created: string;
  comments: number; assignees: number; beginner: boolean;
};
type Facet = { value: string; count: number };
type Body = {
  meta: { generated: string; issues: number; repos: number; orgs: number; languages: number };
  total: number; page: number; per: number; pages: number;
  facets: { langs: Facet[]; orgs: Facet[]; labels: Facet[] };
  issues: Found[];
};

const SORTS: [Sort, string][] = [
  ["relevance", "Best match"], ["updated", "Recently touched"], ["stars", "Biggest project"],
  ["comments", "Most discussed"], ["oldest", "Oldest first"],
];

/* how long since a thread moved, in days, from the snapshot date */
const daysSince = (iso: string, now = new Date(`${CRAWL.crawledAt}T12:00:00`)) =>
  Math.max(0, Math.floor((+now - +new Date(`${iso}T12:00:00`)) / 864e5));

const STALE_AFTER = 90;

function IssueCard({ i, onTrack, tracked }: { i: Found; onTrack: (i: Found) => void; tracked: boolean }) {
  const age = daysSince(i.updated);
  const stale = age > STALE_AFTER;
  const owner = i.repo.split("/")[0];
  return (
    <article className="bg-card border border-line rounded-[20px] p-[22px] flex flex-col gap-3 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
      <div className="flex items-center gap-3.5">
        <OrgImg src={avatarOf(owner, 88)} name={owner} className="w-11 h-11 rounded-[13px] object-cover bg-clay" />
        <div className="min-w-0">
          <h3 className="card-title text-[16.5px] truncate">{owner}</h3>
          <span className="font-mono text-[10.5px] text-dim tracking-[.05em]">
            {i.repo.split("/")[1]} · #{i.number}
          </span>
        </div>
        <span className="ml-auto shrink-0"><LevelChip level={levelOf(i.stars)} /></span>
      </div>

      <div className="flex gap-[7px] flex-wrap">
        <Chip tone="stars">★ {fmt(i.stars)}</Chip>
        {i.lang && (
          <Chip tone="lang">
            <i className="w-2 h-2 rounded-full shrink-0" style={{ background: LANG_COLORS[i.lang] ?? "currentColor" }} aria-hidden />
            {i.lang}
          </Chip>
        )}
        <Chip>{i.comments} {i.comments === 1 ? "comment" : "comments"}</Chip>
        {i.beginner && <Chip tone="green">beginner-labelled</Chip>}
      </div>

      <a href={i.url} target="_blank" rel="noopener"
        className="font-semibold text-[15.5px] leading-[1.45] text-ink hover:text-accent transition-colors line-clamp-2">
        {i.title}
      </a>

      {i.labels.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {i.labels.slice(0, 4).map((l) => <Tag key={l}>{l}</Tag>)}
          {i.labels.length > 4 && <span className="font-mono text-[9.5px] text-dim self-center">+{i.labels.length - 4}</span>}
        </div>
      )}

      <div className="flex items-center gap-2.5 mt-auto pt-1.5 flex-wrap">
        <span className="font-mono text-[10.5px] text-dim">
          touched {age === 0 ? "today" : `${age}d ago`}
          {i.assignees > 0 && <><span className="text-rule"> · </span><b className="text-honey">{i.assignees} assigned</b></>}
          {stale && <><span className="text-rule"> · </span><b className="text-brick">quiet {age}d</b></>}
        </span>
        <button onClick={() => onTrack(i)} aria-pressed={tracked}
          className={`ml-auto ${btn(tracked ? "outline" : "primary", "sm")} shrink-0`}>
          {tracked ? "On your board" : "Track it"}
        </button>
        <a href={i.url} target="_blank" rel="noopener" className={btn("dark", "sm")}>GitHub</a>
      </div>
    </article>
  );
}

export default function IssueFinder() {
  const [params, setParams] = useSearchParams();
  const { toast } = useStore();
  const { ledger, toggle } = useIssueLedger();
  const [body, setBody] = useState<Body | null>(null);
  const [rows, setRows] = useState<Found[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);
  const [appending, setAppending] = useState(false);
  const [taken, setTaken] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* the page number is deliberately not in the URL: Show more is a local
     read of one search, and a shared link should open the whole result set
     from the top rather than a page in the middle of it */
  const query = useMemo(() => {
    const p = new URLSearchParams(params);
    p.delete("page");
    return p.toString();
  }, [params]);

  const [term, setTerm] = useState(params.get("q") ?? "");

  /* the input is local so typing stays smooth; the URL catches up 300 ms
     after the last keystroke, which is also what makes a search shareable */
  const push = useCallback((next: Record<string, string>) => {
    const p = new URLSearchParams(query);
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    setParams(p);
  }, [query, setParams]);

  useEffect(() => () => { if (typing.current) clearTimeout(typing.current); }, []);
  const onTerm = (v: string) => {
    setTerm(v);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => push({ q: v.trim() }), 300);
  };

  useEffect(() => {
    let live = true;
    setStatus("loading");
    fetch(`/api/issues${query ? `?${query}` : ""}`, { headers: { accept: "application/json" } })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data: Body) => {
        if (!live) return;
        setBody(data); setRows(data.issues); setTaken(1); setStatus("ready");
      })
      .catch(() => { if (live) setStatus("error"); });
    return () => { live = false; };
  }, [query, retryCount]);

  /* keep the text box honest when the URL changes from a link or the back button */
  useEffect(() => { setTerm(params.get("q") ?? ""); }, [params]);

  const loadMore = () => {
    const next = taken + 1;
    setAppending(true);
    const qs = new URLSearchParams(query);
    qs.set("page", String(next));
    fetch(`/api/issues?${qs.toString()}`, { headers: { accept: "application/json" } })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data: Body) => {
        setRows((cur) => [...cur, ...data.issues]);
        setTaken(next);
      })
      .catch(() => toast("That page did not load. Try Show more again."))
      .finally(() => setAppending(false));
  };

  const langs = new Set((params.get("lang") ?? "").split(",").filter(Boolean));
  const org = params.get("org") ?? "";
  const label = params.get("label") ?? "";
  const beginner = params.get("beginner") === "1";
  const unassigned = params.get("unassigned") === "1";
  const sort = (params.get("sort") ?? "relevance") as Sort;

  const toggleLang = (v: string) => {
    const next = new Set(langs);
    if (next.has(v)) next.delete(v); else next.add(v);
    push({ lang: [...next].join(",") });
  };
  const anyFilter = Boolean(term || langs.size || org || label || beginner || unassigned);
  const facetOn = langs.size + (org ? 1 : 0) + (label ? 1 : 0);
  const clearAll = () => { setTerm(""); setParams(new URLSearchParams()); };

  const track = (i: Found) => {
    const meta: IssueMeta = { repo: i.repo, number: i.number, title: i.title, lang: i.lang, stars: i.stars, labels: i.labels, beginner: i.beginner, updated: i.updated };
    const on = toggle(i.url, meta);
    toast(on ? `Tracking ${i.repo} #${i.number}` : `Taken off your board: ${i.repo} #${i.number}`);
  };

  const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.12)]";
  const rchip = (on: boolean) => `text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${on ? "bg-coffee border-coffee text-foam shadow-soft" : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"}`;
  const fchip = (on: boolean) => `text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${on ? "bg-accent border-accent text-accentfg" : "bg-paper border-line text-cocoa hover:border-accent hover:text-accent"}`;
  const labelCls = "block font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2.5";

  return (
    <>
      <header className={`${W} pt-14 pb-2`}>
        <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
          <Link to="/" className="hover:text-accent">Home</Link> / <span className="text-cocoa">Issues</span>
        </p>
        <h1 className="font-display font-extrabold tracking-[-.022em] leading-[1.07] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
          Find an issue you can <Word>actually take</Word>.
        </h1>
        <p className="text-ink font-medium max-w-[640px] text-[16.5px] leading-[1.6]">
          <b>{num(CRAWL.issues)}</b> open issues read from <b>{num(CRAWL.reposWithIssues)}</b> repositories on {CRAWL.crawledAt}.
          Stale threads and ones with someone already assigned are shown, not hidden.
        </p>
      </header>

      <div className={`${W} pt-9 pb-24 grid grid-cols-[280px_1fr] gap-7 items-start max-[980px]:grid-cols-1`}>
        {/* ── filter panel ── */}
        <aside className="sticky top-[86px] max-[980px]:static max-h-[calc(100vh-110px)] overflow-y-auto max-[980px]:max-h-none bg-card border border-line rounded-[22px] p-[22px] shadow-soft grid gap-5">
          <div>
            <span className={labelCls}>Search</span>
            <input value={term} onChange={(e) => onTerm(e.target.value)} placeholder="memory leak, docs, flaky test…"
              aria-label="Search issue titles" autoComplete="off" className={fin} />
          </div>

          <div>
            <span className={labelCls}>Difficulty</span>
            <div className="flex flex-wrap gap-[7px]">
              <button className={rchip(beginner)} aria-pressed={beginner} onClick={() => push({ beginner: beginner ? "" : "1" })}>Beginner-labelled</button>
              <button className={rchip(unassigned)} aria-pressed={unassigned} onClick={() => push({ unassigned: unassigned ? "" : "1" })}>Nobody assigned</button>
            </div>
          </div>

          {/* a phone cannot carry three facet lists above the results, so the
              long half of the panel opens on demand there and stays open from
              960px up, where the panel is a column beside them. */}
          <button className={`${btn("outline", "sm")} justify-between lg:hidden`} aria-expanded={more}
            onClick={() => setMore(!more)}>
            {more ? "Fewer filters" : `More filters${facetOn ? ` (${facetOn} on)` : ""}`}
          </button>

          <div className={`grid gap-5 ${more ? "" : "max-[960px]:hidden"}`}>
            {!!body?.facets.langs.length && (
              <div>
                <span className={labelCls}>Language</span>
                <div className="flex flex-wrap gap-[7px]">
                  {body.facets.langs.map((f) => (
                    <button key={f.value} className={fchip(langs.has(f.value))} aria-pressed={langs.has(f.value)} onClick={() => toggleLang(f.value)}>
                      {f.value} <span className="font-mono text-[10px] opacity-70">{fmt(f.count)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!!body?.facets.orgs.length && (
              <div>
                <span className={labelCls}>Organization</span>
                <div className="flex flex-wrap gap-[7px]">
                  {body.facets.orgs.map((f) => (
                    <button key={f.value} className={fchip(org === f.value)} aria-pressed={org === f.value} onClick={() => push({ org: org === f.value ? "" : f.value })}>
                      {f.value} <span className="font-mono text-[10px] opacity-70">{fmt(f.count)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!!body?.facets.labels.length && (
              <div>
                <span className={labelCls}>Label</span>
                <div className="flex flex-wrap gap-[7px]">
                  {body.facets.labels.map((f) => (
                    <button key={f.value} className={fchip(label === f.value)} aria-pressed={label === f.value} onClick={() => push({ label: label === f.value ? "" : f.value })}>
                      {f.value} <span className="font-mono text-[10px] opacity-70">{fmt(f.count)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className={btn(anyFilter ? "primary" : "outline", "md", "w-full")} onClick={clearAll} disabled={!anyFilter}>
            Reset filters
          </button>
        </aside>

        {/* ── results ── */}
        <section className="min-w-0">
          <div className="flex items-center gap-3.5 pt-1 pb-[18px] px-0.5 flex-wrap">
            <span className="font-mono text-[12px] tracking-[.1em] uppercase text-cocoa">
              {status === "loading" && !body
                ? "Reading the index"
                : status === "error"
                  ? "Index unavailable"
                  : <><b className="text-accent">{num(body?.total ?? 0)}</b> issues match</>}
            </span>
            <Link to="/dashboard/issues" className="text-[12.5px] font-semibold text-cocoa border-b border-dashed border-dim pb-0.5 hover:text-accent hover:border-accent transition-colors max-[640px]:hidden">
              {Object.keys(ledger).length ? `${Object.keys(ledger).length} on your board` : "Open your board"}
            </Link>
            <span className="ml-auto text-[12px] text-dim">Sort by</span>
            <select className={`${fin} select-warm !w-auto rounded-full pr-8 py-2 text-[13px] font-semibold`}
              aria-label="Sort results" value={sort}
              onChange={(e) => push({ sort: e.target.value === "relevance" ? "" : e.target.value })}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {status === "error" && (
            <div className="rounded-[22px] border border-dashed border-rule p-10 text-center bg-cream">
              <p className="font-display text-[20px] text-cocoa mb-2">The issue index is not answering right now.</p>
              <p className="text-cocoa text-[13.5px] max-w-[420px] mx-auto">
                It is a static snapshot, so this is a delivery problem rather than a data one. Reload, or browse the{" "}
                <Link to="/organizations" className="text-accent font-semibold hover:underline">organizations</Link> while you wait.
              </p>
              <button className={`${btn("outline", "sm")} mt-5`} onClick={() => setRetryCount((c) => c + 1)}>Try again</button>
            </div>
          )}

          {status !== "error" && body && rows.length === 0 && (
            <div className="rounded-[22px] border border-dashed border-line p-10 text-center bg-cream">
              <p className="font-display text-[20px] text-cocoa mb-2">Nothing matches all of that.</p>
              <p className="text-cocoa text-[13.5px] max-w-[430px] mx-auto">
                Drop a filter or search a shorter phrase - titles are matched word by word.
                {" "}{num(CRAWL.beginnerLabelled)} issues in the snapshot carry a beginner label.
              </p>
              {anyFilter && <button className={`${btn("primary", "sm")} mt-5`} onClick={clearAll}>Clear filters</button>}
            </div>
          )}

          {status === "loading" && !body ? (
            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-[20px] border border-line bg-card/50 p-[22px] animate-pulse">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-[13px] bg-clay" />
                    <div className="h-3.5 w-[150px] rounded bg-clay" />
                  </div>
                  <div className="h-3 w-[60%] rounded bg-clay mt-4" />
                  <div className="h-4 w-[85%] rounded bg-clay mt-3" />
                  <div className="h-3 w-[40%] rounded bg-clay mt-3" />
                </div>
              ))}
            </div>
          ) : rows.length > 0 ? (
            <>
              {/* the list is a section of its own: without this heading the
                  page jumped straight from its h1 into the h3 of the first
                  card, and a reader tabbing by headings had no way to say
                  "go to the results". */}
              <h2 className="sr-only">Matching issues</h2>
              <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                {rows.map((i) => <IssueCard key={i.url} i={i} onTrack={track} tracked={Boolean(ledger[i.url])} />)}
              </div>
              <div className="flex flex-col items-center gap-2 mt-8">
                {taken < (body?.pages ?? 1) ? (
                  <>
                    <button className={btn("outline", "lg")} onClick={loadMore} disabled={appending}>
                      {appending ? "Reading the next page" : `Show ${num(Math.min(body?.per ?? 25, (body?.total ?? 0) - rows.length))} more`}
                    </button>
                    <span className="font-mono text-[10.5px] text-dim">
                      {num(rows.length)} of {num(body?.total ?? 0)} on screen
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-[10.5px] text-dim">
                    That is every match in this search - {num(body?.total ?? 0)} issues.
                  </span>
                )}
              </div>
            </>
          ) : null}

          <p className="font-mono text-[10px] text-dim mt-8 leading-[1.7]">
            Snapshot {body?.meta.generated ?? CRAWL.crawledAt} · {num(CRAWL.issues)} issues · {num(CRAWL.reposWithIssues)} repositories · {CRAWL.languages} languages.
            An issue being open here means GitHub said so on that date; check the thread before you start.
          </p>
        </section>
      </div>
    </>
  );
}
