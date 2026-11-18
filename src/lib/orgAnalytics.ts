/* ══ orgAnalytics.ts — the arithmetic behind the org analytics board ══
   /data/org-stats.json is one row per organization: the years it took part
   in a tracked program, the projects it credits to those programs, and the
   GitHub totals for the profile we could confirm. This module turns those
   rows into the series the board draws - activity per year, growth, top
   performers, sector and stack mix - and recomputes the same numbers for
   the block of years immediately before the selected window, so a change
   can be quoted against a period instead of implied by a shape.

   Everything here is pure: the view fetches the dataset once, the unit
   tests run on small fixtures, and nothing in this file touches fetch,
   the DOM or a database.                                        ═ */
import type { OrgStatRow } from "./orgStats";

export type RangeKey = "3y" | "5y" | "10y" | "all";

/** how many trailing years a selector offers; `null` spans the whole archive */
export const RANGES: { key: RangeKey; label: string; span: number | null }[] = [
  { key: "3y", label: "3 years", span: 3 },
  { key: "5y", label: "5 years", span: 5 },
  { key: "10y", label: "10 years", span: 10 },
  { key: "all", label: "All years", span: null },
];

/** first year a row took part in anything, 0 when it records no season */
export function firstYear(row: OrgStatRow): number {
  return row.years.length ? Math.min(...row.years) : 0;
}

/** every year mentioned by at least one row, ascending */
export function knownYears(rows: OrgStatRow[]): number[] {
  const seen = new Set<number>();
  for (const r of rows) for (const y of r.years) if (Number.isFinite(y)) seen.add(y);
  return [...seen].sort((a, b) => a - b);
}

/** the contiguous block of years a range selects, counting back from the
 *  newest year the archive has. Gaps stay in the list: a year nobody took
 *  part in is a zero on the chart, not a missing point. */
export function rangeYears(rows: OrgStatRow[], key: RangeKey): number[] {
  const all = knownYears(rows);
  if (!all.length) return [];
  const hi = all[all.length - 1];
  const span = RANGES.find((r) => r.key === key)?.span ?? null;
  const lo = span === null ? all[0] : Math.max(all[0], hi - span + 1);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** the equally long block that ends the year before `years` opens */
export function priorYears(years: number[]): number[] {
  if (!years.length) return [];
  const lo = years[0];
  const len = years[years.length - 1] - lo + 1;
  return Array.from({ length: len }, (_, i) => lo - len + i);
}

export const isActive = (row: OrgStatRow, years: number[]) => {
  for (const y of years) if (row.years.includes(y)) return true;
  return false;
};

export interface YearPoint {
  year: number;
  /** organizations taking part that year */
  orgs: number;
  /** of those, how many appear in the archive for the first time */
  newcomers: number;
  /** projects credited to the organizations active that year */
  projects: number;
}

export function yearSeries(rows: OrgStatRow[], years: number[]): YearPoint[] {
  return years.map((year) => {
    let o = 0;
    let n = 0;
    let p = 0;
    for (const r of rows) {
      if (!r.years.includes(year)) continue;
      o += 1;
      p += r.projects;
      if (firstYear(r) === year) n += 1;
    }
    return { year, orgs: o, newcomers: n, projects: p };
  });
}

export interface WindowStats {
  orgs: number;
  newcomers: number;
  projects: number;
  stars: number;
  issues: number;
  repos: number;
}

/** totals over the organizations seen anywhere inside a block of years.
 *  projects/stars/issues are lifetime figures on the row - the window says
 *  which organizations are in the sum, not that they all happened in it. */
export function statsFor(rows: OrgStatRow[], years: number[]): WindowStats {
  const t: WindowStats = { orgs: 0, newcomers: 0, projects: 0, stars: 0, issues: 0, repos: 0 };
  if (!years.length) return t;
  const lo = years[0];
  const hi = years[years.length - 1];
  for (const r of rows) {
    if (!isActive(r, years)) continue;
    t.orgs += 1;
    t.projects += r.projects;
    t.stars += r.stars;
    t.issues += r.issues;
    t.repos += r.repos;
    const first = firstYear(r);
    if (first >= lo && first <= hi) t.newcomers += 1;
  }
  return t;
}

export interface Delta {
  now: number;
  before: number;
  change: number;
  /** null when the earlier window is empty - there is no percentage of zero */
  pct: number | null;
}

export function delta(now: number, before: number): Delta {
  return { now, before, change: now - before, pct: before > 0 ? (now - before) / before : null };
}

export type Metric = "orgs" | "newcomers" | "projects" | "stars" | "issues";

/** every headline number for the window against the same length before it */
export function compare(rows: OrgStatRow[], years: number[], prev: number[]): Record<Metric, Delta> {
  const a = statsFor(rows, years);
  const b = statsFor(rows, prev);
  return {
    orgs: delta(a.orgs, b.orgs),
    newcomers: delta(a.newcomers, b.newcomers),
    projects: delta(a.projects, b.projects),
    stars: delta(a.stars, b.stars),
    issues: delta(a.issues, b.issues),
  };
}

export interface OrgSlice {
  key: string;
  name: string;
  login: string | null;
  sector: string;
  projects: number;
  stars: number;
  issues: number;
  repos: number;
  programs: number;
  /** the years inside the selected window this organization took part in */
  active: number[];
  first: number;
  /** it appears in the archive for the first time inside this window */
  isNew: boolean;
  /** its share of the projects credited to the window's organizations */
  share: number;
}

export function orgSlices(rows: OrgStatRow[], years: number[]): OrgSlice[] {
  if (!years.length) return [];
  const lo = years[0];
  const hi = years[years.length - 1];
  const out: OrgSlice[] = [];
  for (const r of rows) {
    const active = r.years.filter((y) => y >= lo && y <= hi);
    if (!active.length) continue;
    const first = firstYear(r);
    out.push({
      key: r.key, name: r.name, login: r.login, sector: r.sector,
      projects: r.projects, stars: r.stars, issues: r.issues, repos: r.repos,
      programs: r.programs.length, active, first,
      isNew: first >= lo && first <= hi, share: 0,
    });
  }
  const total = out.reduce((s, o) => s + o.projects, 0);
  if (total > 0) for (const o of out) o.share = o.projects / total;
  return out;
}

export type RankBy = "projects" | "stars" | "issues";

export function topOrgs(slices: OrgSlice[], n: number, by: RankBy = "projects"): OrgSlice[] {
  return [...slices].sort((a, b) => b[by] - a[by] || a.name.localeCompare(b.name)).slice(0, n);
}

export interface Slice {
  label: string;
  value: number;
  share: number;
}

/** group the window's organizations by sector, longest first, tail folded */
export function sectorMix(slices: OrgSlice[], keep = 7): Slice[] {
  return fold(group(slices, (s) => s.sector, (s) => s.projects), keep);
}

/** how many of the window's organizations carry each stack tag */
export function techMix(slices: OrgSlice[], rows: OrgStatRow[], keep = 8): Slice[] {
  const by = new Map(slices.map((s) => [s.key, s]));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!by.has(r.key)) continue;
    for (const t of r.techs) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const list = [...counts].map(([label, value]) => ({ label, value }));
  return fold(list.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)), keep);
}

