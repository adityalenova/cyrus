/* ══ model.ts — the calendar's maths, its data, and its export ══════════
   Everything here is pure: a month/week/day grid in UTC, the events the
   catalog actually states, the filter predicate, the localStorage shape for
   dates a visitor adds, and an RFC 5545 export. No React, no DOM, no clock
   except where a caller passes one in - which is what makes the grid and the
   .ics file testable in a node test run.

   Where the preloaded dates come from: src/data/orgs.ts holds each tracked
   program's phases as month windows (4.6 = mid-May). Those windows are the
   organizer calendars rounded to the nearest few days; this file repeats that
   caveat in every event it builds rather than implying day precision. No
   other date is invented: programs that publish rolling or unstated dates
   simply have no phase window here, and the page offers the visitor their own
   "add a date" store instead.                                          ══ */
import { CRAWL } from "../../data/crawlStats";
import { PROGRAMS } from "../../data/orgs";
import { PROGRAM_DETAILS } from "../../data/programDetails";
import type { Level, Program } from "../../lib/types";

/** the snapshot the catalog copy is dated to (src/data/crawlStats.ts) */
export const DATA_AS_OF = CRAWL.crawledAt;

/** where a preloaded window comes from, printed next to it */
export const PROGRAM_SOURCE = "src/data/orgs.ts - phase windows";
export const PROGRAM_SOURCE_NOTE =
  "Month windows read off each organizer's published calendar and rounded to the nearest few days.";

/** dates a visitor adds live here, in this browser only */
export const CUSTOM_STORAGE_KEY = "cyrus.calendar.events.v1";

/** the cycles the catalog states windows for, plus the same windows a year on */
export const CYCLE_YEARS = [2026, 2027] as const;

export const DAY_MS = 86_400_000;

export type WeekStart = 0 | 1 | 6; // Sunday, Monday, Saturday
export const WEEK_START_OPTIONS: { value: WeekStart; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 0, label: "Sunday" },
  { value: 6, label: "Saturday" },
];

export type CalendarView = "month" | "week" | "day";
export const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

/* ── award type: the colour code, derived from a published field ──────
   The catalog does not tag programs by "type". It does publish payNote
   (STIPEND, PRIZES, PER PROJECT / QUARTER, NO HONORARIUM...), so the colour
   is that published note folded into five buckets. The legend on the page
   says so; a bucket is never presented as the organizer's own wording. */
export type AwardType = "stipend" | "prize" | "grant" | "unpaid" | "learning";

export const AWARD_META: Record<AwardType, { label: string; dot: string; cls: string; hint: string }> = {
  stipend: { label: "Stipend", dot: "var(--color-leaf)", cls: "text-leaf border-leaf/35 bg-leaf/7", hint: "payNote names a stipend or per-project fee" },
  prize: { label: "Prizes", dot: "var(--color-honey)", cls: "text-honey border-honey/35 bg-honey/7", hint: "payNote names prizes, swag or a leaderboard" },
  grant: { label: "Credits / grant", dot: "var(--color-denim)", cls: "text-denim border-denim/35 bg-denim/7", hint: "payNote names credits or a quarterly grant" },
  unpaid: { label: "Unpaid", dot: "var(--color-plum)", cls: "text-plum border-plum/35 bg-plum/7", hint: "payNote says no honorarium or a gift to maintainers" },
  learning: { label: "Learning", dot: "var(--color-rust)", cls: "text-rust border-accent/30 bg-peach", hint: "the record states no award" },
};

export function awardTypeOf(p: Pick<Program, "pay" | "payNote">): AwardType {
  const note = `${p.pay ?? ""} ${p.payNote ?? ""}`.toUpperCase();
  if (/QUARTER|CREDIT/.test(note)) return "grant";
  if (/NO HONORARIUM|GIFT TO MAINTAINERS|UNPAID/.test(note)) return "unpaid";
  if (/STIPEND|PER TERM|PER PROJECT|PER INTERNSHIP|UP TO/.test(note)) return "stipend";
  if (/PRIZE|SWAG|LEADERBOARD|BADGE/.test(note)) return "prize";
  return "learning";
}

export const STATUS_LABEL: Record<Program["status"], string> = {
  live: "Live", upcoming: "Upcoming", closed: "Closed",
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced",
};

/* ── one event, all-day, half-open [start, end) ────────────────────────
   ISO dates compare correctly as strings (YYYY-MM-DD), so overlap tests are
   cheap and the .ics DTSTART/DTEND carry the same pair with no timezone
   ambiguity: an all-day event is a date, not an instant. */
