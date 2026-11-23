/* ══ model.test.ts — the calendar's promises ═══════════════════════════
   Grids that cross a year, a February that knows its leap day, an .ics that
   any calendar app can parse, and filter semantics where an empty list means
   "everything". All UTC, so the run does not depend on the machine's zone. ═ */
import { describe, expect, it } from "vitest";
import { PROGRAMS } from "../../data/orgs";
import { PROGRAM_DETAILS } from "../../data/programDetails";
import {
  addDays,
  awardTypeOf,
  catalogEvents,
  eventDays,
  eventsInRange,
  eventsOnDay,
  escapeIcsText,
  filterEvents,
  foldIcsLine,
  icsDate,
  isoOf,
  makeCustomEvent,
  matchesFilter,
  monthCells,
  monthOf,
  parseCustomEvents,
  parseIso,
  parseQuery,
  programEvents,
  queryOf,
  startOfWeek,
  toIcs,
  weekCells,
  type CalendarEvent,
} from "./model";

const encoder = new TextEncoder();

function ev(start: string, end: string, over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: `t-${start}-${end}`,
    title: "Test window",
    programId: "gsoc",
    program: "Google Summer of Code",
    phase: "Coding",
    status: "live",
    level: "intermediate",
    type: "stipend",
    start,
    end,
    source: { label: "src/data/orgs.ts - phase windows", url: "https://example.org" },
    custom: false,
    ...over,
  };
}

describe("month grid", () => {
  it("spills December into January of the next year", () => {
    const cells = monthCells(2026, 11, 1); // December 2026, Monday first
    expect(cells[0].iso).toBe("2026-11-30");
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].iso).toBe("2026-12-01");
    expect(cells[1].inMonth).toBe(true);
    expect(cells[cells.length - 1].iso).toBe("2027-01-03");
    expect(cells[cells.length - 1].inMonth).toBe(false);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });

  it("walks back across the previous year for a Sunday-first January", () => {
    const cells = monthCells(2027, 0, 0); // 1 Jan 2027 is a Friday
    expect(cells[0].iso).toBe("2026-12-27");
    expect(cells[cells.length - 1].iso).toBe("2027-02-06");
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("knows February has 29 days in a leap year and 28 otherwise", () => {
    const leap = monthCells(2028, 1, 1);
    expect(leap.filter((c) => c.inMonth)).toHaveLength(29);
    expect(leap.some((c) => c.iso === "2028-02-29" && c.inMonth)).toBe(true);

    const common = monthCells(2027, 1, 1);
    expect(common.filter((c) => c.inMonth)).toHaveLength(28);
    expect(common.some((c) => c.iso === "2027-02-29")).toBe(false);

    const century = monthCells(2100, 1, 1); // 2100 is not a leap year
    expect(century.filter((c) => c.inMonth)).toHaveLength(28);
  });

  it("honours a Saturday-first week", () => {
    const cells = monthCells(2026, 11, 6);
    expect(cells[0].iso).toBe("2026-11-28");
    expect(new Date(`${cells[0].iso}T00:00:00Z`).getUTCDay()).toBe(6);
    expect(new Date(`${cells[6].iso}T00:00:00Z`).getUTCDay()).toBe(5);
    expect(cells.length % 7).toBe(0);
  });

  it("never leaves a day out when stepping through a year", () => {
    const seen = new Set<string>();
    for (let m = 0; m < 12; m++) {
      for (const c of monthCells(2026, m, 1)) if (c.inMonth) seen.add(c.iso);
    }
    expect(seen.size).toBe(365);
  });
});

