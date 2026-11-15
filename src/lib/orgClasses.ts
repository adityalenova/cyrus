/* ══ orgClasses.ts - the directory's two facets, sector and technology ═════
   src/data/orgClass.ts holds the answer for every organization; this file
   turns it into what the page needs: a lookup by login and the two option
   lists, each ordered by how many organizations actually sit behind it.

   The rulebook is src/lib/orgTaxonomy.ts and it is shared with
   /programs/<id>/organizations, so "Science & medicine" means the same thing
   on both pages. Regenerate the table with:
   npx tsx scripts/build-org-class.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import { ORGS } from "../data/orgs";
import { ORG_CLASS } from "../data/orgClass";
import { techRank } from "./orgTaxonomy";
import type { Sector } from "./orgTaxonomy";
import type { Org } from "./types";

export type ClassifiedOrg = { org: Org; sector: Sector; techs: string[] };

/** Sector for a directory organization, or null if the table has no row for it. */
export function sectorOfOrg(login: string): Sector | null {
  return ORG_CLASS[login]?.sector ?? null;
}

/** Technologies for a directory organization, in the explorer's vocabulary. */
export function techsOfOrg(login: string): string[] {
  return ORG_CLASS[login]?.techs ?? [];
}

/** The whole directory, classified. */
export const CLASSIFIED: ClassifiedOrg[] = ORGS.map((org) => ({
  org,
  sector: ORG_CLASS[org.login]?.sector ?? "Other",
  techs: ORG_CLASS[org.login]?.techs ?? [],
}));

/** Sector options, biggest first. A bucket with one organization in it is not a filter. */
export const SECTOR_FACETS: { value: Sector; n: number }[] = (() => {
  const c = new Map<string, number>();
  for (const x of CLASSIFIED) c.set(x.sector, (c.get(x.sector) ?? 0) + 1);
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, n]) => ({ value: value as Sector, n }));
})();

/** Technology options, most-listed first, capped so the dropdown stays scannable. */
export const TECH_FACETS: string[] = techRank(CLASSIFIED).slice(0, 40).map(([t]) => t);

/** How many organizations list a technology - used for the option labels. */
export const TECH_COUNTS: Map<string, number> = new Map(techRank(CLASSIFIED));
