/* ══ siteStats.ts — the numbers the site chrome quotes ════════════════
   Counts here are computed from the data modules, so a catalog refresh
   cannot leave the footer, the header and the page metadata describing
   a site that no longer exists. One value stays a literal: the program
   archive total, which lives in public/data/*.json rather than in TS.
   siteStats.test.ts asserts that literal against the two files.      ══ */
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { HACKS, type Hack } from "@/data/hackathons";
import { HACKS_LIVE } from "@/data/hackathonsLive";
import { REAL_ORGS } from "@/data/realOrgs";
import { RESOURCES } from "@/data/resources";
import { PROGRAMS } from "@/data/orgs";

/** gsoc-projects.json (5,238) + otherProjects.json (1,444) */
export const ARCHIVE_PROJECTS = 6_682;

/** curated shelf plus the live Devpost pull */
export const ALL_HACKS: Hack[] = [...HACKS, ...HACKS_LIVE];

/**
 * Events whose submission deadline has not passed. Derived from the date
 * rather than the stored status, because a refresh that adds listings
 * without re-tagging the old ones leaves `status: "open"` on closed calls.
 */
export function openHacks(on: Date = new Date()): number {
  return ALL_HACKS.filter((h) => {
    const d = h.deadline ? Date.parse(h.deadline) : NaN;
    return !Number.isNaN(d) && new Date(d) >= on;
  }).length;
}

/** 1528 -> "1,528" */
export const fmt = (n: number): string => n.toLocaleString("en-US");

export const STATS = {
  /** agent-tooling repos in the browsable catalog */
  repos: REPOS.length,
  /** catalog repos plus the flagship program projects */
  catalog: REPOS.length + PROGRAM_REPOS.length,
  /** organization profiles built from live GitHub data */
  orgs: REAL_ORGS.length,
  /** tracked open-source programs */
  programs: PROGRAMS.length,
  /** mentored projects in the program archive */
  archive: ARCHIVE_PROJECTS,
  /** hackathons listed, open and recently closed */
  hacks: ALL_HACKS.length,
  /** learning resources */
  resources: RESOURCES.length,
};

/** One-line summary for metadata descriptions and the footer stat strip. */
export function statsLine(on: Date = new Date()): string {
  return `${fmt(STATS.repos)} AI-agent repos, ${fmt(STATS.archive)} open-source program projects and ${openHacks(on)} hackathons open now`;
}
