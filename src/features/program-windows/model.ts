/* ══ program-windows/model.ts — the data half of the program comparison ══
   /programs/compare used to compare stipends only, with a hand-written table
   of eligibility strings and a "students required" boolean. This module adds
   the two things a comparison actually has to answer before someone applies:

     - what the organizer publishes as eligibility (verbatim from
       ProgramDetailData, never resumed from a boolean), and
     - when the application window opens and closes, where the organizer
       publishes dates at all.

   Every fact has one of two states: published, or "Not published". There is
   no third state and no default. An id with no ProgramDetailData record maps
   to a row whose every cell is "Not published" rather than to an inferred
   rule, which is why this file reads PROGRAM_DETAILS instead of the stipend
   table in the view.

   Selection lives in `?p=` (see selectionFromSearch / selectionToParam) so a
   comparison can be pasted into a chat and reopen exactly as it was left.  ══ */
import { PROGRAM_DETAILS } from "../../data/programDetails";
import type { ApplicationWindow, ProgramDetailData } from "../../data/programDetails";
import { NOT_PUBLISHED, isPublished } from "../../lib/programFields";

/** the query parameter a comparison travels in: ?p=gsoc,lfx,outreachy */
export const PROGRAM_PARAM = "p";

/** the selection a bare /programs/compare opens with, unchanged from the
    surface's previous default so existing links keep their meaning */
export const DEFAULT_SELECTION = ["gsoc", "lfx", "outreachy"];

/** how many programs the matrix can hold before the columns stop being readable */
export const MAX_SELECTION = 4;

/** every program that has a detail record, in the order the record declares them */
export const COMPARABLE_IDS: string[] = Object.keys(PROGRAM_DETAILS);

/** one cell of the matrix, carrying both the words and whether they are published */
export type Cell = {
  /** what the surface prints: the published text, or "Not published" */
  text: string;
  /** false when the organizer publishes nothing for this field */
  published: boolean;
  /** the published line this value was read from, "" when there is none */
  source: string;
};

export type WindowCell = Cell & {
  /** the stage the program names ("Proposal window"), "" when it names none */
  label: string;
  /** the period the program publishes ("late Mar - early Apr"), "" when none */
  period: string;
  /** a further published sentence about the window, when the record carries one */
  note: string;
};

export type ProgramRow = {
  id: string;
  /** display name supplied by the caller from the program catalog, or the id */
  name: string;
  eligibility: Cell;
  window: WindowCell;
  duration: Cell;
  tier: Cell;
  difficulty: Cell;
};

const published = (text: string | undefined): Cell =>
  isPublished(text)
    ? { text: (text as string).trim(), published: true, source: "" }
    : { text: NOT_PUBLISHED, published: false, source: "" };

/** the application window as a cell: a stage with no date is published as a
    stage and "Not published" as a date, so a partial record never reads as a
    complete one. */
export function windowCell(window: ApplicationWindow | undefined): WindowCell {
  if (!window || !isPublished(window.label)) {
    return { text: NOT_PUBLISHED, published: false, source: "", label: "", period: "", note: "" };
  }
  const label = window.label.trim();
  const period = isPublished(window.period) ? (window.period as string).trim() : "";
  const note = isPublished(window.note) ? (window.note as string).trim() : "";
  const source = isPublished(window.source) ? (window.source as string).trim() : "";
  const text = period ? `${label} (${period})` : `${label} - period ${NOT_PUBLISHED.toLowerCase()}`;
  return { text, published: Boolean(period), source, label, period, note };
}

/** one program's row, from its own detail record. A missing record publishes nothing. */
export function rowOf(id: string, detail: ProgramDetailData | undefined, name?: string): ProgramRow {
  return {
    id,
    name: isPublished(name) ? (name as string).trim() : id,
    eligibility: published(detail?.eligibility),
    window: windowCell(detail?.applicationWindow),
    duration: published(detail?.duration),
    tier: published(detail?.tier),
    difficulty: published(detail?.difficulty),
  };
}

/** rows for a selection, in selection order, dropping ids this build does not know */
export function compareRows(ids: string[], names: Record<string, string> = {}): ProgramRow[] {
  return ids
    .filter((id) => Object.prototype.hasOwnProperty.call(PROGRAM_DETAILS, id))
    .map((id) => rowOf(id, PROGRAM_DETAILS[id], names[id]));
}

/** ids the comparison can offer, in the catalog's order where one is supplied */
export function comparableIds(order: string[] = []): string[] {
  const known = new Set(COMPARABLE_IDS);
  const first = order.filter((id) => known.has(id));
  const rest = COMPARABLE_IDS.filter((id) => !first.includes(id));
  return [...first, ...rest];
}

/* ── selection: the URL is the whole state ─────────────────────── */

function allowedIds(allowed: readonly string[]): Set<string> {
  return new Set(allowed);
}

/**
 * Read `?p=` from a search string.
 *
 * `null` (no parameter at all) means "open the default comparison"; an empty
 * value (`?p=`) means the reader removed every program on purpose, and that
 * distinction is kept so a shared empty link is not silently refilled.
 */
export function selectionFromSearch(search: string, allowed: readonly string[] = COMPARABLE_IDS): string[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get(PROGRAM_PARAM);
  if (raw === null) return [...DEFAULT_SELECTION].filter((id) => allowedIds(allowed).has(id));
  return parseSelection(raw, allowed);
}

/** split, trim, lowercase, drop unknown ids and duplicates, then cap the list */
export function parseSelection(raw: string | null | undefined, allowed: readonly string[] = COMPARABLE_IDS): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const ok = allowedIds(allowed);
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim().toLowerCase();
    if (!id || !ok.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_SELECTION) break;
  }
  return out;
}

/** the value of `?p=`, without the question mark */
export function selectionToParam(ids: string[]): string {
  return ids.slice(0, MAX_SELECTION).join(",");
}

/** a full query string, including the `?`; an empty selection keeps `?p=` */
export function selectionToSearch(ids: string[]): string {
  return `?${PROGRAM_PARAM}=${selectionToParam(ids)}`;
}

/** add or remove one program, refusing to exceed MAX_SELECTION */
export function toggleProgram(
  selection: string[],
  id: string,
  allowed: readonly string[] = COMPARABLE_IDS,
): string[] {
  const key = id.trim().toLowerCase();
  if (!allowedIds(allowed).has(key)) return selection;
  if (selection.includes(key)) return selection.filter((x) => x !== key);
  if (selection.length >= MAX_SELECTION) return selection;
  return [...selection, key];
}

/** true when the picker should offer this program at all */
export function canAdd(selection: string[], id: string): boolean {
  return !selection.includes(id) && selection.length < MAX_SELECTION;
}

/* ── what a cell prints, and what the page says about it ───────────── */

/** a plain eligibility-style cell, exported for call sites and fixtures */
export function cellOfField(raw: string | undefined): Cell {
  return published(raw);
}

/** the wording of the field the reader is looking at, never a bare blank */
export const CELL_UNPUBLISHED = NOT_PUBLISHED;
