"use client";
/* ══ EligibilityFilters.tsx — the catalog's filter panel ══════════════
   Status (the program's own calendar state) plus the two recorded
   eligibility facets. All of it is the URL: the parent owns the query, this
   component only renders controls and reports a patch.

   The panel never turns a silence into a yes. A program whose record
   publishes no student rule or no country list is shown as Unknown and
   stays in the results; only a program the record marks ineligible is
   hidden. The line under the inputs says how many of each there are.   ══ */
import { useEffect, useId, useState } from "react";
import { btn } from "@/components/ui";
import {
  COUNTRY_PARAM,
  DEFAULT_QUERY,
  STATUS_OPTIONS,
  STUDENT_OPTIONS,
  countryListCount,
  facetsActive,
  type CatalogCounts,
  type CatalogQuery,
} from "./model";

export default function EligibilityFilters({
  query,
  counts,
  onChange,
}: {
  query: CatalogQuery;
  counts: CatalogCounts;
  onChange: (patch: Partial<CatalogQuery>) => void;
}) {
  const studentId = useId();
  const countryId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(query.country ?? "");
  const noCountryLists = countryListCount() === 0;

  /* a Clear or a back-button navigation can change the query underneath the
     input; the draft follows it so the box never shows a stale code */
  useEffect(() => { setDraft(query.country ?? ""); }, [query.country]);

  const onCountry = (raw: string) => {
    const letters = raw.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
    setDraft(letters);
    if (letters.length === 0) onChange({ country: null });
    else if (letters.length === 2) onChange({ country: letters });
  };

  const filtered = query.status !== "all" || facetsActive(query);
  const announcement = facetsActive(query)
    ? [
        `${counts.shown} ${counts.shown === 1 ? "program" : "programs"} shown`,
        `${counts.eligible} eligible`,
        `${counts.unknown} unknown`,
        `${counts.ineligible} marked ineligible and hidden`,
      ].join(" · ")
    : `${counts.shown} ${counts.shown === 1 ? "program" : "programs"} shown · no eligibility filter applied`;

  return (
    <section className="mt-7 rounded-[18px] border border-line bg-card p-5 shadow-soft" aria-labelledby="eligibility-filters-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Eligibility filters</p>
          <h2 id="eligibility-filters-heading" className="panel-h-lg mt-1.5">Narrow by what the record publishes</h2>
          <p className="card-desc mt-1.5 max-w-[600px]">
            Student status and residency are read only from each program's published eligibility sentence.
            A question the record does not answer is marked Unknown, not answered for it.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter programs by calendar status">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={query.status === o.value}
              onClick={() => onChange({ status: o.value })}
              className={`font-mono text-[10.5px] font-bold uppercase tracking-[.1em] px-3.5 py-2 rounded-full border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                query.status === o.value
                  ? "bg-coffee text-foam border-coffee"
                  : "bg-card text-cocoa border-line hover:border-accent/50 hover:text-accent"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 max-w-[700px]">
        <div className="grid gap-1.5">
          <label htmlFor={studentId} className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
            Student status
          </label>
          <select
            id={studentId}
            value={query.student}
            onChange={(e) => onChange({ student: e.target.value as CatalogQuery["student"] })}
            className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {STUDENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={countryId} className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
            Country code (ISO alpha-2)
          </label>
          <input
            id={countryId}
            value={draft}
            onChange={(e) => onCountry(e.target.value)}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            placeholder="e.g. IN"
            aria-describedby={hintId}
            className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </div>

      <p id={hintId} className="text-dim text-[11.5px] leading-[1.6] mt-3 max-w-[700px]">
        {noCountryLists
          ? "No tracked program publishes a country list. A two-letter code will mark every program Unknown rather than assume it is open to that country."
          : "A program is only marked eligible for a country when its record publishes a list that includes it."}
        {" "}The country input is sent as <code className="font-mono text-[11px]">{COUNTRY_PARAM}</code> in the URL, like the other filters.
      </p>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-liness">
        <p role="status" aria-live="polite" className="font-mono text-[10.5px] uppercase tracking-[.09em] text-dim">
          {announcement}
        </p>
        {filtered && (
          <button type="button" className={btn("outline", "sm")} onClick={() => onChange(DEFAULT_QUERY)}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
