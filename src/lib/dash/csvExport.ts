/* ══ csvExport.ts — CSV serializer for tracked dashboard issues ══ */

export interface TrackedIssueCsvRow {
  repo: string;
  number: number;
  title: string;
  url: string;
  stage: string;
  lang?: string | null;
  stars?: number;
  labels?: string[];
  beginner?: boolean;
  added: string;
  updated?: string | null;
}

/**
 * Escapes a cell value according to RFC 4180 standards:
 * - Null/undefined values become empty strings.
 * - Cells containing commas, double quotes, or newlines are wrapped in double quotes.
 * - Double quotes inside values are escaped by doubling them ("").
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes an array of tracked issues into RFC 4180-compliant CSV format with CRLF line endings.
 */
export function trackedIssuesToCsv(issues: TrackedIssueCsvRow[]): string {
  const headers = [
    "Repo",
    "Number",
    "Title",
    "URL",
    "Stage",
    "Language",
    "Stars",
    "Labels",
    "Beginner",
    "Added",
    "Updated",
  ];

  const rows = issues.map((i) =>
    [
      i.repo,
      i.number,
      i.title,
      i.url,
      i.stage,
      i.lang ?? "",
      i.stars ?? 0,
      (i.labels ?? []).join("; "),
      i.beginner ? "yes" : "no",
      i.added,
      i.updated ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\r\n");
}

/** Media type for the CSV download; the charset parameter is what Excel reads. */
export const CSV_MEDIA_TYPE = "text/csv;charset=utf-8";

/**
 * Builds the CSV download blob. A leading U+FEFF byte-order mark tells Excel
 * the file is UTF-8; without it Windows decodes in the local codepage and
 * non-ASCII titles (en dashes, CJK, accented names) turn into mojibake.
 */
export function trackedIssuesCsvBlob(issues: TrackedIssueCsvRow[]): Blob {
  return new Blob(["\uFEFF" + trackedIssuesToCsv(issues)], { type: CSV_MEDIA_TYPE });
}
