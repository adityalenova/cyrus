/* ══ programRoster.ts — every organization that took part in a program.
   One index plus one file per program, both built by
   scripts/build-program-roster.mjs from archives that already sit on disk:

   - /data/program-roster.json is the index: per program the label, the kind of
     evidence behind it, the totals, the mentor record and the cross-program
     overlap map. Small enough to read on the directory page.
   - /data/program-roster/<id>.json holds that program's organization rows and
     is fetched only when someone opens that program.

   Evidence is always named, because the lists mean different things:
     archive  the program's own project archive, one row per accepted project
     api      an open API the program runs (GSSoC's board, 24 Pull Requests'
              wishlist, MLH's forks of upstream repositories)
     listing  a roster published without per-project counts, such as Outreachy's
              call for participation or the Season of KDE ideas page
     topics   GitHub topics on repositories we track - the honest fallback for
              programs that publish no participant list at all
   An organization links to its cyrus.ai profile when the directory has one and
   to its own official page otherwise. We never send someone to a page we did
   not build from a real record.                                          ═ */
import { useEffect, useState } from "react";
import { ORGS } from "../data/orgs";
import { topicOrgsOf } from "../data/programAssoc";

export type Evidence = "archive" | "api" | "listing" | "topics";

type RawOrg = {
  name: string;
  n: number;
  years?: number[];
  url?: string;
  category?: string;
  login?: string | null;
  also?: string[];
  listed?: string;
  registered?: boolean;
  contributors?: number;
  mentors?: number;
  githubOrgCount?: number;
  githubOrgs?: string[];
  stars?: number;
};

export type RosterOrg = RawOrg & {
  years: number[];
  url: string;
  category: string;
  login: string | null;
  to: string;
  href: string;
  evidence: Evidence;
};

export type ProgramMeta = {
  label: string;
  evidence: Evidence;
  source: string;
  note: string;
  projects: number;
  years: number[];
  withProjects: number;
  orgs: number;
  file: string;
  listingRound?: string;
  repos?: number;
  registered?: number;
  organizations?: number;
  participants?: number;
  mentors?: {
    onProjects?: number; directory?: number; registered?: number;
    listed?: number; capped?: boolean; source?: string; note?: string;
  };
};

export type Overlap = { a: number; b: number; pctA: number; pctB: number; examples: string[] };

export type LfDirectory = {
  generated: string; source: string; note: string; memberOrgs: number;
  foundations: Record<string, number>; projectTotal: number; multiFoundation: number;
  cncfNote: string;
  top: { name: string; website: string; foundations: number; tiers: string[] }[];
};

export type RosterIndexFile = {
  generated: string;
  source: string;
  note: string;
  totals: { programs: number; orgRows: number; projects: number; distinctOrgs: number; orgsInMoreThanOneProgram: number };
  lf: LfDirectory | null;
  mentors: Record<string, unknown>;
  overlaps: Record<string, Overlap>;
  programs: Record<string, ProgramMeta>;
};

/* display name / login -> our directory profile, when we have one */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const DIR = new Map<string, string>();
for (const o of ORGS) { DIR.set(norm(o.login), o.login); DIR.set(norm(o.name), o.login); }
const GITHUB = (login: string) => `https://github.com/${login}`;

function link(o: { name: string; url?: string; login?: string | null }): { login: string | null; to: string } {
  const found = DIR.get(norm(o.name));
  if (found) return { login: found, to: `/organizations/${found}` };
  const byLogin = o.login ? DIR.get(norm(o.login)) : undefined;
  if (byLogin) return { login: byLogin, to: `/organizations/${byLogin}` };
  return { login: o.login ?? null, to: o.url || (o.login ? GITHUB(o.login) : "") };
}

/* programs whose roster is an accepted-project archive */
export const ARCHIVE_IDS = ["gsoc", "lfx", "outreachy", "sob"] as const;

