"use client"
/* ══ Compare.tsx — two or three projects, one column each ═══════════
   The archive lists projects; it never lines them up against each other.
   This page does the lining-up. Two rules shape it:

   1. the URL is the whole state, so a comparison can be pasted into a chat
      and reopen exactly as it was left (see src/lib/compare.ts for why each
      project travels as a repeated ?c= of its own source url);
   2. a cell only ever prints what the program's own archive publishes for
      that project. An attribute nobody states is called out as unpublished
      rather than filled with a guess, which is the same rule /projects
      follows for the difficulty badge it stopped inventing.

   The table is the desktop view and the stacked list is the mobile view of
   the same matrix - one buildMatrix() result, rendered two ways.
   ═══════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { PROGRAMS } from "../data/orgs";
import { useProjectArchives } from "../lib/programProjects";
import { fmtCompact } from "../lib/util";
import { btn, Chip, Word } from "../components/ui";
import CopyButton from "../components/CopyButton";
import {
  MAX_COMPARE,
  buildMatrix,
  compareHref,
  differingAttributes,
  isFull,
  resolveSelection,
  searchCandidates,
  selectionFromSearch,
  selectionToQuery,
  sharedAttributes,
  toggleUrl,
  type AttributeMatrixRow,
  type CompareRow,
} from "../lib/compare";

const W = "max-w-[1240px] mx-auto px-6";
const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.12)]";

/** what one attribute column tells the reader about the selection */
const KIND_LABEL: Record<AttributeMatrixRow["kind"], string> = {
  same: "Shared",
  differs: "Differs",
  unknown: "Not published",
};
const KIND_CLS: Record<AttributeMatrixRow["kind"], string> = {
  same: "text-leaf border-leaf/35 bg-leaf/7",
  differs: "text-rust border-accent/30 bg-peach",
  unknown: "text-dim border-line bg-cream",
};

