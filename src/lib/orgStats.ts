/* ══ orgStats.ts — read the cross-program organization statistics file.

   scripts/org-stats.mjs folds every program's merged organization list and the
   tracked GitHub profiles into one row per organization and writes it to
   /data/org-stats.json. The statistics page reads that single file rather than
   the thirteen shards and archives it was built from - the same merge, done
   once at build time instead of in the visitor's browser.                 ═ */
import { useEffect, useState } from "react";

export type OrgStatProgram = { id: string; projects: number; years: number[] };

export type OrgStatRow = {
  key: string;
  name: string;
  login: string | null;
  site: string;
  desc: string;
  sector: string;
  techs: string[];
  years: number[];
  projects: number;
  programs: OrgStatProgram[];
  nprograms: number;
  stars: number;
  repos: number;
  issues: number;
  logo: string;
  from: string[];
};

export type OrgStatStats = {
  orgs: number;
  withLogin: number;
  inMany: number;
  projects: number;
  programs: number;
  directory: number;
  sectors: [string, number][];
  years: [string, number][];
  techs: [string, number][];
  spread: [string, number][];
  perProgram: Record<string, { orgs: number; projects: number }>;
  programCounts: Record<string, number>;
};

export type OrgStatsFile = {
  generated: string;
  source: string;
  note: string;
  stats: OrgStatStats;
  orgs: OrgStatRow[];
};

const EMPTY: OrgStatsFile = {
  generated: "", source: "", note: "",
  stats: {
    orgs: 0, withLogin: 0, inMany: 0, projects: 0, programs: 0, directory: 0,
    sectors: [], years: [], techs: [], spread: [], perProgram: {}, programCounts: {},
  },
  orgs: [],
};

let cache: OrgStatsFile | null = null;

export function loadOrgStats(): Promise<OrgStatsFile> {
  if (cache) return Promise.resolve(cache);
  return fetch("/data/org-stats.json")
    .then((r) => (r.ok ? (r.json() as Promise<OrgStatsFile>) : EMPTY))
    .then((f) => { cache = f; return f; })
    .catch(() => EMPTY);
}

export function useOrgStats(): { ready: boolean; file: OrgStatsFile } {
  const [file, setFile] = useState<OrgStatsFile | null>(cache);
  useEffect(() => {
    let go = true;
    loadOrgStats().then((f) => { if (go) setFile(f); });
    return () => { go = false; };
  }, []);
  return { ready: !!file, file: file ?? EMPTY };
}
