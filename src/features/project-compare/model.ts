/* ══ model.ts — repository-level comparison: selection, facts, reading ═══
   /compare lines up archived *projects* (program, round, mentors). This is a
   different question: what does the repository catalog state about these
   repositories - stars, language, topics, last push, licence - and where do
   they genuinely differ? The two pages share the idea of a matrix, not a
   single row.

   Missing is not zero. The catalog reports `stars: 0` and `issues: 0` for
   real repositories, and those are facts; it reports `lang: "-"` when GitHub
   states no primary language, and that is an absence. A cell therefore
   carries `value: null` for absent and `"0"` for a real zero, and the page's
   legend says which is which.

   Two rows are derived rather than quoted, and both say so in their hint:
   difficulty is the site's star band (levelOf in src/lib/util.ts), and
   activity is last-push age against the row's own snapshot date. Mentors are
   not in the repository catalog at all, so that row is honest "Not published"
   everywhere instead of borrowing a program-project name from /compare.
   ═══════════════════════════════════════════════════════════════════════ */
import { CRAWL } from "../../data/crawlStats";
import { PROGRAM_DETAILS } from "../../data/programDetails";
import { PROGRAM_REPOS } from "../../data/programRepos";
import type { ProgramName } from "../../data/programRepos";
import { CAT_META, CATALOG, LEVEL_LABEL, levelOf, repoById } from "../../lib/util";
import type { Level, Repo } from "../../lib/types";

/** how many repositories fit beside each other before the table stops reading */
export const MAX_REPOS = 3;

/** the one query parameter the whole selection travels in */
export const REPOS_PARAM = "repos";

/** saved comparisons, in this browser only */
export const SAVED_STORAGE_KEY = "cyrus.compare.saved.v1";

/** as-of dates - every dataset on the page names one */
export const CATALOG_AS_OF = CRAWL.crawledAt; // 2026-10-21
export const PROGRAM_SHELF_AS_OF = "2026-10-03"; // header of src/data/programRepos.ts

const DAY_MS = 86_400_000;

/* Which PROGRAM_DETAILS entry a program shelf label points at. The shelf uses
   its own four labels; PROGRAM_ID_BY_NAME would also work for the full names,
   but GSSoC is spelled differently there, so the four live here explicitly. */
const DETAIL_ID_BY_PROGRAM: Record<ProgramName, string> = {
  GSoC: "gsoc",
  GSSoc: "gssoc",
  LFX: "lfx",
  Outreachy: "outreachy",
};

const SHELF_PROGRAMS = new Map<string, ProgramName[]>();
for (const r of PROGRAM_REPOS) SHELF_PROGRAMS.set(r.repo.toLowerCase(), r.programs);

/* ── one repository, as the catalog states it ────────────────────────── */
export type RepoFacts = {
  /** canonical `owner/name`, as the catalog spells it */
  key: string;
  owner: string;
  name: string;
  url: string;
  cat: string;
  category: string;
  stars: number;
  forks: number;
  issues: number;
  /** null when the catalog carries "-" / nothing - an absence, not zero */
  lang: string | null;
  license: string | null;
  /** ISO day of the last push, null when unstated */
  updated: string | null;
  /** GitHub topics, in the order the snapshot carries them */
  topics: string[];
  /** program shelf labels this repository is listed under ("GSoC", "LFX"…) */
  programs: string[];
  /** union of those programs' published stacks (src/data/programDetails.ts) */
  programStack: string[];
  /** never published per repository; kept as [] so the row can say so */
  mentors: string[];
  /** the snapshot this row's numbers came from */
  snapshot: string;
};

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s && s !== "-" ? s : null;
};

export function factsOf(repo: Repo): RepoFacts {
  const key = repo.repo;
  const programs = (repo as Repo & { programs?: ProgramName[] }).programs ?? SHELF_PROGRAMS.get(key.toLowerCase()) ?? [];
  const stack: string[] = [];
  for (const p of programs) {
    const detail = PROGRAM_DETAILS[DETAIL_ID_BY_PROGRAM[p]];
    for (const tech of detail?.stack ?? []) if (!stack.includes(tech)) stack.push(tech);
  }
  return {
    key,
    owner: key.split("/")[0] ?? key,
    name: key.split("/")[1] ?? key,
    url: repo.url || `https://github.com/${key}`,
    cat: repo.cat,
    category: CAT_META[repo.cat]?.label ?? repo.cat,
    stars: Number(repo.stars) || 0,
    forks: Number(repo.forks) || 0,
    issues: Number(repo.issues) || 0,
    lang: clean(repo.lang),
    license: clean(repo.license),
    updated: clean(repo.updated),
    topics: (repo.tags ?? []).filter(Boolean),
    programs,
    programStack: stack,
    mentors: [],
    snapshot: repo.cat === "programs" ? PROGRAM_SHELF_AS_OF : CATALOG_AS_OF,
  };
}

