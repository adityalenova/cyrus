/* ══ orgClassify.ts - the derivation behind src/data/orgClass.ts ═══════
   Run: npx tsx scripts/build-org-class.mjs
   Kept apart from the table it produces so the directory page can read a
   finished answer instead of scanning 364 organizations' worth of text on
   every visit. The rulebook itself lives in orgTaxonomy.ts and is shared
   with /programs/<id>/organizations, so a card and the explorer classify an
   organization the same way. */
import { ORGS } from "../data/orgs";
import { ROSTER } from "../data/rosterOrgs";
import { REAL_REPOS } from "../data/realOrgs";
import { langToTech, normalizeTechs, sectorOf, type Sector } from "./orgTaxonomy";
import type { Org } from "./types";

export type DerivedOrgClass = { login: string; sector: Sector; techs: string[] };

/** The program archive's own category for this account, when it recorded one. */
function categoryByLogin() {
  const map = new Map<string, string>();
  for (const r of ROSTER) if (r.login && r.category) map.set(r.login.toLowerCase(), r.category);
  return map;
}

function classify(org: Org, category: string): DerivedOrgClass {
  const repos = (REAL_REPOS[org.login] ?? REAL_REPOS[org.login.toLowerCase()] ?? []).slice(0, 10);
  /* the row's own summary comes before the repository blurbs, and sectorOf
     weights the first two texts double, so an organization is classified by
     how it describes itself rather than by one busy repo */
  const sector = sectorOf(category, `${org.name} ${org.tagline}`, org.tags.join(" "), ...repos.map((r) => r.desc));
  return { login: org.login, sector, techs: normalizeTechs(org.tags.map(langToTech)) };
}

/** Every directory organization, classified from its own record. */
export function deriveOrgClasses(orgs: Org[] = ORGS): DerivedOrgClass[] {
  const categories = categoryByLogin();
  return orgs.map((o) => classify(o, categories.get(o.login.toLowerCase()) ?? ""));
}