describe("week geometry", () => {
  it("finds the Monday that opens a week crossing into a new year", () => {
    expect(startOfWeek("2026-01-01", 1)).toBe("2025-12-29");
    const week = weekCells("2026-01-01", 1);
    expect(week).toHaveLength(7);
    expect(week[0].iso).toBe("2025-12-29");
    expect(week[6].iso).toBe("2026-01-04");
    expect(week.filter((c) => c.inMonth)).toHaveLength(4); // Thu-Sun are January
  });

  it("starts on Sunday when asked, and on the same day for a Sunday anchor", () => {
    expect(startOfWeek("2026-11-22", 0)).toBe("2026-11-22");
    expect(startOfWeek("2026-11-22", 1)).toBe("2026-11-16");
    expect(startOfWeek("2026-11-22", 6)).toBe("2026-11-21");
  });

  it("rejects impossible dates instead of rolling them forward", () => {
    expect(parseIso("2027-02-29")).toBeNull();
    expect(parseIso("2028-02-29")).not.toBeNull();
    expect(parseIso("2026-13-01")).toBeNull();
    expect(parseIso("2026-1-01")).toBeNull();
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("multi-day events", () => {
  const crossing = ev("2026-12-30", "2027-01-03"); // four days, end exclusive

  it("covers every day of its span and neither neighbour", () => {
    const days = ["2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"];
    const covered = days.filter((d) => eventsOnDay([crossing], d).length > 0);
    expect(covered).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(eventDays(crossing)).toBe(4);
  });

  it("appears in both months of a range query", () => {
    expect(eventsInRange([crossing], "2026-12-01", "2027-01-01")).toHaveLength(1);
    expect(eventsInRange([crossing], "2027-01-01", "2027-02-01")).toHaveLength(1);
    expect(eventsInRange([crossing], "2026-11-01", "2026-12-01")).toHaveLength(0);
  });

  it("refuses a custom date whose end is not after its start", () => {
    const bad = makeCustomEvent({ title: "Catch-up", start: "2026-12-10", end: "2026-12-10" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/after the start/);

    const good = makeCustomEvent({ title: "  Two day sprint ", start: "2026-12-10", end: "2026-12-12" }, 1000);
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.event.title).toBe("Two day sprint");
      expect(good.event.start).toBe("2026-12-10");
      expect(good.event.end).toBe("2026-12-12");
      expect(good.event.custom).toBe(true);
      expect(good.event.source.label).toContain("cyrus.calendar.events.v1");
    }

    const blank = makeCustomEvent({ title: "   ", start: "2026-12-10" });
    expect(blank.ok).toBe(false);
  });

  it("drops stored custom rows of the wrong shape rather than rendering them", () => {
    const rows = parseCustomEvents([
      { title: "Good", start: "2026-12-01" },
      { title: "", start: "2026-12-02" },
      { title: "Bad date", start: "2026-02-30" },
      null,
      "nope",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].end).toBe("2026-12-02"); // single-day default is exclusive next midnight
  });
});

describe("catalog events", () => {
  it("carries one event per published phase, each with a source", () => {
    const events = programEvents(2026);
    expect(events).toHaveLength(PROGRAMS.reduce((n, p) => n + p.phases.length, 0));
    for (const e of events) {
      expect(parseIso(e.start)).not.toBeNull();
      expect(parseIso(e.end)).not.toBeNull();
      expect(e.end > e.start).toBe(true);
      expect(e.source.label).toContain("src/data/orgs.ts");
      expect(e.source.url).toMatch(/^https:\/\//);
    }
  });

  it("dates the GSoC org window to the start of the stated year", () => {
    const gsoc = programEvents(2026).filter((e) => e.programId === "gsoc");
    expect(gsoc[0].start).toBe("2026-01-01");
    const coding = gsoc.find((e) => e.phase === "Coding period");
    expect(coding?.start).toBe("2026-05-20");
  });

  it("marks a projected year as projected and keeps the level the catalog states", () => {
    const y2027 = programEvents(2027).filter((e) => e.programId === "gsoc");
    expect(y2027.every((e) => e.source.label.includes("projected year"))).toBe(true);
    expect(y2027.every((e) => e.note?.includes("No 2027 window"))).toBe(true);
    expect(y2027[0].level).toBe(PROGRAM_DETAILS.gsoc.level);
    const all = catalogEvents();
    expect(new Set(all.map((e) => e.programId))).toEqual(new Set(PROGRAMS.map((p) => p.id)));
  });

  it("derives the colour bucket from the published payNote", () => {
    const gsoc = PROGRAMS.find((p) => p.id === "gsoc")!;
    const vercel = PROGRAMS.find((p) => p.id === "vercel-oss")!;
    const fossee = PROGRAMS.find((p) => p.id === "fossee")!;
    const oct = PROGRAMS.find((p) => p.id === "oct")!;
    expect(awardTypeOf(gsoc)).toBe("stipend");
    expect(awardTypeOf(vercel)).toBe("grant");
    expect(awardTypeOf(fossee)).toBe("unpaid");
    expect(awardTypeOf(oct)).toBe("prize");
  });
});

describe("filters", () => {
  const a = ev("2026-06-01", "2026-06-10", { programId: "gsoc", status: "live", level: "intermediate" });
  const b = ev("2026-07-01", "2026-07-05", { programId: "lfx", status: "upcoming", level: "advanced" });
  const c = ev("2026-08-01", "2026-08-03", { programId: "lfx", status: "closed", level: undefined });

  it("treats an empty filter as no restriction", () => {
    expect(filterEvents([a, b, c], { programs: [], statuses: [], levels: [] })).toHaveLength(3);
  });

  it("combines program, status and level with AND", () => {
    expect(filterEvents([a, b, c], { programs: ["lfx"], statuses: [], levels: [] })).toEqual([b, c]);
    expect(filterEvents([a, b, c], { programs: ["lfx"], statuses: ["upcoming"], levels: [] })).toEqual([b]);
    expect(matchesFilter(c, { programs: [], statuses: [], levels: ["beginner"] })).toBe(false);
    expect(matchesFilter(c, { programs: [], statuses: [], levels: ["advanced"] })).toBe(false);
    expect(matchesFilter(b, { programs: [], statuses: [], levels: ["advanced"] })).toBe(true);
  });

  it("reads and writes the query without inventing values", () => {
    const q = parseQuery("?view=week&date=2026-12-30&ws=0&program=gsoc,lfx&status=live&level=bogus", "2026-01-01");
    expect(q.view).toBe("week");
    expect(q.date).toBe("2026-12-30");
    expect(q.weekStartsOn).toBe(0);
    expect(q.filter.programs).toEqual(["gsoc", "lfx"]);
    expect(q.filter.statuses).toEqual(["live"]);
    expect(q.filter.levels).toEqual([]);
    expect(queryOf(q)).toBe("view=week&date=2026-12-30&ws=0&program=gsoc%2Clfx&status=live");

    const fallback = parseQuery("?view=nope&date=2026-02-30&ws=4", "2026-03-04");
    expect(fallback.view).toBe("month");
    expect(fallback.date).toBe("2026-03-04");
    expect(fallback.weekStartsOn).toBe(1);
  });
});

describe(".ics export", () => {
  const one = ev("2026-12-30", "2027-01-03", {
    id: "crossing-2026",
    title: "Winter sprint, phase; one\\two",
  });

  it("escapes TEXT delimiters in RFC 5545 order", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(escapeIcsText("line\r\nbreak")).toBe("line\\nbreak");
  });

  it("writes all-day DATE properties with an exclusive DTEND", () => {
    const out = toIcs([one], { now: Date.UTC(2026, 10, 22, 10, 30) });
    expect(out).toContain("DTSTART;VALUE=DATE:20261230");
    expect(out).toContain("DTEND;VALUE=DATE:20270103");
    expect(out).toContain("DTSTAMP:20261122T103000Z");
    expect(out).toContain("SUMMARY:Winter sprint\\, phase\\; one\\\\two");
    expect(out.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(out).toContain(`UID:crossing-2026@cyrus.ai`);
    expect(out.replace(/\r\n /g, "")).toContain("Data as of 2026-10-21");
  });

  it("uses CRLF on every line, including the folded ones", () => {
    const out = toIcs([one], { now: 0 });
    expect(out.split("\r\n").every((line, i, all) => i === all.length - 1 ? line === "" : !line.includes("\n"))).toBe(true);
    expect(out.includes("\r\r")).toBe(false);
    expect(icsDate("2027-01-03")).toBe("20270103");
  });

  it("folds long lines at 75 octets without splitting a character", () => {
    const long = "x".repeat(160);
    const folded = foldIcsLine(`SUMMARY:${long}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe("SUMMARY:" + long);

    const event = ev("2026-06-01", "2026-06-02", { title: "é".repeat(90) + "🎉" });
    const out = toIcs([event], { now: 0 });
    for (const line of out.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = out.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${"é".repeat(90)}🎉`);
  });

  it("round-trips a date through isoOf and monthOf", () => {
    const day = "2026-12-31";
    expect(isoOf(parseIso(day)!)).toBe(day);
    expect(monthOf(day)).toEqual({ year: 2026, month: 11 });
    expect(monthOf("not-a-date").month).toBeGreaterThanOrEqual(0);
  });
});