export type CalendarEvent = {
  id: string;
  title: string;
  programId: string;
  program: string;
  phase: string;
  status: Program["status"];
  /** the catalog's own level for the program; absent where it states none */
  level?: Level;
  type: AwardType;
  /** inclusive first day, UTC */
  start: string;
  /** exclusive day after the last day, UTC - RFC 5545's all-day rule */
  end: string;
  source: { label: string; url: string };
  /** true for a date this browser holds, not for a catalog window */
  custom: boolean;
  note?: string;
};

/* ── UTC date arithmetic ─────────────────────────────────────────────── */
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function daysInMonth(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.getUTCDate();
}

export function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day);
}

/** strict YYYY-MM-DD -> UTC midnight; null for a shape or a date that is wrong */
export function parseIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (mo < 0 || mo > 11) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  return utcDay(y, mo, d);
}

export function isoOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const t = parseIso(iso);
  return t === null ? iso : isoOf(t + n * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, in UTC */
export function weekdayOf(iso: string): number {
  const t = parseIso(iso);
  return t === null ? 0 : new Date(t).getUTCDay();
}

export function startOfWeek(iso: string, weekStartsOn: WeekStart): string {
  const t = parseIso(iso);
  if (t === null) return iso;
  const shift = (new Date(t).getUTCDay() - weekStartsOn + 7) % 7;
  return isoOf(t - shift * DAY_MS);
}

export type GridCell = {
  /** YYYY-MM-DD */
  iso: string;
  /** day of month, kept for the cell label */
  day: number;
  /** false for a leading/trailing day borrowed from the neighbouring month */
  inMonth: boolean;
};

export function monthStartIso(year: number, month: number): string {
  return isoOf(utcDay(year, month, 1));
}

/**
 * A month laid out in whole weeks. The grid begins on the first `weekStartsOn`
 * day on or before the 1st, ends on the last `weekStartsOn` day on or after the
 * month's last day, and always holds a multiple of seven cells - so a
 * December grid spills into January of the next year, a February grid knows
 * 29 days in a leap year, and a five-week month is five rows rather than six.
 */
export function monthCells(year: number, month: number, weekStartsOn: WeekStart = 1): GridCell[] {
  const first = utcDay(year, month, 1);
  const lead = (new Date(first).getUTCDay() - weekStartsOn + 7) % 7;
  const dim = daysInMonth(year, month);
  const total = Math.ceil((lead + dim) / 7) * 7;
  const out: GridCell[] = [];
  for (let i = 0; i < total; i++) {
    const t = first + (i - lead) * DAY_MS;
    const d = new Date(t);
    out.push({
      iso: isoOf(t),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month && d.getUTCFullYear() === year,
    });
  }
  return out;
}

/** the seven days of the week that holds `iso`, starting on `weekStartsOn`.
    `inMonth` is relative to the anchor's month, not to the week's first day,
    so a week that crosses a year boundary marks the anchor side correctly. */
export function weekCells(iso: string, weekStartsOn: WeekStart = 1): GridCell[] {
  const start = startOfWeek(iso, weekStartsOn);
  const anchorMonth = monthOf(iso).month;
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return { iso: day, day: Number(day.slice(8, 10)), inMonth: Number(day.slice(5, 7)) - 1 === anchorMonth };
  });
}

export function monthOf(iso: string): { year: number; month: number } {
  const t = parseIso(iso);
  if (t === null) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  }
  const d = new Date(t);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function shiftMonth(iso: string, delta: number): string {
  const { year, month } = monthOf(iso);
  return isoOf(utcDay(year, month + delta, 1));
}

export function shiftDay(iso: string, delta: number): string {
  return addDays(iso, delta);
}

export function todayIso(now: number = Date.now()): string {
  return isoOf(now);
}

/* ── events ──────────────────────────────────────────────────────────── */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** a program phase's month fraction (4.6) as a UTC day in `year` */
function fractionToIso(year: number, v: number): string {
  let m = Math.floor(v);
  let y = year;
  while (m >= 12) { m -= 12; y += 1; }
  while (m < 0) { m += 12; y -= 1; }
  const dim = daysInMonth(y, m);
  const day = Math.min(dim, Math.max(1, Math.round((v - Math.floor(v)) * dim) + 1));
  return isoOf(utcDay(y, m, day));
}

/**
 * The events the catalog states for one cycle. Every program with a phase
 * window contributes one event per phase; programs with no window contribute
 * nothing. `projected` marks a year no organizer has published yet (2027 at
 * the time of writing), and the title/source say so instead of pretending
 * the dates are confirmed.
 */
