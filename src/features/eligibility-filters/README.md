# Program eligibility filters backed by structured facets

**Issue:** [#142 — Add program eligibility filters backed by structured country and student-status fields](https://github.com/adityalenova/cyrus/issues/142)
**Level:** 2

## The problem

`/programs` could filter by calendar status only. Whether a reader can apply at
all - student status, residency - was buried in free-text `eligibility` prose
that no control could query, and the page had no way to say "this organizer
publishes nothing about that". Any filter had to avoid inventing a rule for the
twelve programs whose records are silent.

## What was built

- **Structured facets, mechanically derived.** `ProgramDetailData` gains an
  optional `eligibilityFacets?: { studentStatus?, countries?, residencyNote?, source? }`.
  Exactly one record populates it: GSoC, whose published sentence is
  "18+ and legally able to work in your country; students and non-students
  alike". That yields `studentStatus: "optional"` and
  `residencyNote: "18+ and legally able to work in your country"`, with
  `source` naming the sentence. **No `countries` list is added** - the sentence
  names "your country", not a set of countries - and no other record gets
  facets, so all twelve read Unknown. The free-text `eligibility` field is
  untouched and remains the place the string lives.
- **Three outcomes, never two.** The predicate returns
  `eligible | ineligible | unknown`. A program whose record publishes no rule
  for a question is `unknown`; only a published rule that conflicts with the
  filter is `ineligible`. Unknown programs stay in the results so the reader
  can see what is unanswerable; ineligible ones are hidden but counted and
  announced.
- **Filters compose with the existing status pill.** All three filters
  (status, student, country) live in the URL (`?status=live&student=optional&country=IN`),
  apply in that order, and a Clear button returns to defaults. Status moved
  from component state to the URL so the three can be shared and back-navigated
  together.
- **Explicit result states on the cards.** While a facet filter is active each
  card carries "Matches filters", "Not eligible" or "Unknown" with a
  screen-reader reason, and a `role="status"` line announces
  "N programs shown · N eligible · N unknown · N marked ineligible and hidden".
- **Accessible controls.** Labelled select and country input (`useId`,
  `aria-describedby`), `aria-pressed` on the status chips, visible
  focus-visible rings, and a country field constrained to ISO alpha-2 letters.
  The panel explains, in place, that no tracked program publishes a country
  list, so a country code marks every program Unknown rather than assuming it
  is open to that country.
- **"No student rule published" is itself a filter.** It matches exactly the
  programs whose record carries no student rule - a statement about the record,
  not a claim about the reader.

## File map

| Path | Role |
| --- | --- |
| `src/features/eligibility-filters/model.ts` | Pure facets: `classify`, `filterCatalog`, country normalisation, URL read/write |
| `src/features/eligibility-filters/EligibilityFilters.tsx` | Filter panel: status chips, student select, country input, status line |
| `src/features/eligibility-filters/model.test.ts` | Facet predicate incl. unknown, missing-field fixtures, URL round-trip, status composition |
| `src/data/programDetails.ts` | `EligibilityFacets`, the optional field, and GSoC's three published facts |
| `src/views/Programs.tsx` | Catalog reads/writes the query, renders the panel, badges cards |
| `src/app/programs/page.tsx` | Existing route metadata already carries `canonical("/programs")` - unchanged |

## Data sources and as-of date

The facets are read from the same GSoC eligibility sentence already in
`src/data/programDetails.ts`, which was written from the organizer's published
page for the site's October 2026 snapshot. No new source was fetched, no
country table was added, and no rule was inferred from the stipend, the season
or the compare page's legacy "students required" boolean.

## Limitations

- Only GSoC has facets, and it has no country list. Consequently the country
  filter currently marks every program Unknown. That is the honest state of the
  published records, not a bug, and the panel says so.
- The legacy stipend comparison on `/programs/compare` still carries its own
  `studentRequired` booleans; this issue deliberately does not reuse them as
  facets because they are not sourced from published text. (Issue #132 adds the
  published eligibility text beside them.)
- The status pill was previously component state; a link that relied on it
  still works because `?status=` is now the only form. No redirect from old
  URLs is needed - there were none.
- Filter counts are computed over the programs that pass the status pill; the
  hidden ineligible count is reported separately.
