/* ══ exportCsv.ts — client-side CSV table exporter ══════════════════
   Builds the file in the page and hands it to the browser as a download:
   no server route, no upload, so what the user is looking at is exactly what
   lands in the file. Every cell is quoted (see escapeField in exportToCsv),
   which is what keeps a header like `Forks, repos` from splitting a row. ══ */

/**
 * One column of the export: the header cell plus how to read that cell off a
 * row. The accessor returns a primitive because every value is stringified and
 * quoted before it is written, so formatting happens in the caller.
 *
 * @typeParam T - row type being exported.
 */
export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

/**
 * Download `data` as a CSV file with `columns` for the header.
 *
 * Runs entirely in the browser: it builds a Blob, clicks a hidden anchor and
 * revokes the object URL again. Rows are separated by CRLF and every field is
 * wrapped in double quotes with inner quotes doubled, so commas and newlines
 * inside a value survive a round-trip through a spreadsheet. `null` and
 * `undefined` cells become an empty quoted string.
 *
 * Nothing is written when `data` is empty or missing — callers disable the
 * button in that state rather than getting a header-only file.
 *
 * @typeParam T - row type being exported.
 * @param data - rows to write, in the order they should appear.
 * @param columns - header and accessor per output column, in order.
 * @param filename - download name; defaults to `"cyrus-export.csv"`.
 * @returns nothing. The file arrives through the browser's download handling.
 * @throws {TypeError} if called where `Blob`, `URL.createObjectURL` or
 *   `document` does not exist, i.e. during server rendering — call it from an
 *   event handler or an effect, never at module scope.
 * @example
 * exportToCsv(
 *   [{ name: "GSoC", projects: 42 }],
 *   [
 *     { header: "Program", accessor: (r) => r.name },
 *     { header: "Projects", accessor: (r) => r.projects },
 *   ],
 *   "programs.csv",
 * ); // downloads a two-line programs.csv
 */
export function exportToCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename = "cyrus-export.csv"
) {
  if (!data || data.length === 0) return;

  const escapeField = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = columns.map((c) => escapeField(c.header)).join(",");
  const rows = data.map((item) =>
    columns.map((col) => escapeField(col.accessor(item))).join(",")
  );

  const csvContent = [headerRow, ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