/* ── the table's rows ────────────────────────────────────────────────── */
export type FieldId =
  | "owner" | "category" | "stars" | "forks" | "issues" | "lang" | "license"
  | "difficulty" | "stack" | "programStack" | "mentors" | "updated" | "activity";

export type Field = {
  id: FieldId;
  label: string;
  /** how the cell is produced; printed in the legend when derived */
  hint?: string;
  derived?: boolean;
};

/** the order the page reads them in: identity, size, shape, freshness, people */
export const FIELDS: Field[] = [
  { id: "owner", label: "Organization" },
  { id: "category", label: "Catalog category" },
  { id: "stars", label: "Stars", hint: "GitHub star count in the snapshot" },
  { id: "forks", label: "Forks", hint: "GitHub fork count in the snapshot" },
  { id: "issues", label: "Open issues", hint: "Open issue count in the snapshot" },
  { id: "lang", label: "Primary language", hint: "GitHub's primary language; '-' in the catalog means none stated" },
  { id: "license", label: "Licence", hint: "The licence the catalog carries for the repository" },
  {
    id: "difficulty",
    label: "Difficulty",
    derived: true,
    hint: "Star band from levelOf(): over 50k advanced, over 10k intermediate, otherwise beginner. A catalog benchmark, not an organizer claim.",
  },
  { id: "stack", label: "Tech stack", hint: "The repository's GitHub topics as the snapshot carries them" },
  {
    id: "programStack",
    label: "Program stack",
    derived: true,
    hint: "Union of the published stacks of the mentoring programs that list this repository (src/data/programDetails.ts)",
  },
  {
    id: "mentors",
    label: "Mentors",
    derived: false,
    hint: "Mentor names are published per program project, not per repository - see /compare and /mentorship",
  },
  { id: "updated", label: "Last push", hint: "Last push date in the row's snapshot" },
  {
    id: "activity",
    label: "Activity",
    derived: true,
    hint: "Last-push age against the row's snapshot date: active up to 30 days, quiet up to 90, dormant beyond",
  },
];

/** one field for one repository: absent is null, a real zero keeps "0" */
export type Cell = { text: string; value: string | null; zero: boolean };

const absent: Cell = { text: "—", value: null, zero: false };
const stated = (text: string, value: string = text): Cell => ({ text, value, zero: false });
const counted = (n: number): Cell => ({ text: String(n), value: String(n), zero: n === 0 });

export type ActivityBand = "active" | "quiet" | "dormant";
export const ACTIVITY_META: Record<ActivityBand, { label: string; days: string }> = {
  active: { label: "Active", days: "pushed within 30 days of the snapshot" },
  quiet: { label: "Quiet", days: "31-90 days before the snapshot" },
  dormant: { label: "Dormant", days: "more than 90 days before the snapshot" },
};

/** last-push age against the row's snapshot; null when no date is stated */
export function activityOf(updated: string | null, asOf: string): { band: ActivityBand; days: number } | null {
  if (!updated) return null;
  const a = Date.parse(`${updated}T00:00:00Z`);
  const b = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const days = Math.max(0, Math.round((b - a) / DAY_MS));
  return { band: days <= 30 ? "active" : days <= 90 ? "quiet" : "dormant", days };
}

export function cellOf(id: FieldId, r: RepoFacts): Cell {
  switch (id) {
    case "owner": return stated(r.owner);
    case "category": return stated(r.category);
    case "stars": return counted(r.stars);
    case "forks": return counted(r.forks);
    case "issues": return counted(r.issues);
    case "lang": return r.lang ? stated(r.lang) : absent;
    case "license": return r.license ? stated(r.license) : absent;
    case "difficulty": {
      const level: Level = levelOf(r.stars);
      return stated(LEVEL_LABEL[level], level);
    }
    case "stack": return r.topics.length
      ? stated(r.topics.join(", "), r.topics.map((t) => t.toLowerCase()).sort().join("|"))
      : absent;
    case "programStack": return r.programStack.length
      ? stated(r.programStack.join(", "), [...r.programStack].map((t) => t.toLowerCase()).sort().join("|"))
      : absent;
    case "mentors": return absent;
    case "updated": return r.updated ? stated(r.updated) : absent;
    case "activity": {
      const a = activityOf(r.updated, r.snapshot);
      return a ? stated(`${ACTIVITY_META[a.band].label} · ${a.days}d`, a.band) : absent;
    }
  }
}

