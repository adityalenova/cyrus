/* ══ programProjects.ts — the per-program project archive ═══════════════
   Every mentored program we track is asked the same question: can you show
   the work you accepted? The answer is a shard on disk, and the index that
   lists them is written by scripts/build-program-projects.mjs - a build step
   that reads each program's own published record and stops when a program
   publishes none. Nothing here invents a row.

   Files:
     /data/program-projects/index.json    every program that has an archive
     /data/program-projects/<id>.json     up to 400 of its real project rows
     /data/gsoc-projects.json             the big GSoC export (5,238 rows)
     /data/otherProjects.json             LFX, Outreachy, Summer of Bitcoin

   Two consumers:
     - /projects folds in the shards that are NOT already in the big exports,
       so no project is counted twice (IN_BIG_ARCHIVES);
     - /programs/:id opens its own program's shard and prints the source line
       the build step wrote, so a card always says where it came from.

   A program with no archive is not an error, it is an honest gap - Eclipse
   SoC's soc.eclipse.to does not resolve from here, MLH names no project
   table - and the page says so instead of rendering an empty grid.     ═ */
import { useEffect, useState } from "react";

/* ── what the build step writes ─────────────────────────────────────── */
export type ShardRow = {
  title: string;
  org: string;
  orgLogin?: string | null;
  url?: string | null;
  year?: number | null;
  lang?: string | null;
  stars?: number | null;
  desc?: string | null;
  techs?: string[] | null;
  mentors?: string[] | null;
  /** what the program itself calls the round or cohort this row sits in */
  season?: string | null;
};

export type ArchiveShard = {
  program: string;
  label: string;
  source: string;
  evidence?: string;
  url?: string;
  note?: string;
  /** one row is a …, in the program's own words ("fellowship projects") */
  unit?: string | null;
  generated?: string;
  years?: number[];
  /** rows this shard carries - the build caps it at 400 */
  rows?: number;
  capped?: boolean;
  projects: ShardRow[] | number;
  /** the shape scripts/build-program-projects.mjs writes: `projects` is a count
      and the rows sit in `list` under shorthand keys. Read by shardRows(). */
  list?: Record<string, unknown>[];
};

export type ArchiveEntry = {
  label: string;
  source: string;
  evidence?: string;
  url?: string;
  /** rows in the program's own full record, never the capped number */
  projects: number;
  /** rows this shard actually holds */
  rows?: number;
  capped?: boolean;
  years: number[];
  orgs?: number;
  withUrl?: number;
  unit?: string | null;
  file: string | null;
};

export type ArchiveIndex = {
  generated: string;
  note: string;
  programs: Record<string, ArchiveEntry>;
};

/* ── the normalised row every page can render ───────────────────────── */
export type ArchiveRow = {
  key: string;
  id: string;
  title: string;
  org: string;
  orgUrl: string;
  program: string;
  year: number;
  tags: string[];
  body: string;
  mentor: string;
  url: string;
  stars: number;
  lang: string;
  season: string;
};

export type ArchiveSummary = {
  label: string;
  /** the exact string /projects?prog= matches for this program */
  filter: string;
  projects: number;
  years: number[];
  orgs: number;
  source: string;
  evidence: string;
  url: string;
  /** what one row is, in the program's own words */
  unit: string;
  /** rows actually in the shard - the build caps it at 400 */
  loaded: number;
  /** season counts read off the rows this page holds */
  byYear: Record<number, number>;
};

/* the four ids whose full archives /projects already fetch on its own;
   loading their shards too would show the same project twice */
const IN_BIG_ARCHIVES = new Set(["gsoc", "lfx", "outreachy", "sob"]);

/* /projects labels the rows of those four by their short program name, because
   that is the string the big archives carry. A deep link has to use the same
   word or the listing opens empty, so the mapping lives here rather than in
   whichever page happens to build the link. */
