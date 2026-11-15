/* ══ ogContent.ts — what the 1200x630 share card says ═══════════════
   Kept apart from the renderer on purpose: every string on the card is
   derived here from the same data the pages render from, so a share image
   cannot quote a number the site has already refreshed away. Nothing in
   this file may state a fact the record does not carry.                ══ */
import { REPOS } from "@/data/repos";
import type { Program } from "@/lib/types";
import { ORGS } from "@/data/orgs";
import { fmtFull, STATS } from "@/lib/siteStats";

export type OgRow = { k: string; v: string };

export interface OgCard {
  /** small uppercase line above the title */
  eyebrow: string;
  /** display lines, already broken where they should break */
  title: string[];
  /** one supporting sentence, optional */
  tag?: string;
  /** the ledger: label plus value, three rows reads best */
  rows: OgRow[];
  /** the muted strip along the bottom */
  foot: string;
  /** alt text for og:image and twitter:image */
  alt: string;
}

/** Newest `updated` stamp in the project catalog, as the README badge shows it.
 *  Same rule as scripts/readme-snapshot.mjs: the catalog date, never the run date. */
export function catalogSnapshot(): string {
  let newest = "";
  for (const r of REPOS) if (r.updated > newest) newest = r.updated;
  if (!/^\d{4}-\d{2}-\d{2}/.test(newest)) return "no dated snapshot";
  const d = new Date(`${newest.slice(0, 10)}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

const SNAPSHOT = `catalog snapshot ${catalogSnapshot()}`;

/** The home card: the shelves the site is built from, in their real sizes. */
export function homeCard(): OgCard {
  return {
    eyebrow: "Open source, indexed",
    title: ["Find your", "next contribution"],
    rows: [
      { k: "Open issues", v: `${fmtFull(STATS.issues)} across ${fmtFull(STATS.issueRepos)} repositories` },
      { k: "Programs", v: `${STATS.programs} tracked, all on the 2026 calendar` },
      { k: "Projects", v: `${fmtFull(STATS.archive)} program projects, ${STATS.archivePrograms} archives` },
      { k: "Organizations", v: `${ORGS.length} profiles, each named by a program` },
    ],
    foot: SNAPSHOT,
    alt: "cyrus.ai - the open-source contribution index: issues, programs, projects and organizations.",
  };
}

/** One card per program page. Every value is a field that record already has.
 *  payNote is the record's own word for its pay ("STIPEND", "PRIZES", "BADGE +
 *  TREE"), so using it as the row label stops a prize-only hackathon from
 *  being described as a stipend. */
export function programCard(p: Program): OgCard {
  const rows: OgRow[] = [];
  if (p.pay) rows.push({ k: p.payNote || "Pay", v: p.pay });
  if (p.window) rows.push({ k: "Window", v: p.window });
  if (p.orgs) rows.push({ k: "Reach", v: p.orgs });
  return {
    eyebrow: `Open source program - ${p.owner}`,
    title: [p.name],
    tag: p.tag,
    rows,
    foot: `cyrus.ai/programs/${p.id} - ${SNAPSHOT}`,
    alt: `${p.name} on cyrus.ai: ${p.tag}`,
  };
}