export type Match = "same" | "differs" | "unknown";

export type MatrixRow = {
  id: FieldId;
  label: string;
  hint?: string;
  derived?: boolean;
  cells: Cell[];
  /** all stated and equal / split (including a partially stated row) / nobody states it */
  kind: Match;
};

/**
 * Compare one field across the selection. A cell one repository states and
 * another omits is not "the same" - it is a difference in what is known, and
 * it lands in "differs" so the reader can see the gap. "unknown" is reserved
 * for a field no selected repository states at all.
 */
export function compareField(field: Field, rows: readonly RepoFacts[]): MatrixRow {
  const cells = rows.map((r) => cellOf(field.id, r));
  const known = cells.filter((c) => c.value !== null);
  let kind: Match = "unknown";
  if (known.length > 0) {
    const partial = known.length !== cells.length;
    const first = known[0].value!.toLowerCase();
    kind = !partial && known.every((c) => c.value!.toLowerCase() === first) ? "same" : "differs";
  }
  return { id: field.id, label: field.label, hint: field.hint, derived: field.derived, cells, kind };
}

export function buildMatrix(rows: readonly RepoFacts[], fields: readonly Field[] = FIELDS): MatrixRow[] {
  return fields.map((f) => compareField(f, rows));
}

export const sharedRows = (matrix: readonly MatrixRow[]): MatrixRow[] => matrix.filter((r) => r.kind === "same");
export const differingRows = (matrix: readonly MatrixRow[]): MatrixRow[] => matrix.filter((r) => r.kind === "differs");

/* ── selection: ?repos=owner/name,owner/name ─────────────────────────── */
/**
 * Normalise one repository reference: a GitHub URL, a trailing slash or .git,
 * or stray whitespace all fold to `owner/name`; anything that is not exactly
 * two path segments is refused.
 */
export function normalizeRepoKey(raw: string): string {
  const s = (raw ?? "").trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length !== 2) return "";
  const ok = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(parts[0]) && /^[A-Za-z0-9._-]{1,100}$/.test(parts[1]);
  return ok ? `${parts[0]}/${parts[1]}` : "";
}

/**
 * Read the selection out of a search string. Repeated `repos=` params and a
 * single comma-separated value are both accepted, because the same address
 * may be hand-edited; blanks and duplicates are dropped, the first spelling
 * wins, and anything past MAX_REPOS is ignored rather than reordering the page.
 */
export function selectionFromSearch(search: string): string[] {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of sp.getAll(REPOS_PARAM)) {
    for (const part of raw.split(",")) {
      const key = normalizeRepoKey(part);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(key);
      if (out.length >= MAX_REPOS) return out;
    }
  }
  return out;
}

/** `repos=owner/name,...` with the slashes left readable in the address */
export function selectionToQuery(keys: readonly string[]): string {
  const clean = keys.map(normalizeRepoKey).filter(Boolean).slice(0, MAX_REPOS);
  if (!clean.length) return "";
  const value = clean.map((k) => k.split("/").map(encodeURIComponent).join("/")).join(",");
  return `${REPOS_PARAM}=${value}`;
}

export function compareHref(keys: readonly string[]): string {
  const qs = selectionToQuery(keys);
  return qs ? `/projects/compare?${qs}` : "/projects/compare";
}

/**
 * Add a repository, or take it back out. At the cap a new pick is refused -
 * the caller says "remove one first" - rather than silently dropping a column
 * the visitor may still be reading.
 */
export function toggleKey(keys: readonly string[], raw: string): string[] {
  const key = normalizeRepoKey(raw);
  const current = keys.map(normalizeRepoKey).filter(Boolean);
  if (!key) return current;
  if (current.some((k) => k.toLowerCase() === key.toLowerCase())) {
    return current.filter((k) => k.toLowerCase() !== key.toLowerCase());
  }
  if (current.length >= MAX_REPOS) return current;
  return [...current, key];
}

export function isFull(keys: readonly string[]): boolean {
  return keys.length >= MAX_REPOS;
}

