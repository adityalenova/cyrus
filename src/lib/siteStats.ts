/* ══ siteStats.ts — the numbers the site chrome quotes ════════════════
   Counts here are computed from the data modules, so a catalog refresh
   cannot leave the footer, the header and the page metadata describing
   a site that no longer exists. Two values stay literals, both because the
   rows they count live in public/data/*.json rather than in TS: the project
   archive total, and how many programs contribute to it.
   siteStats.test.ts asserts both against the files on disk - the two big
   archives plus every shard listed by the per-program index - so a refresh
   that changes a file fails the test until this module catches up.   ══ */
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { ORGS, PROGRAMS } from "@/data/orgs";
import { ROSTER_STATS } from "@/data/rosterOrgs";
import { CRAWL } from "@/data/crawlStats";

/** The archive the site actually browses: gsoc-projects.json (5,238) +
 *  otherProjects.json (1,444) + the full record of every other program in
 *  public/data/program-projects/index.json (24 Pull Requests, GSSoC, Season of
 *  KDE, MLH, NSoC, Hacktoberfest, FOSSEE, Vercel OSS), with no row counted
 *  twice - the four programs inside the two big files are excluded from the
 *  shard sum because their shards are reshaped copies of the same rows. */
export const ARCHIVE_PROJECTS = 8_754;
/** rows the /projects listing really renders: the two big files in full plus
 *  the rows each other shard carries (the build caps a shard at 400) */
export const ARCHIVE_ROWS = 8_731;
/** how many programs those rows come from */
export const ARCHIVE_PROGRAMS = 12;

/** 1528 -> "1,528": exact, for counts of our own catalog (util.ts fmtCompact is for star counts) */
export const fmtFull = (n: number): string => n.toLocaleString("en-US");

export const STATS = {
  /** program-project repos in the browsable catalog */
  repos: REPOS.length,
  /** catalog repos plus the flagship program projects */
  catalog: REPOS.length + PROGRAM_REPOS.length,
  /** organization profiles built from live GitHub data, every one named by a program */
  orgs: ORGS.length,
  /** organizations named by the four program archives that publish participants */
  orgRoster: ROSTER_STATS.orgs,
  /** of those, how many have a GitHub account we could confirm */
  orgRosterWithGithub: ROSTER_STATS.withGithub,
  /** accepted projects those same four archives record for those organizations */
  rosterProjects: ROSTER_STATS.projects,
  /** tracked open-source programs */
  programs: PROGRAMS.length,
  /** programs that publish a project archive we could read */
  archivePrograms: ARCHIVE_PROGRAMS,
  /** mentored projects in the program archive (full records) */
  archive: ARCHIVE_PROJECTS,
  /** rows the archive listing renders today */
  archiveRows: ARCHIVE_ROWS,
  /** open issues in the GitHub crawl */
  issues: CRAWL.issues,
  /** repositories the crawl found issues in */
  issueRepos: CRAWL.reposWithIssues,
  /** repositories the crawl read to find them */
  crawlRepos: CRAWL.catalogRepos,
  /** of those, how many carry a beginner label */
  beginnerIssues: CRAWL.beginnerLabelled,
  /** when the crawl last ran, ISO */
  crawledAt: CRAWL.crawledAt,
};

/** One-line summary for metadata descriptions and the footer stat strip. */
export function statsLine(): string {
  return `${fmtFull(STATS.issues)} open issues in ${fmtFull(STATS.issueRepos)} repositories, ${fmtFull(STATS.archive)} program projects from ${STATS.archivePrograms} archives and ${STATS.programs} tracked open-source programs`;
}
