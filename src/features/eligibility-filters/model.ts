/* ══ eligibility-filters/model.ts — facet predicates behind /programs ══
   The catalog's program cards answer "when is it" (status) but not "can I
   apply". This module adds the two structured questions the records can
   actually answer - student status and residency - and keeps the answer
   honest about what an organizer publishes.

   Three outcomes, never two:

     eligible    the record publishes a rule and the reader meets it
     ineligible  the record publishes a rule and the reader does not
     unknown     the record publishes no rule for that question

   "Unknown" is not a soft yes. A program with no country list is not
   "open to everyone"; it is a program whose organizer publishes no country
   list, and the UI says exactly that. The facets themselves live in
   src/data/programDetails.ts and are only populated where the published
   eligibility sentence states a fact - GSoC is the only record that does.

   All three filters (status, student, country) travel in the query string,
   so a filtered catalog can be linked to and the back button works.      ══ */
import { PROGRAM_DETAILS } from "../../data/programDetails";
import type { EligibilityFacets, StudentStatus } from "../../data/programDetails";

export type Match = "eligible" | "ineligible" | "unknown";

/** "any" means the filter is off; the other four are the published states */
export type StudentFilter = "any" | StudentStatus;

export type StatusFilter = "all" | "live" | "upcoming" | "closed";

export type CatalogQuery = {
  status: StatusFilter;
  student: StudentFilter;
  /** ISO 3166-1 alpha-2, uppercased, or null when the filter is off */
  country: string | null;
};

export const DEFAULT_QUERY: CatalogQuery = { status: "all", student: "any", country: null };

export const STATUS_PARAM = "status";
export const STUDENT_PARAM = "student";
export const COUNTRY_PARAM = "country";

export const STUDENT_OPTIONS: { value: StudentFilter; label: string }[] = [
  { value: "any", label: "Any student status" },
  { value: "required", label: "Student status required" },
  { value: "optional", label: "Students and non-students" },
  { value: "unknown", label: "No student rule published" },
];

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "live", label: "Live now" },
  { value: "upcoming", label: "Opening soon" },
  { value: "closed", label: "Closed this cycle" },
];

export type FacetResult = {
  overall: Match;
  student: Match;
  country: Match;
  /** why the student question came out that way, in plain words */
  studentReason: string;
  /** why the country question came out that way, in plain words */
  countryReason: string;
};

const STUDENT_WORD: Record<StudentStatus, string> = {
  required: "requires student status",
  optional: "welcomes students and non-students",
  unknown: "publishes no student rule",
};

/** the facets for a program id, if this build has a detail record for it */
export function facetsOf(id: string): EligibilityFacets | undefined {
  return Object.prototype.hasOwnProperty.call(PROGRAM_DETAILS, id)
    ? PROGRAM_DETAILS[id].eligibilityFacets
    : undefined;
}

/** uppercase a two-letter country code, or null when it is not one */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function combine(...matches: Match[]): Match {
  if (matches.includes("ineligible")) return "ineligible";
  if (matches.includes("unknown")) return "unknown";
  return "eligible";
}

/**
 * Apply one query to one program's facets.
 *
 * A filter that is off ("any" / no country) counts as satisfied, so the
 * result describes the filters the reader actually applied. Callers that
 * print a badge should only do so while `facetsActive(query)` is true,
 * otherwise every card would claim "eligible" for no question.
 */