/** map selection onto loaded rows; a stale key becomes `missing`, not a blank column */
export function resolveFacts(keys: readonly string[], catalog: readonly Repo[] = CATALOG): { rows: RepoFacts[]; missing: string[] } {
  const byKey = new Map<string, Repo>();
  for (const r of catalog) {
    const k = r.repo.toLowerCase();
    if (!byKey.has(k)) byKey.set(k, r);
  }
  const rows: RepoFacts[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const key = normalizeRepoKey(raw);
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    const hit = byKey.get(key.toLowerCase());
    if (hit) rows.push(factsOf(hit));
    else missing.push(key);
  }
  return { rows, missing };
}

/* ── the picker ──────────────────────────────────────────────────────── */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Candidates for the picker: catalog repositories not already selected,
 * ranked so a name that starts with the term beats an incidental topic or
 * description hit. With no term the pool is the catalog's biggest repos.
 */
export function searchRepos(term: string, selected: readonly string[] = [], limit = 10, catalog: readonly Repo[] = CATALOG): RepoFacts[] {
  const q = norm(term);
  const taken = new Set(selected.map((k) => k.toLowerCase()));
  const pool = catalog.filter((r) => !taken.has(r.repo.toLowerCase()));
  if (!q) {
    return pool.slice().sort((a, b) => b.stars - a.stars).slice(0, limit).map(factsOf);
  }
  const scored = pool.map((r) => {
    const repo = norm(r.repo);
    const name = norm(r.repo.split("/")[1] ?? r.repo);
    const topics = norm((r.tags ?? []).join(" "));
    const desc = norm(r.desc ?? "");
    let score = 0;
    if (repo.startsWith(q) || name.startsWith(q)) score = 4;
    else if (repo.includes(q)) score = 3;
    else if (topics.includes(q)) score = 2;
    else if (desc.includes(q)) score = 1;
    return { r, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || b.r.stars - a.r.stars);
  return scored.slice(0, limit).map((s) => factsOf(s.r));
}

/* ── saved comparisons ───────────────────────────────────────────────── */
export type SavedComparison = { id: string; name: string; repos: string[]; savedAt: string };

export const SAVED_NAME_MAX = 60;

export function comparisonNameError(name: string): string | null {
  const n = name.trim();
  if (!n) return "Give this comparison a name.";
  if (n.length > SAVED_NAME_MAX) return `Keep the name under ${SAVED_NAME_MAX} characters.`;
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** tolerant read: a hand-edited or older row is dropped instead of rendered */
export function parseSavedComparisons(raw: unknown): SavedComparison[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedComparison[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const repos = Array.isArray(r.repos)
      ? [...new Set(r.repos.filter((x): x is string => typeof x === "string").map(normalizeRepoKey).filter(Boolean))].slice(0, MAX_REPOS)
      : [];
    if (!name || comparisonNameError(name) || !repos.length) continue;
    const id = typeof r.id === "string" && r.id ? r.id : `cmp-${slug(name)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: name.slice(0, SAVED_NAME_MAX),
      repos,
      savedAt: typeof r.savedAt === "string" && !Number.isNaN(Date.parse(r.savedAt))
        ? r.savedAt
        : new Date(0).toISOString(),
    });
  }
  return out;
}

export type SaveResult =
  | { ok: true; list: SavedComparison[]; entry: SavedComparison }
  | { ok: false; error: string };

export function saveComparison(list: readonly SavedComparison[], name: string, repos: readonly string[], now: number = Date.now()): SaveResult {
  const error = comparisonNameError(name);
  if (error) return { ok: false, error };
  const keys = [...new Set(repos.map(normalizeRepoKey).filter(Boolean))].slice(0, MAX_REPOS);
  if (!keys.length) return { ok: false, error: "Choose at least one repository, then save." };
  const entry: SavedComparison = {
    id: `cmp-${now.toString(36)}-${slug(name) || "compare"}`,
    name: name.trim().slice(0, SAVED_NAME_MAX),
    repos: keys,
    savedAt: new Date(now).toISOString(),
  };
  return { ok: true, list: [entry, ...list.filter((c) => c.id !== entry.id)], entry };
}

export function removeComparison(list: readonly SavedComparison[], id: string): SavedComparison[] {
  return list.filter((c) => c.id !== id);
}

/** one lookup for a picker row's display, without importing the catalog twice */
export const factsByKey = (key: string): RepoFacts | null => {
  const r = repoById(normalizeRepoKey(key));
  return r ? factsOf(r) : null;
};
