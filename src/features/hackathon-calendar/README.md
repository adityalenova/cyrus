# Program calendar (`/programs/calendar`)

**Issue:** [#197 — Add calendar view for hackathon schedules](https://github.com/adityalenova/cyrus/issues/197)
**Level:** 3

## Problem

The catalog states when programs open, run and close, but it says so in prose
(`window`) and in phase windows that only the signed-in dashboard calendar
draws. There was no standalone, linkable calendar, no week or day reading, no
filter by program/status/difficulty, no .ics export, and no way to keep the
dates a visitor actually cares about alongside the published ones.

## What was built

- `/programs/calendar` — a static segment beside the existing `/programs/[id]`
  route (the same pattern `/programs/compare` already uses).
- **Month / week / day views.** The grid is generated in `model.ts`, in UTC:
  correct leading and trailing days, a configurable week start (Monday,
  Sunday, Saturday), and leap-year Februaries. No calendar dependency.
- **Colour-coded events** by award type, folded from the program's published
  `payNote` (stipend / prizes / credits-grant / unpaid / learning). The legend
  states the folding rule; it is not presented as the organizer's own wording.
- **Event details popover** (`role="dialog"`, Escape and outside-click close,
  focus moved to the close button and returned to the trigger).
- **Filters** by program, status and difficulty (the catalog's `level` for the
  program in `src/data/programDetails.ts`). Filter state, view, anchor day and
  week start all live in URL search params (`view`, `date`, `ws`, `program`,
  `status`, `level`), so a filtered calendar is shareable.
- **.ics export** built client-side as a Blob: CRLF line endings, RFC 5545 TEXT
  escaping, folding at 75 octets counted in UTF-8 bytes, and all-day
  `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` (exclusive end).
- **"Add a date" form** persisted in `localStorage` under
  `cyrus.calendar.events.v1`, with remove, so the calendar is useful where a
  program publishes rolling or no dates. Stored rows are re-validated on read.
- **Responsive list view** on mobile: the same filtered range as chronological
  cards, not a squeezed grid.

## Files

| Path | Role |
| --- | --- |
| `src/features/hackathon-calendar/model.ts` | pure UTC grid, catalog events, filters, URL state, .ics writer |
| `src/features/hackathon-calendar/ProgramCalendar.tsx` | the client page: views, filters, popover, form, export |
| `src/features/hackathon-calendar/model.test.ts` | grid/leap/multi-day/ICS/filter tests (vitest, node) |
| `src/app/programs/calendar/page.tsx` | route + metadata + canonical |

## Data sources and as-of date

- **Program phase windows:** `src/data/orgs.ts` (`PROGRAMS[].phases`), which
  its own header describes as the organizers' calendars rounded to the nearest
  few days. Each event's source line says exactly that.
- **Program status and difficulty:** `status` from `src/data/orgs.ts`; `level`
  from `src/data/programDetails.ts`. A program with no published level is
  "Not published" in the popover and is excluded by a difficulty filter.
- **Award type:** derived from `pay` / `payNote` in `src/data/orgs.ts`.
- **As of:** `CRAWL.crawledAt` = **2026-10-21** (`src/data/crawlStats.ts`).
- **Visitor dates:** this browser only (`cyrus.calendar.events.v1`); labelled
  as such, never merged into the catalog provenance line.

No date is inferred beyond the stated phase windows. The 2027 cycle repeats the
2026 month windows because no organizer has published 2027 dates; those events
are labelled "projected" in the source and carry an explicit note. Navigating
past the stated cycles shows only the visitor's own dates.

## Limitations

- Phase windows are within roughly three days of the organizer's actual dates;
  the page says so and the .ics description repeats it. Do not treat one as a
  legal deadline.
- All dates are all-day and UTC. An organizer's local timezone can shift a
  deadline by a day.
- "Award type" is a derived grouping of the published `payNote`, not an
  organizer taxonomy.
- Custom dates are per browser and per origin; there is no server sync and no
  import.
- The calendar intentionally shows only windows the catalog states. Programs
  that publish only "applications close in April" have no dated event.

## Tests

```
node ../../node_modules/vitest/vitest.mjs run src/features/hackathon-calendar
```

Covers: December→January grids, Sunday-first and Saturday-first weeks, leap
day 2028 vs 2027 and 2100, multi-day events across a month/year boundary,
custom-date validation, catalog event sourcing, filter combinations, query
round-trips, ICS escaping and byte-accurate folding (including multi-byte
characters), CRLF hygiene, and exclusive `DTEND`.
