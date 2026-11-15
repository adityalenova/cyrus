/* ══ contriboOrgs.ts — the organization directory for one program ══════
   Two independent records name the organizations that take part in a program:

   - our own archive (`/data/program-roster/<id>.json`, built by
     scripts/build-program-roster.mjs from the program's published project
     archive, API or participant list) - it carries the participation counts
     and the years, and it is what the program pages have shown so far;
   - Contribo's open API (`/data/contribo-orgs/<id>.json`, fetched by
     scripts/fetch-contribo-orgs.mjs) - it carries the logo, the blurb, the
     organization's own category and the technologies and years it listed.

   This module reads both and merges them on the organization name, so a
   program page shows one card per organization with everything either record
   knows about it. Nothing is invented to fill a gap: an organization that
   only appears in our archive has no blurb and no technology chips, and one
   whose record carries no category falls to "Other" in the sector filter.

   Programs whose Contribo rows are per-project (LFX Mentorship, Summer of
   Bitcoin) were folded up to the foundations that hosted them before being
   written to disk, so a card is always an organization and never a project
   title wearing an organization's clothes.                                    ═ */
import { useEffect, useState } from "react";
import { ORGS } from "../data/orgs";
import { loadRosterOrgs, type RosterOrg } from "./programRoster";
import { normalizeTechs, sectorOf, techRank, type Sector } from "./orgTaxonomy";

export type ContriboOrg = {
  name: string;
  slug: string | null;
  logo: string | null;
  desc: string | null;
  site: string | null;
  sector: string | null;
  techs: string[];
  topics: string[];
  years: number[];
  projects: number;
};

export type ContriboShard = {
  program: string;
  contriboSlug: string;
  rowKind: "org" | "project";
  orgs: ContriboOrg[];
  projectRows?: number;
};

export type ContriboProgram = {
  contriboSlug: string;
  rowKind: "org" | "project";
  orgs: number;
  projects: number;
  logos: number;
  techs: number;
};

/** What one program's merged organization list contains. Written by
    scripts/contribo-summary.mjs, which runs this same merge code over the
    files on disk, so a number on the directory page is exactly the number the
    explorer for that program shows. */
export type ProgramStats = {
  orgs: number;
  projects: number;
  years: number;
  techs: number;
  sectors: number;
  logos: number;
  profiles: number;
  from: string;
};

export type ContriboIndexFile = {
  generated: string;
  source: string;
  note: string;
  programs: Record<string, ContriboProgram>;
  stats?: Record<string, ProgramStats>;
  statsGenerated?: string;
};

/** One organization on a program page, merged from both records. */
export type ProgramOrg = {
  key: string;
  name: string;
  logo: string;
  desc: string;
  site: string;
  sector: Sector;
  techs: string[];
  years: number[];
  projects: number;
  /** the GitHub login behind this row when our directory or the record has one */
  login: string | null;
  /** in-site profile when we track it on GitHub, otherwise the outside page */
  to: string;
  inSite: boolean;
  stars: number;
  repos: number;
  issues: number;
  /** the logo the program publishes for this organization, not our fallback */
  branded: boolean;
  from: ("archive" | "contribo")[];
};

export type ProgramOrgs = {
  ready: boolean;
  rows: ProgramOrg[];
  projects: number;
  years: number[];
  techs: [string, number][];
  sectors: [Sector, number][];
  contribo: ContriboProgram | null;
  generated: string;
  /** "orgs" - the rows are organizations. "areas" - the program publishes no
   *  organization roster at all, and these rows are its project areas. */
  kind: "orgs" | "areas";
};

/* Season of KDE publishes an ideas list on the KDE wiki, grouped by the area a
   project falls under - "Accessibility", "Games", "Plasma", "Sustainability 1".
   Those are not host organizations, and no amount of merging turns them into
   ones: the program simply has no organization roster. The explorer keeps the
   rows, because the areas are real and the counts are real, and labels them
   for what they are instead of dressing them up as organizations. */
const AREA_ONLY = new Set(["kde"]);

/** True when a program's participant rows are project areas rather than host
 *  organizations, so any page that counts them can name them correctly. */
