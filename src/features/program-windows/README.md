# Program eligibility and application-window comparison

**Issue:** [#132 — Program pages need a consistent way to compare eligibility and application windows](https://github.com/adityalenova/cyrus/issues/132)
**Level:** 2

## The problem

`/programs/compare` compared stipends, seasons and a hand-written
"students required" boolean, but not the two things a reader needs before
applying: the eligibility rule the organizer actually publishes, and when the
application window opens and closes. The eligibility copy on the page was a
separate, inferred table (`"18+ years old, global"`) that could drift from the
program's own record, and it had no way to say "this organizer publishes
nothing".

## What was built

`/programs/compare` is extended in place - there is no second comparison route.

- **Selection is the URL.** `?p=gsoc,lfx,outreachy` holds the comparison.
  A missing `?p=` opens the previous default three; an empty `?p=` stays empty
  because that is what the reader chose. Ids are lowercased, de-duplicated,
  unknown ids are dropped and the list is capped at four columns. The same
  selection drives the existing regional stipend cards, so the two halves of
  the page cannot disagree.
- **Published eligibility, verbatim.** The matrix prints `eligibility` from
  `PROGRAM_DETAILS` exactly as the record carries it. Nothing is inferred
  from `studentRequired`, a stipend, a season or a neighbouring program.
- **Application windows.** `ProgramDetailData.applicationWindow` is new and
  optional: `{ label, period?, note?, source }`, quoted from the program's
  published path. GSoC publishes "Proposal window (late Mar - early Apr)";
  LFX publishes the step ("Apply to one scope") but no dates, so the date cell
  reads "dates not published" rather than borrowing the term calendar. Programs
  with no published window (MLH, Hacktoberfest, 24 Pull Requests) read "Not
  published" outright.
- **"Not published" everywhere a value is absent.** The wording comes from
  `src/lib/programFields.ts` (`NOT_PUBLISHED`), the same helper the catalog and
  detail page use, so the surfaces cannot drift.
- **Desktop table, mobile stacked cards.** One dataset, two layouts
  (`<table>` above 768px; a list of cards below it). Each published cell shows
  its source line.
- **Keyboard operation.** The program picker uses a roving tabindex
  (Arrow keys, Home, End); every chip carries `aria-pressed`, every remove
  button is a real button with an accessible name, the table has a caption and
  scoped headers, and a `role="status"` line announces the selection count and
  the column limit. Focus rings are visible on every control. `reveal` is used
  only for the mobile cards, and Tailwind/the stylesheet disable it under
  `prefers-reduced-motion`.

## File map

| Path | Role |
| --- | --- |
| `src/features/program-windows/model.ts` | Pure logic: field mapping, "Not published" cells, `?p=` parsing/serialising, toggle and cap rules |
| `src/features/program-windows/ProgramWindowsPanel.tsx` | Picker + desktop table + mobile stacked cards |
| `src/features/program-windows/model.test.ts` | Field mapping for every record, missing/partial values, URL round-trip |
| `src/data/programDetails.ts` | `ApplicationWindow` type and the `applicationWindow` field, populated only where the published copy states it |
| `src/views/ProgramCompare.tsx` | Selection moved to `?p=`, panel mounted, student filter now filters the stipend cards |
| `src/app/programs/compare/page.tsx` | Metadata with title, description and `canonical("/programs/compare")` |

## Data sources and as-of date

Eligibility and window strings are the program records already maintained in
`src/data/programDetails.ts`, written from each organizer's published page when
the record was created. No new external data was fetched for this issue; the
data as-of date is therefore the record's own (the site's October 2026
snapshot, per `STATS` and the program timeline).

## Limitations

- The regional stipend cards still use the page's pre-existing stipend table
  (including its "student requirement" boolean). That table is not derived from
  `PROGRAM_DETAILS`; this issue adds the authoritative matrix beside it rather
  than rewriting the stipend model.
- Application windows are only as precise as the record: several programs
  publish a month range, not a date, and some publish no dates at all.
- Four columns is a readability cap, not a data limit.
- `PROGRAM_DETAILS` has no record for Google Season of Docs, so selecting
  nothing there is possible only by id; Season of Docs is not offered in the
  picker.
