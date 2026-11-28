"use client"
/* ══ ProjectCompare.tsx — the repository catalog, three columns at a time ══
   /compare answers "how do these archived program projects differ"; this
   page answers "how do these repositories differ" - stars, language, topics,
   programme stack, last push. The selection is the URL (?repos=owner/name,…),
   the table is the wide reading and the stacked cards are the narrow one of
   the same matrix. Missing is drawn as a dash and never as a zero; the legend
   says so, and the two derived rows say what they are derived from.        ═ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { Card } from "../../lib/dash/shell";
import { btn, Chip } from "../../components/ui";
import CopyButton from "../../components/CopyButton";
import { fmtCompact, useStored } from "../../lib/util";
import {
  ACTIVITY_META,
  CATALOG_AS_OF,
  MAX_REPOS,
  PROGRAM_SHELF_AS_OF,
  SAVED_STORAGE_KEY,
  buildMatrix,
  compareHref,
  differingRows,
  isFull,
  parseSavedComparisons,
  removeComparison,
  resolveFacts,
  saveComparison,
  searchRepos,
  selectionFromSearch,
  selectionToQuery,
  sharedRows,
  toggleKey,
  type MatrixRow,
  type RepoFacts,
} from "./model";

const W = "max-w-[1240px] mx-auto px-6";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const FIELD = `w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-dim outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34,197,94,.12)]`;

const KIND_LABEL: Record<MatrixRow["kind"], string> = { same: "Shared", differs: "Differs", unknown: "Not published" };
const KIND_CLS: Record<MatrixRow["kind"], string> = {
  same: "text-leaf border-leaf/35 bg-leaf/7",
  differs: "text-rust border-accent/30 bg-peach",
  unknown: "text-dim border-line bg-cream",
};

function KindBadge({ kind }: { kind: MatrixRow["kind"] }) {
  return (
    <span className={`inline-block rounded-md border px-2 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[.09em] ${KIND_CLS[kind]}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** one repository's column head: identity, where the row came from, how to drop it */