export const publishesAreas = (id: string) => AREA_ONLY.has(id);

/* ── name keys ─────────────────────────────────────────────────────────── */
/* Programs spell the same organization several ways ("CNCF", "Cloud Native
   Computing Foundation (CNCF)", "The Blender Institute"). Fold to the
   alphanumeric core and drop the legal suffixes so two records can meet. */
const SUFFIX = /\b(inc|llc|ltd|coop|organization|organisation|the)\b/gi;
export const orgKey = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(SUFFIX, " ").replace(/\s+/g, " ").trim();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* display name / login -> our tracked directory profile, with its live stats */
const BY_NAME = new Map<string, (typeof ORGS)[number]>();
for (const o of ORGS) { BY_NAME.set(norm(o.login), o); BY_NAME.set(norm(o.name), o); }

const stripTags = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const asUrl = (s: string) =>
  !s ? "" : /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+/.test(s) ? `https://${s.replace(/^www\./, "")}` : "";

const avatar = (login: string) => `https://github.com/${login}.png?size=96`;

/* ── one-time fetches, shared for the session ──────────────────────────── */
let idxPromise: Promise<ContriboIndexFile | null> | null = null;
export function loadContriboIndex(): Promise<ContriboIndexFile | null> {
  if (!idxPromise) {
    idxPromise = fetch("/data/contribo-orgs.json")
      .then((r) => (r.ok ? (r.json() as Promise<ContriboIndexFile>) : null))
      .catch(() => null);
  }
  return idxPromise;
}

