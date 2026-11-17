/* ══ exportCsv.ts — client-side CSV table exporter ══════════════════ */
export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

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