/* what one row of a program's record actually is, in that program's own words.
   The GSSoC board counts projects a student claimed, Season of KDE counts
   proposed ideas, 24 Pull Requests counts wishlist repositories - calling all of
   them "accepted projects" or "repositories" would be a fiction. */
export const ROSTER_UNIT: Record<string, string> = {
  gsoc: "accepted projects", lfx: "mentored projects", outreachy: "internships",
  sob: "funded projects", gssoc: "projects", "24pr": "listed repositories",
  mlh: "forked repositories", kde: "proposed ideas", oct: "Hacktoberfest repositories",
};

export function rosterUnit(id: string, evidence: Evidence | "none"): string {
  return ROSTER_UNIT[id] ?? (evidence === "archive" ? "accepted projects" : "projects");
}

/* one-time fetch of the index, shared by every page in the session */
let cache: Promise<RosterIndexFile | null> | null = null;
export function loadRosterIndex(): Promise<RosterIndexFile | null> {
  if (!cache) {
    cache = fetch("/data/program-roster.json")
      .then((r) => (r.ok ? (r.json() as Promise<RosterIndexFile>) : null))
      .catch(() => null);
  }
  return cache;
}
/** The index no longer carries organization rows; prefer useRoster(id). */
export const loadRoster = loadRosterIndex;

const shardCache = new Map<string, Promise<RawOrg[] | null>>();
function loadShard(file: string): Promise<RawOrg[] | null> {
  if (!shardCache.has(file)) {
    shardCache.set(file, fetch(`/data/${file}`)
      .then((r) => (r.ok ? r.json() as Promise<{ orgs: RawOrg[] }> : null))
      .then((j) => j?.orgs ?? null)
      .catch(() => null));
  }
  return shardCache.get(file)!;
}

/* programs with no published participant list, where the GitHub badge topics on
   the repositories we already track are the only real evidence */
export const TOPIC_ID_OF: Record<string, string> = { oct: "oct" };

function pack(o: RawOrg, evidence: Evidence): RosterOrg {
  const l = link(o);
  return {
    ...o, years: o.years ?? [], url: o.url ?? "", category: o.category ?? "",
    ...l,
    href: l.to.startsWith("/") ? l.to : l.to || (o.login ? GITHUB(o.login) : `https://github.com/search?q=${encodeURIComponent(o.name)}&type=organizations`),
    evidence,
  };
}

/** One program's organization rows, without a component. Empty when the program
    publishes no roster and we have only the shard-less topics to fall back on. */
export async function loadRosterOrgs(id: string): Promise<RosterOrg[]> {
  const meta = (await loadRosterIndex())?.programs?.[id] ?? null;
  if (!meta) return [];
  return (await loadShard(meta.file) ?? []).map((o) => pack(o, meta.evidence));
}

/** One number per program for the directory cards. */
export type RosterIndex = {
  ready: boolean;
  byId: Record<string, { orgs: number; projects: number; source: Evidence }>;
  totals: RosterIndexFile["totals"] | null;
  lf: LfDirectory | null;
  generated: string;
};

export function useRosterIndex(): RosterIndex {
  const [state, setState] = useState<RosterIndex>({ ready: false, byId: {}, totals: null, lf: null, generated: "" });
  useEffect(() => {
    let go = true;
    loadRosterIndex().then((file) => {
      if (!go) return;
      const byId: RosterIndex["byId"] = {};
      for (const [id, e] of Object.entries(file?.programs ?? {})) {
        if (e.orgs) byId[id] = { orgs: e.orgs, projects: e.projects, source: e.evidence };
      }
      for (const [id, topic] of Object.entries(TOPIC_ID_OF)) {
        if (byId[id]) continue;
        const t = topicOrgsOf(topic);
        if (t.length) byId[id] = { orgs: t.length, projects: t.reduce((s, o) => s + o.n, 0), source: "topics" };
      }
      setState({
        ready: true, byId, totals: file?.totals ?? null, lf: file?.lf ?? null,
        generated: file?.generated ?? "",
      });
    });
    return () => { go = false; };
  }, []);
  return state;
}