export function programEvents(year: number, projected = year > 2026): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const p of PROGRAMS) {
    for (const ph of p.phases) {
      const start = fractionToIso(year, ph.s);
      let end = fractionToIso(year, ph.e);
      if (end <= start) end = addDays(start, 1);
      const detail = PROGRAM_DETAILS[p.id];
      out.push({
        id: `${p.id}-${slug(ph.label)}-${year}`,
        title: `${p.name}: ${ph.label}`,
        programId: p.id,
        program: p.name,
        phase: ph.label,
        status: p.status,
        level: detail?.level,
        type: awardTypeOf(p),
        start,
        end,
        source: {
          label: `${PROGRAM_SOURCE}${projected ? " (projected year)" : ""}`,
          url: p.url,
        },
        custom: false,
        note: projected
          ? "No 2027 window is published yet; this repeats the 2026 month window."
          : undefined,
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** every preloaded window the page carries */
export function catalogEvents(years: readonly number[] = CYCLE_YEARS): CalendarEvent[] {
  return years.flatMap((y) => programEvents(y, y > 2026));
}

/* ── visitor-added dates ─────────────────────────────────────────────── */
export type CustomEventInput = { title: string; start: string; end?: string; note?: string };

export type CustomResult =
  | { ok: true; event: CalendarEvent }
  | { ok: false; error: string };

const CUSTOM_SOURCE = "Added by you - this browser (cyrus.calendar.events.v1)";

/**
 * Validate and shape one visitor-added date. The end is optional and, like
 * every other event, exclusive: a one-day date ends the next midnight, and a
 * date that ends before it starts is refused rather than silently reordered.
 */
export function makeCustomEvent(input: CustomEventInput, now: number = Date.now()): CustomResult {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the date a title." };
  if (title.length > 120) return { ok: false, error: "Keep the title under 120 characters." };
  const startMs = parseIso(input.start);
  if (startMs === null) return { ok: false, error: "Start date must be a real YYYY-MM-DD date." };
  const endRaw = (input.end ?? "").trim();
  const endMs = endRaw ? parseIso(endRaw) : startMs + DAY_MS;
  if (endRaw && endMs === null) return { ok: false, error: "End date must be a real YYYY-MM-DD date." };
  if (endMs !== null && endMs <= startMs) return { ok: false, error: "The end date has to come after the start date." };
  const note = (input.note ?? "").trim();
  const start = isoOf(startMs);
  return {
    ok: true,
    event: {
      id: `custom-${start}-${slug(title).slice(0, 28)}-${now.toString(36)}`,
      title,
      programId: "custom",
      program: "Your date",
      phase: title,
      status: "upcoming",
      type: "learning",
      start,
      end: isoOf(endMs ?? startMs + DAY_MS),
      source: { label: CUSTOM_SOURCE, url: "" },
      custom: true,
      note: note || undefined,
    },
  };
}

/** tolerant read of the stored array: a row of the wrong shape is dropped, not rendered */
export function parseCustomEvents(raw: unknown): CalendarEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: CalendarEvent[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const start = typeof r.start === "string" ? parseIso(r.start) : null;
    const end = typeof r.end === "string" ? parseIso(r.end) : null;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (start === null || !title) continue;
    const endIso = end !== null && end > start ? isoOf(end) : isoOf(start + DAY_MS);
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : `custom-${isoOf(start)}-${slug(title).slice(0, 28)}`,
      title,
      programId: "custom",
      program: "Your date",
      phase: title,
      status: "upcoming",
      type: "learning",
      start: isoOf(start),
      end: endIso,
      source: { label: CUSTOM_SOURCE, url: "" },
      custom: true,
      note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
    });
  }
  return out;
}

/* ── filters ─────────────────────────────────────────────────────────── */
export type CalendarFilter = {
  programs: string[];
  statuses: Program["status"][];
  levels: Level[];
};

export const EMPTY_FILTER: CalendarFilter = { programs: [], statuses: [], levels: [] };

/** an empty list means "no restriction", never "match nothing" */
export function matchesFilter(e: CalendarEvent, f: CalendarFilter): boolean {
  if (f.programs.length && !f.programs.includes(e.programId)) return false;
  if (f.statuses.length && !f.statuses.includes(e.status)) return false;
  if (f.levels.length && (!e.level || !f.levels.includes(e.level))) return false;
  return true;
}

export function filterEvents(events: readonly CalendarEvent[], f: CalendarFilter): CalendarEvent[] {
  return events.filter((e) => matchesFilter(e, f));
}

/** events covering one UTC day, earliest first */
export function eventsOnDay(events: readonly CalendarEvent[], iso: string): CalendarEvent[] {
  return events
    .filter((e) => e.start <= iso && iso < e.end)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** events overlapping [from, to) - the month and week columns read from here */
export function eventsInRange(events: readonly CalendarEvent[], from: string, to: string): CalendarEvent[] {
  return events
    .filter((e) => e.start < to && e.end > from)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** how many days an event covers, inclusive of both ends */
export function eventDays(e: CalendarEvent): number {
  const a = parseIso(e.start);
  const b = parseIso(e.end);
  return a === null || b === null ? 1 : Math.max(1, Math.round((b - a) / DAY_MS));
}

/* ── URL state ───────────────────────────────────────────────────────── */
export type CalendarQuery = {
  view: CalendarView;
  date: string;
  weekStartsOn: WeekStart;
  filter: CalendarFilter;
};

const LIST_SEP = ",";

const list = (raw: string | null): string[] =>
  [...new Set((raw ?? "").split(LIST_SEP).map((s) => s.trim().toLowerCase()).filter(Boolean))];

const STATUSES: Program["status"][] = ["live", "upcoming", "closed"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

/** read the page state out of a search string; every value is validated */
export function parseQuery(search: string, fallbackDate: string = todayIso()): CalendarQuery {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawView = sp.get("view");
  const view: CalendarView = rawView === "week" || rawView === "day" ? rawView : "month";
  const rawDate = sp.get("date");
  const date = rawDate && parseIso(rawDate) !== null ? rawDate : fallbackDate;
  const rawWs = Number(sp.get("ws"));
  const weekStartsOn: WeekStart = rawWs === 0 || rawWs === 6 ? rawWs : 1;
  return {
    view,
    date,
    weekStartsOn,
    filter: {
      programs: list(sp.get("program")).filter((id) => PROGRAMS.some((p) => p.id === id)),
      statuses: list(sp.get("status")).filter((s): s is Program["status"] => (STATUSES as string[]).includes(s)),
      levels: list(sp.get("level")).filter((l): l is Level => (LEVELS as string[]).includes(l)),
    },
  };
}

/** serialise only what differs from the defaults, so a clean URL stays clean */
export function queryOf(q: CalendarQuery): string {
  const sp = new URLSearchParams();
  if (q.view !== "month") sp.set("view", q.view);
  sp.set("date", q.date);
  if (q.weekStartsOn !== 1) sp.set("ws", String(q.weekStartsOn));
  if (q.filter.programs.length) sp.set("program", q.filter.programs.join(LIST_SEP));
  if (q.filter.statuses.length) sp.set("status", q.filter.statuses.join(LIST_SEP));
  if (q.filter.levels.length) sp.set("level", q.filter.levels.join(LIST_SEP));
  return sp.toString();
}

/* ── .ics export (RFC 5545) ───────────────────────────────────────────
   All-day events carry DTSTART;VALUE=DATE and DTEND;VALUE=DATE where DTEND
   is exclusive. Text is escaped (\ ; , and newlines), lines fold at 75
   octets counted in UTF-8 bytes with a leading space on every continuation,
   and every physical line ends CRLF because Outlook will not read anything
   else.                                                                */

const encoder = new TextEncoder();

const byteLength = (s: string): number => encoder.encode(s).length;

/** escape a TEXT value: backslash first, then the delimiters RFC 5545 names */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold one content line at `limit` octets. A continuation begins with a
 * space, which counts toward the limit; iteration is by code point so a
 * surrogate pair (an emoji in a title) is never cut in half.
 */
export function foldIcsLine(line: string, limit = 75): string {
  if (byteLength(line) <= limit) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = byteLength(ch);
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = " ";
      curBytes = 1;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join("\r\n");
}

/** YYYY-MM-DD -> YYYYMMDD, the only form a DATE property accepts */
export const icsDate = (iso: string): string => iso.replace(/-/g, "");

function icsStamp(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export type IcsOptions = { name?: string; now?: number };

/** one VCALENDAR holding every supplied event, ready for a Blob download */
export function toIcs(events: readonly CalendarEvent[], opts: IcsOptions = {}): string {
  const now = opts.now ?? Date.now();
  const stamp = icsStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//cyrus.ai//program calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.name ?? "cyrus.ai program calendar")}`,
  ];
  for (const e of events) {
    const source = `${e.source.label}. Program page: ${e.source.url || "not published"}. Data as of ${DATA_AS_OF}.`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@cyrus.ai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
      `DTEND;VALUE=DATE:${icsDate(e.end)}`,
      `SUMMARY:${escapeIcsText(e.title)}`,
      `DESCRIPTION:${escapeIcsText(`${e.title}. ${e.custom ? "" : PROGRAM_SOURCE_NOTE + " "}${source}`)}`,
    );
    if (e.source.url) lines.push(`URL:${e.source.url}`);
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map((l) => foldIcsLine(l)).join("\r\n") + "\r\n";
}

/** the filename a download should carry for a given view anchor */
export function icsFileName(date: string): string {
  return `cyrus-program-calendar-${date.slice(0, 7)}.ics`;
}