function RepoHead({ r, onRemove, index }: { r: RepoFacts; onRemove: () => void; index: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[15px] font-bold leading-[1.25] text-ink">{r.name}</p>
      <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[.09em] text-dim">{r.owner} · {r.category}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Chip tone="stars">★ {fmtCompact(r.stars)}</Chip>
        {r.programs.map((p) => <Chip key={p} tone="green">{p}</Chip>)}
        {r.lang && <Chip tone="lang">{r.lang}</Chip>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <a href={r.url} target="_blank" rel="noreferrer noopener" className={`text-[12px] font-semibold text-accent hover:text-accentd ${FOCUS}`}>
          GitHub
        </a>
        <button type="button" onClick={onRemove} className={`${btn("ghost", "sm")} !px-2 !py-1 text-[12px] ${FOCUS}`} aria-label={`Remove ${r.key} from the comparison (column ${index + 1})`}>
          Remove
        </button>
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[.08em] text-dim">Snapshot {r.snapshot}</p>
    </div>
  );
}

const HEAD_COLS: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

export default function ProjectCompare() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState("");
  const [origin, setOrigin] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pickMsg, setPickMsg] = useState<string>("");
  const [stored, setStored] = useStored<unknown[]>(SAVED_STORAGE_KEY, []);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const keys = useMemo(() => selectionFromSearch(params.toString()), [params]);
  const resolved = useMemo(() => resolveFacts(keys), [keys]);
  const rows = resolved.rows;
  const matrix = useMemo(() => buildMatrix(rows), [rows]);
  const split = differingRows(matrix);
  const same = sharedRows(matrix);
  const unknown = matrix.filter((r) => r.kind === "unknown");
  const candidates = useMemo(() => searchRepos(term, keys, 8), [term, keys]);
  const saved = useMemo(() => parseSavedComparisons(stored), [stored]);
  const shareLink = origin ? `${origin}${compareHref(keys)}` : "";
  const atCap = isFull(keys);

  const write = (next: string[]) => setParams(new URLSearchParams(selectionToQuery(next)));
  const pick = (key: string) => {
    const next = toggleKey(keys, key);
    if (next.length === keys.length && atCap && !keys.some((k) => k.toLowerCase() === key.toLowerCase())) {
      setPickMsg(`Three columns is the limit. Remove one before adding ${key}.`);
      return;
    }
    write(next);
  };
  const doSave = () => {
    const result = saveComparison(saved, saveName, rows.map((r) => r.key));
    if (!result.ok) { setSaveMsg({ kind: "err", text: result.error }); return; }
    setStored(result.list);
    setSaveName("");
    setSaveMsg({ kind: "ok", text: `Saved “${result.entry.name}” in this browser.` });
  };
  const loadSaved = (id: string) => {
    const entry = saved.find((c) => c.id === id);
    if (!entry) return;
    write(entry.repos);
    setSaveMsg({ kind: "ok", text: `Loaded “${entry.name}”.` });
  };
  const dropSaved = (id: string) => {
    setStored(removeComparison(saved, id));
    setSaveMsg({ kind: "ok", text: "Removed that saved comparison." });
  };

  return (
    <div className={`${W} pt-14 pb-20`}>
      <p className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span>{" "}
        <Link to="/projects" className="hover:text-accent">Projects</Link> <span className="text-accent">›</span>{" "}
        <span className="text-cocoa">Compare repositories</span>
      </p>
      <h1 className="mt-3.5 mb-3 font-display text-[clamp(33px,4.2vw,52px)] font-extrabold leading-[1.08] tracking-[-.02em]">
        Compare repositories
      </h1>
      <p className="max-w-[780px] text-[16.5px] font-medium leading-[1.6] text-ink">
        Put up to {MAX_REPOS} catalog repositories side by side and read where they genuinely differ - stars, forks,
        open issues, language, licence, GitHub topics, published program stack and last push. Every value is the
        snapshot&apos;s own; two rows are labelled derived, and nothing is scored by hand.
      </p>
      <p className="mt-2 max-w-[780px] text-[13px] leading-[1.6] text-cocoa">
        This is the repository catalog reading. The archived per-program project comparison - program, round,
        organisation, mentors - lives at <Link to="/compare" className="font-semibold text-accent hover:text-accentd">/compare</Link>.
      </p>

      <Card className="mt-6 reveal" style={{ animationDelay: "40ms" }}>
        <p className="eyebrow mb-2">Provenance</p>
        <p className="card-desc">
          <strong className="font-semibold text-ink">Repository catalog</strong> - <code className="font-mono text-[12px]">src/data/repos.ts</code>,
          snapshot <strong className="font-semibold text-ink">{CATALOG_AS_OF}</strong>, plus the program shelf in{" "}
          <code className="font-mono text-[12px]">src/data/programRepos.ts</code>, snapshot{" "}
          <strong className="font-semibold text-ink">{PROGRAM_SHELF_AS_OF}</strong>. Tech stack is the GitHub topics each
          row carries. Program stack is the published stack of the mentoring program(s) listing the repository, from{" "}
          <code className="font-mono text-[12px]">src/data/programDetails.ts</code>.
        </p>
        <p className="card-desc mt-2">
          Mentor names are published per program project, never per repository, so that row reads &ldquo;Not
          published&rdquo; for every repository instead of borrowing a name. Difficulty and activity are derived -
          the legend below says from what.
        </p>
      </Card>

      {/* selection */}
      <section className="mt-8" aria-label="Repositories in this comparison">
        <div className={`grid grid-cols-1 gap-4 ${HEAD_COLS[rows.length] ?? "md:grid-cols-1"} max-[820px]:grid-cols-1`}>
          {rows.map((r, i) => (
            <div key={r.key} className="rounded-[18px] border border-line bg-card p-[18px] shadow-soft">
              <RepoHead r={r} index={i} onRemove={() => write(toggleKey(keys, r.key))} />
            </div>
          ))}
          {rows.length < MAX_REPOS && (
            <div className="flex min-h-[112px] items-center justify-center rounded-[18px] border border-dashed border-line p-[18px]">
              <p className="text-center text-[13px] text-dim">
                {rows.length === 0 ? `Add a repository below to open column 1 of ${MAX_REPOS}.` : `Add one more - ${rows.length} of ${MAX_REPOS} chosen.`}
              </p>
            </div>
          )}
        </div>
        {resolved.missing.length > 0 && (
          <p className="mt-3 text-[12.5px] leading-[1.55] text-brick" role="status">
            {resolved.missing.length} key{resolved.missing.length > 1 ? "s" : ""} in this link ({resolved.missing.join(", ")}) no
            longer resolve in the catalog - the snapshot moved on. Remove {resolved.missing.length > 1 ? "them" : "it"} and
            pick again; the rest of the table is still accurate.{" "}
            <button type="button" onClick={() => write(rows.map((r) => r.key))} className={`font-semibold text-accent underline underline-offset-2 ${FOCUS}`}>
              Drop the stale key{resolved.missing.length > 1 ? "s" : ""}
            </button>
          </p>
        )}
      </section>

      {/* reading the matrix */}
      {rows.length > 1 && (
        <section className="mt-8 rounded-[22px] border border-line bg-gradient-to-br from-clay to-peach/60 px-8 py-6 max-[700px]:px-5" aria-label="Summary">
          <h2 className="card-title-xl">Reading this comparison</h2>
          <p className="mt-2 max-w-[800px] text-[13.5px] leading-[1.6] text-cocoa">
            {split.length
              ? <>{split.length} of {matrix.length} rows split the selection: <strong className="font-semibold text-ink">{split.map((r) => r.label.toLowerCase()).join(", ")}</strong>. </>
              : <>No stated row differs between these repositories. </>}
            {same.length > 0 && <>They agree on {same.length}: {same.map((r) => r.label.toLowerCase()).join(", ")}.</>}
          </p>
          {unknown.length > 0 && (
            <p className="mt-2 text-[12.5px] leading-[1.55] text-dim">
              {unknown.length} row{unknown.length > 1 ? "s are" : " is"} not published by any selected repository
              ({unknown.map((r) => r.label.toLowerCase()).join(", ")}) - an absence in the snapshot, not a zero.
            </p>
          )}
        </section>
      )}

      {/* the matrix */}
      {rows.length > 0 && (
        <section className="mt-8" aria-label="Comparison table">
          <div className="hidden overflow-x-auto rounded-[18px] border border-line bg-card md:block md:overflow-visible" tabIndex={0} role="region" aria-label="Scrollable comparison table">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Fields down the side, {rows.length} repositor{rows.length > 1 ? "ies" : "y"} across the top. A dash means not published; zero is a reported zero.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-30 border-b border-r border-line bg-card px-5 py-4 font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">
                    Field
                  </th>
                  {rows.map((r, i) => (
                    <th key={r.key} scope="col" aria-label={`Column ${i + 1}: ${r.key}`} className="sticky top-0 z-20 min-w-[230px] border-b border-line bg-card px-5 py-4 align-top font-normal">
                      <RepoHead r={r} index={i} onRemove={() => write(toggleKey(keys, r.key))} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.id} className={row.kind === "differs" ? "bg-peach/40" : ""}>
                    <th scope="row" className="sticky left-0 z-10 border-r border-b border-line/60 bg-card px-5 py-3.5 align-top">
                      <span className="block text-[13px] font-semibold text-ink">{row.label}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <KindBadge kind={row.kind} />
                        {row.derived && <span className="font-mono text-[9px] uppercase tracking-[.08em] text-dim">Derived</span>}
                      </span>
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="border-b border-line/60 px-5 py-3.5 align-top text-[12.5px] leading-[1.55] text-cocoa">
                        {cell.value === null
                          ? <span className="italic text-dim" title="Not published in this snapshot">—</span>
                          : <span className={cell.zero ? "font-mono tabular-nums" : ""}>{cell.text}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* the same matrix, one card per repository, where a table cannot fit */}
          <div className="space-y-3 md:hidden">
            {rows.map((r, ri) => (
              <div key={r.key} className="rounded-[16px] border border-line bg-card p-4">
                <RepoHead r={r} index={ri} onRemove={() => write(toggleKey(keys, r.key))} />
                <dl className="mt-4 space-y-2.5">
                  {matrix.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-t border-line/60 pt-2.5">
                      <dt className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-dim">
                        {row.label}
                        {row.kind === "differs" && <span className="font-mono text-[8.5px] uppercase tracking-[.08em] text-rust">Differs</span>}
                      </dt>
                      <dd className={`text-right text-[12.5px] ${row.cells[ri].value === null ? "italic text-dim" : "text-cocoa"}`}>
                        {row.cells[ri].value === null ? "—" : row.cells[ri].text}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* legend */}
      <section className="mt-6 grid gap-5 rounded-[18px] border border-line bg-card p-5 lg:grid-cols-3" aria-label="Legend">
        <div>
          <p className="eyebrow mb-2">Symbols</p>
          <ul className="space-y-1.5 text-[12.5px] leading-[1.55] text-cocoa">
            <li><span className="font-mono text-dim">—</span> not published in the snapshot - the field has no value for that repository.</li>
            <li><span className="font-mono text-ink">0</span> a real zero GitHub reports (for example no open issues). Never treated as missing.</li>
            <li>An italic dash is an absence; a monospaced 0 is a reported zero.</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-2">Derived rows</p>
          <ul className="space-y-1.5 text-[12.5px] leading-[1.55] text-cocoa">
            <li><strong className="font-semibold text-ink">Difficulty</strong> is the catalog&apos;s star band: over 50k advanced, over 10k intermediate, otherwise beginner. A benchmark, not an organizer claim.</li>
            <li><strong className="font-semibold text-ink">Activity</strong> is last-push age against the row&apos;s own snapshot: {ACTIVITY_META.active.days}, {ACTIVITY_META.quiet.days}, {ACTIVITY_META.dormant.days}.</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-2">Rows that will be empty</p>
          <p className="text-[12.5px] leading-[1.55] text-cocoa">
            Mentors are published per program project, not per repository, so that row is &ldquo;not published&rdquo; for every
            repository by design. Program stack is empty for repositories no tracked program lists.
          </p>
        </div>
      </section>

      {/* share, save, pick */}
      <section className="mt-10 grid grid-cols-2 items-start gap-7 max-[980px]:grid-cols-1" aria-label="Share, save and pick">
        <div className="space-y-7">
          <div>
            <h2 className="card-title-xl">Share this comparison</h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-cocoa">
              The selection travels in the address as <code className="font-mono text-[12px]">?repos=owner/name,…</code>.
              Copy it and the page reopens with the same columns in the same order.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <input readOnly value={shareLink} aria-label="Link to this comparison" className={`${FIELD} max-w-[420px] font-mono text-[12px]`} onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={shareLink} label="Copy link" />
            </div>
            {keys.length > 0 && (
              <button type="button" onClick={() => write([])} className={`mt-3 ${btn("ghost", "md")} ${FOCUS}`}>Clear comparison</button>
            )}
          </div>

          <Card>
            <h2 className="card-title">Saved comparisons</h2>
            <p className="card-desc mt-1.5">
              Kept in this browser under <code className="font-mono text-[12px]">cyrus.compare.saved.v1</code>. A saved
              comparison is a list of repository keys, not a frozen copy - it re-reads the current snapshot when loaded.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-2.5">
              <div className="min-w-[180px] flex-1">
                <label htmlFor="compare-save-name" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Name</label>
                <input id="compare-save-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Rust runtimes I am weighing" className={FIELD} />
              </div>
              <button type="button" onClick={doSave} disabled={rows.length === 0} className={`${btn("dark", "md")} disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
                Save
              </button>
            </div>
            <p className="mt-2 min-h-[18px] text-[12px] leading-[1.5]" role={saveMsg?.kind === "err" ? "alert" : "status"}>
              {saveMsg && <span className={saveMsg.kind === "err" ? "text-brick" : "text-leaf"}>{saveMsg.text}</span>}
            </p>
            {saved.length > 0 && (
              <ul className="mt-2 divide-y divide-line/70 border-t border-line">
                {saved.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[.08em] text-dim">
                        {c.repos.join(" · ")} · {c.savedAt.slice(0, 10)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => loadSaved(c.id)} className={`${btn("outline", "sm")} !px-2.5 !py-1 ${FOCUS}`} aria-label={`Load ${c.name}`}>Load</button>
                      <button type="button" onClick={() => dropSaved(c.id)} className={`${btn("ghost", "sm")} !px-2 !py-1 text-brick ${FOCUS}`} aria-label={`Delete ${c.name}`}>Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="card-title">Add a repository</h2>
          <label htmlFor="compare-add" className="mt-3 mb-2 block font-mono text-[10.5px] uppercase tracking-[.12em] text-dim">Search the catalog</label>
          <input id="compare-add" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="next.js, typescript, rust…" className={FIELD} />
          {atCap && (
            <p className="mt-2.5 text-[12px] leading-[1.5] text-honey" role="status">
              Already at {MAX_REPOS}. Remove one column before adding another.
            </p>
          )}
          {pickMsg && <p className="mt-2 text-[12px] leading-[1.5] text-brick" role="alert">{pickMsg}</p>}
          {candidates.length === 0 ? (
            <p className="mt-4 text-[13px] text-dim">
              {term ? `No catalog repository matches “${term}”.` : "Every matching repository is already in the comparison."}
            </p>
          ) : (
            <ul className="mt-4 max-h-[400px] divide-y divide-line/70 overflow-y-auto">
              {candidates.map((c) => (
                <li key={c.key}>
                  <button type="button" onClick={() => pick(c.key)} className={`group -mx-2 flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-cream/60 ${FOCUS}`} aria-label={`Add ${c.key} to the comparison`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold leading-[1.35] text-ink">{c.name}</span>
                      <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[.09em] text-dim">
                        {c.owner} · ★ {fmtCompact(c.stars)}{c.lang ? ` · ${c.lang}` : ""}{c.programs.length ? ` · ${c.programs.join("/")}` : ""}
                      </span>
                    </span>
                    <span className="mt-1 shrink-0 text-[15px] font-bold leading-none text-accent" aria-hidden>+</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {rows.length === 0 && (
        <section className="mt-10 rounded-[22px] border border-dashed border-line px-8 py-7">
          <h2 className="card-title">Nothing chosen yet</h2>
          <p className="mt-2 max-w-[700px] text-[13.5px] leading-[1.6] text-cocoa">
            Pick two or three repositories in the search box and this page becomes the comparison. The catalog carries
            stars, forks, open issues, language, licence, topics and the last push date for every row; program stack
            appears only where a tracked program lists the repository. Everything else is marked &ldquo;not
            published&rdquo; rather than guessed.
          </p>
        </section>
      )}

      <p className="mt-10 border-t border-line pt-5 font-mono text-[10px] leading-[1.7] text-dim">
        Catalogs: src/data/repos.ts (snapshot {CATALOG_AS_OF}), src/data/programRepos.ts (snapshot {PROGRAM_SHELF_AS_OF}),
        src/data/programDetails.ts, src/data/crawlStats.ts. Stars, forks and issue counts are the snapshot&apos;s, not live
        GitHub numbers. Difficulty and activity are derived as described in the legend.
      </p>
    </div>
  );
}