export type OverlapRow = { other: string; label: string; mine: number; theirs: number; pctMine: number; examples: string[] };

/** the Linux Foundation member directory, held beside the program rosters
    because it is the ~800-organization figure people mean by "LFX orgs" */
export function useLfDirectory(): LfDirectory | null {
  const [lf, setLf] = useState<LfDirectory | null>(null);
  useEffect(() => {
    let go = true;
    loadRosterIndex().then((file) => { if (go) setLf(file?.lf ?? null); });
    return () => { go = false; };
  }, []);
  return lf;
}
/** every program sharing organizations with this one, biggest share first */
export function overlapsFor(file: RosterIndexFile | null, id: string, labelOf: (other: string) => string): OverlapRow[] {
  if (!file) return [];
  const rows: OverlapRow[] = [];
  for (const [key, v] of Object.entries(file.overlaps ?? {})) {
    const [a, b] = key.split("\u0000");
    if (a === id) rows.push({ other: b, label: labelOf(b), mine: v.a, theirs: v.b, pctMine: v.pctA, examples: v.examples });
    else if (b === id) rows.push({ other: a, label: labelOf(a), mine: v.b, theirs: v.a, pctMine: v.pctB, examples: v.examples });
  }
  return rows.sort((x, y) => y.mine - x.mine);
}

/** The overlap map only, without fetching a program's organization shard. */
export function useOverlaps(id: string): OverlapRow[] {
  const [rows, setRows] = useState<OverlapRow[]>([]);
  useEffect(() => {
    let go = true;
    loadRosterIndex().then((file) => {
      if (!go) return;
      setRows(overlapsFor(file, id, (other) => file?.programs?.[other]?.label ?? other));
    });
    return () => { go = false; };
  }, [id]);
  return rows;
}

export type Roster = {
  ready: boolean;
  orgs: RosterOrg[];
  projects: number;
  years: number[];
  source: Evidence | "none";
  generated: string;
  meta: ProgramMeta | null;
  overlaps: OverlapRow[];
};

const EMPTY: Roster = { ready: false, orgs: [], projects: 0, years: [], source: "none", generated: "", meta: null, overlaps: [] };

/**
 * The roster for one program. `topicId` is the badge id used by programAssoc
 * (oct) and is only consulted when no archive, API or listing backs this program.
 */
export function useRoster(id: string, topicId?: string): Roster {
  const [state, setState] = useState<Roster>(EMPTY);

  useEffect(() => {
    let go = true;
    loadRosterIndex().then(async (file) => {
      if (!go) return;
      const meta = file?.programs?.[id] ?? null;
      const rows = meta ? await loadShard(meta.file) : null;

      if (meta && rows?.length) {
        const orgs: RosterOrg[] = rows.map((o) => pack(o, meta.evidence));
        setState({
          ready: true, orgs, projects: meta.projects, years: meta.years, source: meta.evidence,
          generated: file?.generated ?? "", meta,
          overlaps: overlapsFor(file, id, (other) => file?.programs?.[other]?.label ?? other),
        });
        return;
      }

      const topics = topicId ? topicOrgsOf(topicId) : [];
      if (topics.length) {
        const orgs: RosterOrg[] = topics.map((t) => {
          const l = link({ name: t.login, login: t.login });
          return {
            name: t.login, n: t.n, years: [2026], url: GITHUB(t.login), category: "",
            ...l, href: l.to, evidence: "topics",
          };
        });
        setState({
          ready: true, orgs, projects: orgs.reduce((s, o) => s + o.n, 0), years: [2026],
          source: "topics", generated: "", meta: null, overlaps: [],
        });
        return;
      }
      setState({ ...EMPTY, ready: true, meta });
    });
    return () => { go = false; };
  }, [id, topicId]);

  return state;
}