const BIG_ARCHIVE_FILTER: Record<string, string> = {
  gsoc: "GSoC", lfx: "LFX", outreachy: "Outreachy", sob: "Summer of Bitcoin",
};
export const filterNameOf = (id: string, label: string) => BIG_ARCHIVE_FILTER[id] ?? label;

let indexPromise: Promise<ArchiveIndex | null> | null = null;
export function loadArchiveIndex(): Promise<ArchiveIndex | null> {
  if (!indexPromise) {
    indexPromise = fetch("/data/program-projects/index.json")
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveIndex>) : null))
      .catch(() => null);
  }
  return indexPromise;
}

/* Just the index, as a hook: which programs have an archive and what the
   /projects listing calls each one. A page that only needs to build a
   ?prog= link uses this instead of useProjectArchives(), which pulls every
   shard on disk to hand back rows it will not read. */
export function useArchiveIndex(): ArchiveIndex | null {
  const [idx, setIdx] = useState<ArchiveIndex | null>(null);
  useEffect(() => {
    let go = true;
    loadArchiveIndex().then((d) => { if (go) setIdx(d); });
    return () => { go = false; };
  }, []);
  return idx;
}

const shardCache = new Map<string, Promise<ArchiveShard | null>>();

export function loadShard(id: string): Promise<ArchiveShard | null> {
  if (!shardCache.has(id)) {
    shardCache.set(id, fetch(`/data/program-projects/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveShard>) : null))
      .catch(() => null));
  }
  return shardCache.get(id)!;
}

/** Two builds have written these files. One puts full rows in `projects`; the
 *  other puts a count in `projects` and shorthand rows (y/t/o/b/tt/tp/m/s) in
 *  `list`. Read either, so a rebuild in the older shape can never hand a page a
 *  number where rows belong - which is exactly how eight of twelve program
 *  detail pages went blank. */
function legacyRow(p: Record<string, unknown>): ShardRow {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") as string[] : []);
  return {
    title: str(p.t ?? p.title),
    org: str(p.o ?? p.org),
    orgLogin: typeof p.orgLogin === "string" ? p.orgLogin : null,
    url: typeof p.url === "string" ? p.url : null,
    year: typeof p.y === "number" ? p.y : (typeof p.year === "number" ? p.year : null),
    lang: typeof p.lang === "string" ? p.lang : null,
    stars: typeof p.stars === "number" ? p.stars : null,
    desc: str(p.b ?? p.desc),
    season: str(p.s ?? p.season) || null,
    techs: [...arr(p.tt), ...arr(p.tp), ...arr(p.techs)],
    mentors: typeof p.m === "string" && p.m ? p.m.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
  };
}

/** the rows a shard carries, whatever shape the file on disk uses */
export function shardRows(sh: ArchiveShard | null): ShardRow[] {
  if (!sh) return [];
  if (Array.isArray(sh.projects)) return sh.projects;
  if (Array.isArray(sh.list)) return sh.list.map(legacyRow);
  return [];
}

/** one shard row -> one renderable project */function toRow(id: string, label: string, p: ShardRow, i: number): ArchiveRow {
  const repo = p.orgLogin ? `https://github.com/${p.orgLogin}` : "";
  return {
    key: `${id}-${p.url ?? p.title}-${i}`,
    id,
    title: p.title,
    org: p.org,
    orgUrl: repo || `https://github.com/search?q=${encodeURIComponent(p.org)}&type=organizations`,
    program: label,
    year: p.year ?? 0,
    tags: (p.techs ?? []).slice(0, 4),
    body: p.desc ?? "",
    mentor: (p.mentors ?? []).join(", "),
    url: p.url ?? repo ?? `https://github.com/search?q=${encodeURIComponent(p.title)}`,
    stars: p.stars ?? 0,
    lang: p.lang ?? "",
    season: p.season ?? "",
  };
}

/** Rows for /projects: shards only, never the ones the big exports cover. */
export async function loadShardRows(): Promise<ArchiveRow[]> {
  const index = await loadArchiveIndex();
  const entries = Object.entries(index?.programs ?? {}).filter(
    ([id, e]) => e?.file && !IN_BIG_ARCHIVES.has(id),
  );
  const shards = await Promise.all(entries.map(([id]) => loadShard(id)));
  const rows: ArchiveRow[] = [];
  shards.forEach((sh, i) => {
    if (!sh) return;
    const id = entries[i][0];
    shardRows(sh).forEach((p, k) => rows.push(toRow(id, sh.label, p, k)));
  });
  return rows;
}

/** One program's own archive, for its detail page. */
export async function loadProgramArchive(id: string):
  Promise<{ entry: ArchiveEntry; rows: ArchiveRow[] } | null> {
  const index = await loadArchiveIndex();
  const entry = index?.programs?.[id];
  if (!entry?.file) return null;
  const shard = await loadShard(id);
  return { entry, rows: shardRows(shard).map((p, i) => toRow(id, entry.label, p, i)) };
}

/** Every archived program as headline numbers, big archives included. */
export async function loadSummaries(): Promise<Record<string, ArchiveSummary>> {
  const index = await loadArchiveIndex();
  const out: Record<string, ArchiveSummary> = {};
  for (const [id, e] of Object.entries(index?.programs ?? {})) {
    if (!e?.file) continue;
    const shard = await loadShard(id);
    const byYear: Record<number, number> = {};
    const rows = shardRows(shard);
    for (const p of rows) {
      const y = p.year ?? 0;
      byYear[y] = (byYear[y] ?? 0) + 1;
    }
    out[id] = {
      label: e.label,
      filter: filterNameOf(id, e.label),
      projects: e.projects,
      years: e.years ?? [],
      orgs: e.orgs ?? 0,
      source: e.source,
      evidence: e.evidence ?? "",
      url: e.url ?? "",
      unit: e.unit ?? "",
      loaded: rows.length,
      byYear,
    };
  }
  return out;
}

export type State = {
  ready: boolean;
  rows: ArchiveRow[];
  summaries: Record<string, ArchiveSummary>;
  /** programs we track that publish no project archive, and why */
  gaps: { id: string; label: string; reason: string }[];
};

const EMPTY: State = { ready: false, rows: [], summaries: {}, gaps: [] };

/**
 * The whole archive in one hook. Pass the tracked program list
 * (src/data/orgs.ts PROGRAMS) and any program missing from the index comes
 * back as a gap with its name, so a page can say so instead of showing an
 * empty grid. Without it, gaps are the index ids with no shard.
 */
export function useProjectArchives(tracked?: { id: string; name: string }[]): State {
  const [state, setState] = useState<State>(EMPTY);
  const key = tracked?.map((t) => `${t.id}:${t.name}`).join(",") ?? "";
  useEffect(() => {
    let go = true;
    const ids = tracked ? tracked.map((t) => t.id) : undefined;
    const named = new Map((tracked ?? []).map((t) => [t.id, t.name]));
    Promise.all([loadShardRows(), loadSummaries(), loadArchiveIndex()])
      .then(([rows, summaries, index]) => {
        if (!go) return;
        const want = ids ?? Object.keys(index?.programs ?? {});
        const gaps = want
          .filter((id) => !summaries[id])
          .map((id) => ({
            id,
            label: named.get(id) ?? index?.programs?.[id]?.label ?? id,
            reason: index
              ? "publishes no per-project archive we can read"
              : "archive index unavailable",
          }));
        setState({ ready: true, rows, summaries, gaps });
      });
    return () => { go = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** How many programs have a real archive, and the projects across them. */
export function archiveTotals(summaries: Record<string, ArchiveSummary>) {
  const all = Object.values(summaries);
  return {
    programs: all.length,
    projects: all.reduce((s, r) => s + r.projects, 0),
    orgs: all.reduce((s, r) => s + (r.orgs || 0), 0),
  };
}

export { IN_BIG_ARCHIVES };