export function classify(facets: EligibilityFacets | undefined, query: CatalogQuery): FacetResult {
  let student: Match = "eligible";
  let studentReason = "No student-status filter is applied.";

  if (query.student !== "any") {
    const published = facets?.studentStatus;
    if (published === undefined || published === "unknown") {
      /* the filter can ask for exactly this: programs whose record publishes
         no student rule. It is a fact about the record, not about the reader,
         so it matches instead of reading as an eligibility claim. */
      if (query.student === "unknown") {
        student = "eligible";
        studentReason = "The record publishes no student rule, which is what this filter selects.";
      } else {
        student = "unknown";
        studentReason = "The record publishes no student rule, so this cannot be answered.";
      }
    } else if (published === query.student) {
      student = "eligible";
      studentReason = `The published rule ${STUDENT_WORD[published]}.`;
    } else {
      student = "ineligible";
      studentReason = `The published rule ${STUDENT_WORD[published]}.`;
    }
  }

  let country: Match = "eligible";
  let countryReason = "No country filter is applied.";

  if (query.country) {
    const list = facets?.countries;
    if (!Array.isArray(list) || list.length === 0) {
      country = "unknown";
      countryReason = "The record publishes no country list, so this cannot be answered.";
    } else if (list.map((c) => c.toUpperCase()).includes(query.country)) {
      country = "eligible";
      countryReason = `Listed for ${query.country}.`;
    } else {
      country = "ineligible";
      countryReason = `Not listed for ${query.country}.`;
    }
  }

  return {
    overall: combine(student, country),
    student,
    country,
    studentReason,
    countryReason,
  };
}

/** true when a facet (not the status pill) is narrowing the catalog */
export function facetsActive(query: CatalogQuery): boolean {
  return query.student !== "any" || query.country !== null;
}

/** one sentence that explains an overall classification, for a card badge */
export function reasonOf(result: FacetResult): string {
  if (result.overall === "eligible") return "Meets every eligibility filter you applied.";
  if (result.overall === "ineligible") {
    return result.student === "ineligible" ? result.studentReason : result.countryReason;
  }
  return result.student === "unknown" ? result.studentReason : result.countryReason;
}

/** how many records publish a country list at all (today: none) */
export function countryListCount(): number {
  return Object.values(PROGRAM_DETAILS).filter(
    (d) => Array.isArray(d.eligibilityFacets?.countries) && d.eligibilityFacets!.countries!.length > 0,
  ).length;
}

export type CatalogRow<T> = { program: T; result: FacetResult };

export type CatalogCounts = {
  /** cards the grid renders (ineligible ones are counted but not rendered) */
  shown: number;
  eligible: number;
  ineligible: number;
  unknown: number;
};

/**
 * The listing pipeline: the existing status pill first, then the facets.
 * Facet filters remove only programs the record marks ineligible, and keep
 * unknowns so a reader can see what is unanswerable rather than having the
 * program silently disappear. Counts cover every program that passed the
 * status pill, so the hidden ineligible ones are still reported.
 */
export function filterCatalog<T extends { id: string; status: string }>(
  programs: T[],
  query: CatalogQuery,
): { rows: CatalogRow<T>[]; counts: CatalogCounts } {
  const classified = programs
    .filter((p) => query.status === "all" || p.status === query.status)
    .map((program) => ({ program, result: classify(facetsOf(program.id), query) }));

  const rows = facetsActive(query)
    ? classified.filter(({ result }) => result.overall !== "ineligible")
    : classified;

  const counts: CatalogCounts = { shown: rows.length, eligible: 0, ineligible: 0, unknown: 0 };
  for (const { result } of classified) counts[result.overall] += 1;
  return { rows, counts };
}

/* ── the URL is the filter state ───────────────────────────────────── */

/** read status, student and country from a query string; bad values fall back */
export function readQuery(search: string): CatalogQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const status = params.get(STATUS_PARAM);
  const student = params.get(STUDENT_PARAM);
  return {
    status: STATUS_OPTIONS.some((o) => o.value === status) ? (status as StatusFilter) : "all",
    student: STUDENT_OPTIONS.some((o) => o.value === student) ? (student as StudentFilter) : "any",
    country: normalizeCountry(params.get(COUNTRY_PARAM)),
  };
}

/** the query as URLSearchParams input; defaults are omitted so links stay short */
export function queryToParams(query: CatalogQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (query.status !== "all") out[STATUS_PARAM] = query.status;
  if (query.student !== "any") out[STUDENT_PARAM] = query.student;
  if (query.country) out[COUNTRY_PARAM] = query.country;
  return out;
}

/** a full query string including `?`, or "" when nothing is filtered */
export function queryToSearch(query: CatalogQuery): string {
  const qs = new URLSearchParams(queryToParams(query)).toString();
  return qs ? `?${qs}` : "";
}
