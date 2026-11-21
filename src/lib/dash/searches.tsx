"use client"
/* == searches.tsx - the saved issue-finder searches ===============
   A row here is a question, not a list of issues: the name someone gave
   the filters they were running, and nothing else. Opening it writes those
   filters back into the finder's URL, so the results come from the crawl
   as it stands today rather than from what was on screen that evening.

   The panel is deliberately tolerant. A search saved before a filter was
   retired still lists and still opens - the filters this page has are
   applied, the rest are named on the row.
   == */
import { useState } from "react";
import { Link } from "@/lib/router";
import { btn, Chip } from "../../components/ui";
import { describeFilters, searchNameError, searchUrl } from "../savedSearches";
import type { SavedSearch } from "../savedSearches";
import { Card, Ic } from "./shell";
import { DP } from "./shared";
import type { Dash } from "./useDash";

type SearchRowProps = {
  d: Dash;
  search: SavedSearch;
  /** every outcome lands here as well as in the toast, so it is announced */
  say: (msg: string) => void;
};

function SearchRow({ d, search: s, say }: SearchRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(s.name);
  const lines = describeFilters(s.filters);

  const commit = () => {
    const err = searchNameError(draft);
    if (err) { say(err + "."); d.toast(err + "."); return; }
    if (!d.renameSearch(s.id, draft)) { say("That search could not be renamed."); return; }
    const name = draft.trim();
    setRenaming(false);
    say(`Renamed “${s.name}” to “${name}”.`);
    d.toast(`Renamed to “${name}”.`);
  };

  const remove = () => {
    d.removeSearch(s.id);
    say(`Deleted the saved search “${s.name}”.`);
    d.toast(`Deleted the saved search “${s.name}”.`);
  };

  return (
    <li className="flex items-start gap-3.5 px-4 py-3.5 rounded-[14px] bg-cream border border-liness hover:border-accent/40 transition-colors max-[700px]:flex-wrap">
      <span className="mt-0.5 w-[28px] h-[28px] grid place-items-center rounded-[9px] border border-line bg-card text-cocoa shrink-0">
        <Ic d={DP.search} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <form className="flex gap-2 flex-wrap items-center" onSubmit={(e) => { e.preventDefault(); commit(); }}>
            <label className="font-mono text-[10px] uppercase tracking-[.1em] text-dim basis-full" htmlFor={`rename-${s.id}`}>
              New name for this search
            </label>
            <input id={`rename-${s.id}`} value={draft} onChange={(e) => setDraft(e.target.value)}
              maxLength={80} autoComplete="off" aria-label={"New name for the search " + s.name}
              className="flex-1 min-w-[180px] h-[38px] px-3 rounded-[10px] bg-card border border-line text-[13.5px] outline-none focus:border-accent transition-colors" />
            <button type="submit" className={btn("primary", "sm")}>Save name</button>
            <button type="button" className={btn("outline", "sm")}
              onClick={() => { setRenaming(false); setDraft(s.name); }}>Cancel</button>
          </form>
        ) : (
          <>
            <b className="block card-title text-[14px] truncate">{s.name}</b>
            {lines.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {lines.map((l) => <Chip key={l}>{l}</Chip>)}
              </div>
            )}
            {!!s.dropped?.length && (
              <p className="text-[12px] leading-[1.5] text-honey mt-2">
                Filters this page no longer has were skipped: {s.dropped.join(", ")}. The rest still runs.
              </p>
            )}
            <span className="font-mono text-[10.5px] text-dim mt-2 block">
              {s.added ? `saved ${s.added}` : "saved on your account"}
            </span>
          </>
        )}
      </div>
      {!renaming && (
        <div className="flex items-center gap-1.5 shrink-0 max-[700px]:basis-full max-[700px]:ml-[40px]">
          <Link to={searchUrl(s.filters)} className={btn("dark", "sm")} aria-label={"Open saved search " + s.name}>
            Open
          </Link>
          <button onClick={() => setRenaming(true)} className={btn("outline", "sm")}
            aria-label={"Rename saved search " + s.name}>Rename</button>
          <button onClick={remove} className={btn("ghost", "sm") + " hover:text-brick"}
            aria-label={"Delete saved search " + s.name}>Delete</button>
        </div>
      )}
    </li>
  );
}

/** The board's list of them. Rename and delete are ordinary buttons and
 *  reopening is an ordinary link, so the panel is workable by keyboard
 *  alone, and the live region below carries every outcome to a reader. */
export function SavedSearchesPanel({ d }: { d: Dash }) {
  const [note, setNote] = useState("");
  const count = d.searches.length;
  const plural = (n: number) => (n === 1 ? "search" : "searches");

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-baseline gap-3 px-5 pt-5 pb-3 flex-wrap">
        <h2 className="panel-h-lg">Saved searches</h2>
        <p className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim">
          {count} saved {plural(count)}
        </p>
        <Link to="/issues" className={btn("outline", "sm") + " ml-auto shrink-0"}>Find a new one</Link>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{note}</p>

      {count === 0 ? (
        <div className="px-5 pb-6">
          <p className="text-[14px] font-semibold">No saved searches yet.</p>
          <p className="text-cocoa text-[13px] leading-[1.55] mt-1.5 max-w-[470px]">
            Run a search on the{" "}
            <Link to="/issues" className="text-accent font-semibold hover:underline">issue finder</Link>
            {" "}and give it a name - the words and the filters come back here, and reopening always reads
            the snapshot of the day.
          </p>
        </div>
      ) : (
        <ul className="px-5 pb-5 grid gap-2.5" aria-label="Saved issue finder searches">
          {d.searches.map((s) => <SearchRow key={s.id} d={d} search={s} say={setNote} />)}
        </ul>
      )}
    </Card>
  );
}