const shardCache = new Map<string, Promise<ContriboShard | null>>();
function loadShard(id: string): Promise<ContriboShard | null> {
  if (!shardCache.has(id)) {
    shardCache.set(id, fetch(`/data/contribo-orgs/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ContriboShard>) : null))
      .catch(() => null));
  }
  return shardCache.get(id)!;
}

/** Merge one program's Contribo rows over our archive rows, name by name.
    `rowKind` is "project" for programs whose Contribo rows are per-project
    (LFX, Summer of Bitcoin); there the logo field is whatever the projects
    used, not the host's mark, so it is dropped and the GitHub account is
    used instead. */
export function mergeProgramOrgs(contribo: ContriboOrg[], archive: RosterOrg[], rowKind: "org" | "project" = "org"): ProgramOrg[] {
  const out = new Map<string, ProgramOrg>();

  const blank = (name: string): ProgramOrg => ({
    key: orgKey(name) || name.toLowerCase(), name, logo: "", desc: "", site: "",
    sector: "Other", techs: [], years: [], projects: 0, login: null, to: "", inSite: false,
    stars: 0, repos: 0, issues: 0, branded: false, from: [],
  });

  for (const c of contribo) {
    if (!c.name) continue;
    const row = out.get(orgKey(c.name)) ?? blank(c.name);
    row.name = c.name;
    if (c.logo && rowKind === "org") { row.logo = c.logo; row.branded = true; }
    if (c.desc) row.desc = stripTags(c.desc);
    if (c.site) row.site = asUrl(c.site);
    row.techs = normalizeTechs([...(c.techs ?? []), ...(c.topics ?? [])]);
    row.years = [...new Set([...row.years, ...(c.years ?? [])])].sort((a, b) => b - a);
    row.projects = Math.max(row.projects, c.projects ?? 0);
    row.sector = c.sector ? sectorOf(c.sector, ...c.topics.slice(0, 8)) : row.sector;
    if (!row.from.includes("contribo")) row.from.push("contribo");
    out.set(row.key, row);
  }

  /* our archive rows carry the participation counts and the GitHub logins, so
     they fill the holes rather than overwrite what the program already said */
  for (const a of archive) {
    if (!a.name) continue;
    const row = out.get(orgKey(a.name)) ?? blank(a.name);
    row.name = row.name && row.name.length >= a.name.length ? row.name : a.name;
    row.projects = Math.max(row.projects, a.n ?? 0);
    row.years = [...new Set([...row.years, ...(a.years ?? [])])].sort((x, y) => y - x);
    if (!row.site && a.url && /^https?:/i.test(a.url)) row.site = a.url;
    if (row.sector === "Other") row.sector = sectorOf(a.category, row.desc);
    if (a.login) row.login = row.login ?? a.login;
    if (!row.from.includes("archive")) row.from.push("archive");
    out.set(row.key, row);
  }

  /* last pass: attach the live GitHub identity - profile link, logo, stats */
  const rows = [...out.values()];
  for (const r of rows) {
    const dir = BY_NAME.get(norm(r.login ?? "")) ?? BY_NAME.get(norm(r.name));
    if (dir) {
      r.login = dir.login;
      r.inSite = true;
      r.to = `/organizations/${dir.login}`;
      r.stars = dir.stars;
      r.repos = dir.repos;
      r.issues = dir.issues;
      if (!r.sector || r.sector === "Other") r.sector = sectorOf(r.desc, ...r.techs.slice(0, 6));
    }
    /* the organization's own account image beats a third-party icon set: it is
       what they uploaded, and it cannot miss the way simpleicons does for a
       brand it has never heard of */
    if (r.login) r.logo = avatar(r.login);
    r.branded = !!r.logo;
    if (!r.to) r.to = r.site || (r.login ? `https://github.com/${r.login}` : `https://github.com/search?q=${encodeURIComponent(r.name)}&type=organizations`);
    if (!r.sector) r.sector = "Other";
  }

  return rows.sort((a, b) => b.projects - a.projects || b.stars - a.stars || a.name.localeCompare(b.name));
}

export async function loadProgramOrgs(id: string): Promise<ProgramOrgs> {
  /* the index is the only place that knows which programs have a shard, so a
     program with no Contribo record never asks for a file that is not there */
  const index = await loadContriboIndex();
  const [contribo, archive] = await Promise.all([
    index?.programs?.[id] ? loadShard(id) : Promise.resolve(null),
    loadRosterOrgs(id),
  ]);
  const rows = mergeProgramOrgs(contribo?.orgs ?? [], archive, contribo?.rowKind ?? "org");
  const years = [...new Set(rows.flatMap((r) => r.years))].sort((a, b) => b - a);
  const bySector = new Map<Sector, number>();
  for (const r of rows) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + 1);
  return {
    ready: true,
    rows,
    projects: rows.reduce((s, r) => s + r.projects, 0),
    years,
    techs: techRank(rows),
    sectors: [...bySector.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    contribo: index?.programs?.[id] ?? null,
    generated: index?.generated ?? "",
    kind: AREA_ONLY.has(id) ? "areas" : "orgs",
  };
}

const EMPTY: ProgramOrgs = { ready: false, rows: [], projects: 0, years: [], techs: [], sectors: [], contribo: null, generated: "", kind: "orgs" };

export function useProgramOrgs(id: string): ProgramOrgs {
  const [state, setState] = useState<ProgramOrgs>(EMPTY);
  useEffect(() => {
    let go = true;
    loadProgramOrgs(id).then((r) => { if (go) setState(r); });
    return () => { go = false; };
  }, [id]);
  return state;
}

/** Per-program organization totals for the directory and the program cards.
    Reads only the small index, never a shard. */
export function useProgramStats(): { ready: boolean; byId: Record<string, ProgramStats>; generated: string } {
  const [state, setState] = useState<{ ready: boolean; byId: Record<string, ProgramStats>; generated: string }>({ ready: false, byId: {}, generated: "" });
  useEffect(() => {
    let go = true;
    loadContriboIndex().then((f) => {
      if (!go) return;
      setState({ ready: true, byId: f?.stats ?? {}, generated: f?.statsGenerated ?? f?.generated ?? "" });
    });
    return () => { go = false; };
  }, []);
  return state;
}

/** Totals across every program that has a merged organization list. */
export function sumStats(byId: Record<string, ProgramStats>) {
  const all = Object.values(byId);
  return {
    orgs: all.reduce((s, r) => s + r.orgs, 0),
    projects: all.reduce((s, r) => s + r.projects, 0),
    programs: all.length,
  };
}