function group(slices: OrgSlice[], keyOf: (s: OrgSlice) => string, valOf: (s: OrgSlice) => number) {
  const m = new Map<string, number>();
  for (const s of slices) {
    const k = keyOf(s);
    m.set(k, (m.get(k) ?? 0) + valOf(s));
  }
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function fold(list: { label: string; value: number }[], keep: number): Slice[] {
  const total = list.reduce((s, x) => s + x.value, 0) || 1;
  const head = list.slice(0, keep).map((x) => ({ ...x, share: x.value / total }));
  const rest = list.slice(keep).reduce((s, x) => s + x.value, 0);
  if (rest > 0) head.push({ label: "Other", value: rest, share: rest / total });
  return head;
}

export interface OrgDetail {
  slice: OrgSlice;
  programs: { id: string; projects: number; years: number[] }[];
  /** every year the archive has this organization, not just the window */
  active: number[];
  /** years between its first and last season in which it took no part */
  gaps: number[];
  /** its rank by projects inside the selected window */
  rank: number;
  of: number;
}

export function orgDetail(rows: OrgStatRow[], key: string, years: number[]): OrgDetail | null {
  const slices = orgSlices(rows, years);
  const slice = slices.find((s) => s.key === key);
  if (!slice) return null;
  const row = rows.find((r) => r.key === key)!;
  const active = [...row.years].sort((a, b) => a - b);
  const gaps: number[] = [];
  if (active.length > 1) {
    for (let y = active[0]; y <= active[active.length - 1]; y++) if (!row.years.includes(y)) gaps.push(y);
  }
  const ranked = [...slices].sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));
  return {
    slice,
    programs: row.programs.map((p) => ({ id: p.id, projects: p.projects, years: p.years })),
    active,
    gaps,
    rank: ranked.findIndex((s) => s.key === key) + 1,
    of: ranked.length,
  };
}
