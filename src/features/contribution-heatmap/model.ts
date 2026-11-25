/* ══ contribution-heatmap/model.ts — heatmap calendar grid math ══ */

export type Density = "none" | "low" | "medium" | "high";

export interface DayCell {
  date: string;        // YYYY-MM-DD
  count: number;
  density: Density;
  weekday: number;     // 0=Sun .. 6=Sat
  weekIndex: number;   // 0-based column
}

export interface HeatmapGrid {
  cells: DayCell[];
  weeks: number;
  totalContributions: number;
  longestStreak: number;
  currentStreak: number;
}

export function density(count: number): Density {
  if (count <= 0) return "none";
  if (count <= 2) return "low";
  if (count <= 5) return "medium";
  return "high";
}

export function isoDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function buildGrid(counts: Record<string, number>, endDate: string, weeks: number = 52): HeatmapGrid {
  const end = new Date(endDate + "T00:00:00Z");
  const totalDays = weeks * 7;
  const start = new Date(end.getTime() - (totalDays - 1) * 86400000);
  const cells: DayCell[] = [];
  let total = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let runStreak = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = isoDate(d);
    const c = counts[iso] || 0;
    total += c;
    if (c > 0) { runStreak++; longestStreak = Math.max(longestStreak, runStreak); }
    else { runStreak = 0; }
    cells.push({
      date: iso,
      count: c,
      density: density(c),
      weekday: d.getUTCDay(),
      weekIndex: Math.floor(i / 7),
    });
  }
  currentStreak = runStreak;
  return { cells, weeks, totalContributions: total, longestStreak, currentStreak };
}

export function monthLabels(cells: DayCell[]): { label: string; weekIndex: number }[] {
  const labels: { label: string; weekIndex: number }[] = [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let lastMonth = -1;
  for (const c of cells) {
    if (c.weekday !== 0) continue;
    const m = new Date(c.date + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth) { labels.push({ label: months[m], weekIndex: c.weekIndex }); lastMonth = m; }
  }
  return labels;
}

export const DENSITY_COLORS: Record<Density, string> = {
  none: "#161b22",
  low: "#0e4429",
  medium: "#006d32",
  high: "#26a641",
};