function KindBadge({ kind }: { kind: AttributeMatrixRow["kind"] }) {
  return (
    <span className={`inline-block font-mono text-[9.5px] font-bold uppercase tracking-[.09em] px-2 py-[3px] rounded-md border ${KIND_CLS[kind]}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** one project's column head: what it is, where it came from, how to drop it */
function ProjectHead({ p, onRemove }: { p: CompareRow; onRemove: () => void }) {
  return (
    <div className="min-w-0">
      <p className="font-display font-bold text-[15px] leading-[1.25] line-clamp-2 text-ink">{p.title}</p>
      <p className="font-mono text-[10px] tracking-[.09em] uppercase text-dim mt-1.5 truncate">{p.org}</p>
      <div className="flex gap-1.5 flex-wrap items-center mt-2.5">
        <Chip tone="cat">{p.program}</Chip>
        {p.stars > 0 && <Chip tone="stars">★ {fmtCompact(p.stars)}</Chip>}
      </div>
      <div className="flex gap-2 items-center mt-3">
        <a href={p.url} target="_blank" rel="noreferrer noopener" className="text-[12px] font-semibold text-accent hover:text-accentd">
          Source page
        </a>
        <button type="button" onClick={onRemove} className={`${btn("ghost", "sm")} !px-2 !py-1 text-[12px]`} aria-label={`Remove ${p.title} from the comparison`}>
          Remove
        </button>
      </div>
    </div>
  );
}

/** Tailwind only sees literal class names, so the column count is looked up
    rather than interpolated - `grid-cols-${n}` would compile to nothing. */
const HEAD_COLS: Record<number, string> = {
  1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3",
};

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState("");
  /* a share link needs the absolute origin, which only exists on the client */
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const arc = useProjectArchives(PROGRAMS);
  const rows = useMemo<CompareRow[]>(() => arc.rows, [arc.rows]);

  /* every selection change rewrites the whole query: the ?c= list is the
     state, so there is no second copy of it in React to fall out of sync */
  const urls = useMemo(() => selectionFromSearch(params.toString()), [params]);
  const write = (next: string[]) => setParams(new URLSearchParams(selectionToQuery(next)));
  const pick = (url: string) => write(toggleUrl(urls, url));

  const resolved = useMemo(() => resolveSelection(rows, urls), [rows, urls]);
  const matrix = useMemo(() => buildMatrix(resolved.rows), [resolved.rows]);
  const same = sharedAttributes(matrix);
  const split = differingAttributes(matrix);
  const candidates = useMemo(() => searchCandidates(rows, term, urls, 10), [rows, term, urls]);
  const shareLink = origin ? `${origin}${compareHref(urls)}` : "";

  const nothing = urls.length === 0;
  const ageing = resolved.missing.length > 0;

  return (
    <div className={`${W} pt-14 pb-16`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span>{" "}
        <Link to="/projects" className="hover:text-accent">Projects</Link> <span className="text-accent">›</span>{" "}
        <span className="text-cocoa">Compare</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Compare <Word>Side by Side</Word>
      </h1>
      <p className="text-ink font-medium max-w-[720px] text-[16.5px] leading-[1.6]">
        Put up to {MAX_COMPARE} projects next to each other and read off where they actually differ -
        program, timeline, organisation, language, stack and mentors. Every value is the archive's own;
        nothing here is scored or inferred.
      </p>

      {/* the selection, in the order the URL carries it */}
      <section className="mt-8" aria-label="Projects in this comparison">
        <div className={`grid gap-4 grid-cols-1 ${HEAD_COLS[resolved.rows.length] ?? "md:grid-cols-1"} max-[820px]:grid-cols-1`}>
          {resolved.rows.map((p) => (
            <div key={p.url} className="bg-card border border-line rounded-[18px] p-[18px] shadow-soft">
              <ProjectHead p={p} onRemove={() => pick(p.url)} />
            </div>
          ))}
          {resolved.rows.length < MAX_COMPARE && (
            <div className="border border-dashed border-line rounded-[18px] p-[18px] flex items-center justify-center min-h-[112px]">
              <p className="text-[13px] text-dim text-center">
                {nothing ? `Add a project below to start column 1 of ${MAX_COMPARE}.` : `Add one more - ${resolved.rows.length} of ${MAX_COMPARE} chosen.`}
              </p>
            </div>
          )}
        </div>
        {ageing && (
          <p className="mt-3 text-[12.5px] text-brick leading-[1.55]" role="status">
            {resolved.missing.length} link{resolved.missing.length > 1 ? "s" : ""} in this comparison no longer
            resolve{resolved.missing.length > 1 ? " to a project" : "s to a project"} in the current archive - the
            record was refreshed since it was shared. Remove {resolved.missing.length > 1 ? "them" : "it"} and pick
            again, or the rest of the table is still accurate.
          </p>
        )}
      </section>

      {/* the reading of the table, before the table */}
      {!nothing && resolved.rows.length > 1 && (
        <section className="mt-8 bg-gradient-to-br from-clay to-peach/60 border border-line rounded-[22px] px-8 py-6 max-[700px]:px-5" aria-label="Summary">
          <h2 className="card-title-xl">Reading this comparison</h2>
          <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2 max-w-[760px]">
            {split.length ? (
              <>These {split.length} attribute{split.length > 1 ? "s" : ""} split the selection:{" "}
                {split.map((r, i) => (
                  <span key={r.id}>
                    <strong className="text-ink font-semibold">{r.label.toLowerCase()}</strong>
                    {i < split.length - 1 ? ", " : ". "}
                  </span>
                ))}
              </>
            ) : (
              <>No published attribute differs between these projects - on the record they are the same shape of work.</>
            )}
            {same.length > 0 && (
              <> They do agree on {same.length}: {same.map((r) => r.label.toLowerCase()).join(", ")}.</>
            )}
          </p>
          {matrix.some((r) => r.kind === "unknown") && (
            <p className="text-dim text-[12.5px] leading-[1.55] mt-2.5">
              Marked “not published” is not a gap in the comparison - it is a gap in what the program states per
              project. Difficulty is in that group for every archive: no program publishes it row by row.
            </p>
          )}
        </section>
      )}

      {/* the matrix: table on a wide screen, stacked on a narrow one */}
      {resolved.rows.length > 0 && (
        <section className="mt-8" aria-label="Comparison table">
          <div className="hidden md:block overflow-x-auto border border-line rounded-[18px] bg-card">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Attributes down the side, {resolved.rows.length} project{resolved.rows.length > 1 ? "s" : ""} across the top
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-20 bg-card border-b border-r border-line px-5 py-4 font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">
                    Attribute
                  </th>
                  {resolved.rows.map((p) => (
                    <th key={p.url} scope="col" className="sticky top-0 z-10 bg-card border-b border-line px-5 py-4 align-top font-normal min-w-[240px]">
                      <ProjectHead p={p} onRemove={() => pick(p.url)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.id} className={row.kind === "differs" ? "bg-peach/40" : ""}>
                    <th scope="row" className="sticky left-0 bg-card border-r border-line px-5 py-3.5 align-top">
                      <span className="block text-[13px] font-semibold text-ink">{row.label}</span>
                      <span className="mt-1.5"><KindBadge kind={row.kind} /></span>
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="px-5 py-3.5 align-top text-[13px] leading-[1.55] text-cocoa border-b border-line/60">
                        {cell ? cell : <span className="text-dim italic">not published</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* the same matrix, one block per attribute, where a table cannot fit */}
          <div className="md:hidden space-y-3">
            {matrix.map((row) => (
              <div key={row.id} className={`border border-line rounded-[16px] p-4 ${row.kind === "differs" ? "bg-peach/40" : "bg-card"}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[13px] font-semibold text-ink">{row.label}</p>
                  <KindBadge kind={row.kind} />
                </div>
                <dl className="mt-3 space-y-2.5">
                  {row.cells.map((cell, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-3 items-baseline">
                      <dt className="text-[11.5px] font-semibold text-dim truncate">{resolved.rows[i]?.title ?? ""}</dt>
                      <dd className="text-[12.5px] text-cocoa text-right">{cell ? cell : <span className="italic text-dim">not published</span>}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* share + picker */}
      <section className="mt-10 grid grid-cols-2 gap-7 items-start max-[980px]:grid-cols-1" aria-label="Build a comparison">
        <div>
          <h2 className="card-title-xl">Share this comparison</h2>
          <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2">
            The whole selection travels in the address. Copy it now and the page reopens with the same columns,
            in the same order, on any device.
          </p>
          <div className="mt-4 flex gap-2.5 items-center flex-wrap">
            <input readOnly value={shareLink} aria-label="Link to this comparison" className={`${fin} max-w-[420px] font-mono text-[12px]`} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={shareLink} label="Copy link" />
          </div>
          <div className="mt-4 flex gap-2.5 flex-wrap">
            <Link to="/projects" className={btn("outline", "md")}>Back to the archive</Link>
            {urls.length > 0 && (
              <button type="button" onClick={() => write([])} className={`${btn("ghost", "md")} cursor-pointer`}>Clear comparison</button>
            )}
          </div>
        </div>

        <div className="bg-card border border-line rounded-[22px] p-6">
          <h2 className="card-title">Add a project</h2>
          <label className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mt-4 mb-2.5" htmlFor="compare-add">
            Search the archive
          </label>
          <input id="compare-add" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="react, grafana, kernel…" className={fin} />
          {isFull(urls) && (
            <p className="text-[12px] text-honey leading-[1.5] mt-2.5" role="status">
              Already at {MAX_COMPARE}. Picking one more drops the oldest column.
            </p>
          )}
          {!arc.ready ? (
            <p className="text-[13px] text-dim mt-4">Loading the archive…</p>
          ) : candidates.length === 0 ? (
            <p className="text-[13px] text-dim mt-4">
              {term ? `No archived project matches “${term}”.` : "Every matching project is already in the comparison."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line/70 max-h-[380px] overflow-y-auto">
              {candidates.map((c) => (
                <li key={c.url}>
                  <button type="button" onClick={() => pick(c.url)} className="w-full text-left py-3 flex items-start gap-3 group hover:bg-cream/60 rounded-lg px-2 -mx-2 transition-colors">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink leading-[1.35] line-clamp-2">{c.title}</span>
                      <span className="block font-mono text-[10px] tracking-[.09em] uppercase text-dim mt-1 truncate">
                        {c.org} · {c.program}{c.lang ? ` · ${c.lang}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-accent font-bold text-[15px] leading-none mt-1" aria-hidden>+</span>
                    <span className="sr-only">Add {c.title} to the comparison</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {nothing && (
        <section className="mt-10 border border-dashed border-line rounded-[22px] px-8 py-7">
          <h2 className="card-title">Nothing chosen yet</h2>
          <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2 max-w-[680px]">
            Pick two or three projects on the right and this page becomes the comparison. The archive publishes
            a program, a round, an organisation, a language, a stack and named mentors for the rows it holds -
            that is what gets lined up, and only where a source states it.
          </p>
        </section>
      )}
    </div>
  );
}
