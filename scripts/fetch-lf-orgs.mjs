/* ══ scripts/fetch-lf-orgs.mjs — the Linux Foundation's own public directory ═
   node scripts/fetch-lf-orgs.mjs

   LFX is the Linux Foundation's platform, so "every organization associated with
   LFX" has a real, published answer that is much bigger than the 47 host
   projects LFX Mentorship runs internships under. The LF keeps an open gateway
   behind its own project pages - no token, no ACL header, plain JSON:

     GET .../project-service/v1/public/projects?pageSize=200&offset=N
         -> every project the LF hosts (Metadata.TotalSize = 1,612)
     GET .../project-service/v1/public/projects/{slug}/members?status=Active
         -> one row per active member organization of that project

   The `tlf` slug is the Foundation itself, and its member list is the whole
   dues-paying population - 2,463 organizations when this was written. The named
   foundations (CNCF, LF AI & Data, OpenSSF, ...) each hold their own list, and a
   company that funds three of them is one organization, not three, so the rows
   are collapsed by company name and carry the foundations they belong to.

   That deduplicated set is what the site lists, and what the overlap check runs
   against. It is deliberately kept apart from the LFX Mentorship host roster:
   these are the organizations that fund and govern LF projects, not the ones that
   took a mentee on.

   Output: public/data/lf-orgs.json.                                      ═ */
import { writeFileSync, readFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "data");
const RAW = join(RAW_DIR, "lf-directory-raw.json");
const OUT = join(ROOT, "public/data/lf-orgs.json");
const GW = "https://api-gw.platform.linuxfoundation.org/project-service/v1/public";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* transient */ }
    await sleep(900 * (i + 1));
  }
  return null;
};

/* the members endpoint answers as a bare array; the directory answers as
   {Data, Metadata} - paged() returns the rows either way */
async function paged(base, limit = 4000) {
  const rows = [];
  for (let offset = 0; offset < limit; offset += 200) {
    const j = await get(`${base}${base.includes("?") ? "&" : "?"}pageSize=200&offset=${offset}`);
    const batch = Array.isArray(j) ? j : (j?.Data ?? []);
    if (!batch.length) break;
    rows.push(...batch);
    if (batch.length < 200) break;
    await sleep(100);
  }
  return rows;
}

const memberSlug = (s) => `${GW}/projects/${encodeURIComponent(s)}/members?status=Active`;

const slimMember = (m) => ({
  name: clean(m.Name),
  website: clean(m.Website),
  tier: clean(m.Membership?.Name).replace(/\s+membership$/i, ""),
  level: clean(m.CNCFLevel),
  logo: clean(m.Logo),
  desc: clean(m.OrganizationDescription).slice(0, 180),
});

/* ── 1. the project directory ──────────────────────────────────────────── */
const dir = await get(`${GW}/projects?pageSize=1`);
const total = Number(dir?.Metadata?.TotalSize ?? 0);
const projects = await paged(`${GW}/projects`, Math.max(total, 200) + 200);
if (!projects.length) throw new Error("the LF project directory returned nothing - refusing to write");

const projList = projects.map((p) => ({
  name: clean(p.Name), slug: clean(p.Slug), parent: clean(p.ParentSlug),
  type: clean(p.ProjectType), industry: clean(p.IndustrySector),
  website: clean(p.Website) || clean(p.Homepage) || "",
  started: String(p.StartDate ?? "").slice(0, 10),
  status: clean(p.Status),
})).filter((p) => p.name && p.slug);

/* a foundation is any project that others hang off, plus the Foundation itself */
const parentSlugs = [...new Set(projList.map((p) => p.parent).filter(Boolean))];
const FOUNDATIONS = [...new Set(["tlf", "linuxfoundation", ...parentSlugs])];
console.log(`LF directory: ${projList.length} projects · ${FOUNDATIONS.length} parent foundations`);

/* ── 2. member organizations, cached per foundation ────────────────────── */
const cache = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : {};
cache.members ||= {};

for (const slug of FOUNDATIONS) {
  if (cache.members[slug]?.pulled) continue;
  const rows = await paged(memberSlug(slug), 5000);
  cache.members[slug] = { pulled: true, at: new Date().toISOString().slice(0, 10), rows: rows.map(slimMember) };
  console.log(`  ${slug.padEnd(28)} ${String(rows.length).padStart(5)} active member organizations`);
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(RAW, JSON.stringify(cache));
  await sleep(120);
}

/* ── 3. one row per organization ───────────────────────────────────────── */
const keyOf = (s) => s.replace(/[.,\s]+$/, "").replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|limited|plc|bv|nv|technologies|technology|solutions|software)\b/gi, "").replace(/[\s,]+/g, " ").trim().toLowerCase();

const LABEL = { tlf: "Linux Foundation", cncf: "CNCF", ...Object.fromEntries(FOUNDATIONS.map((s) => [s, s])) };
const byOrg = new Map();
for (const [slug, list] of Object.entries(cache.members)) {
  for (const m of list.rows ?? []) {
    const key = keyOf(m.name);
    if (!key || key.length < 2) continue;
    const e = byOrg.get(key) ?? { name: m.name, website: m.website, logo: m.logo, desc: m.desc, foundations: new Set(), tiers: new Set() };
    e.foundations.add(slug);
    const t = m.tier || m.level;
    if (t) e.tiers.add(t);
    if (!e.website && m.website) e.website = m.website;
    if (!e.logo && m.logo) e.logo = m.logo;
    byOrg.set(key, e);
  }
}

const orgs = [...byOrg.values()].map((o) => ({
  name: o.name,
  website: o.website,
  logo: o.logo,
  foundations: [...o.foundations].sort(),
  foundationCount: o.foundations.size,
  tiers: [...o.tiers].sort().slice(0, 4),
})).sort((a, b) => b.foundationCount - a.foundationCount || a.name.localeCompare(b.name));

/* a foundation's own member rows repeat a company across its projects, so the
   per-foundation count is the number of distinct organizations, not rows */
const perFoundation = Object.fromEntries(
  FOUNDATIONS.map((slug) => [slug, orgs.filter((o) => o.foundations.includes(slug)).length])
);

const file = {
  generated: new Date().toISOString().slice(0, 10),
  source: "api-gw.platform.linuxfoundation.org/project-service/v1/public",
  note: "The Linux Foundation's own open gateway: every project it hosts and every active member organization of those foundations, collapsed to one row per company. These fund and govern LF projects; the LFX Mentorship host roster is a much smaller, separate list.",
  projectTotal: projList.length,
  foundations: FOUNDATIONS,
  perFoundation,
  orgs,
  projects: projList,
};
mkdirSync(RAW_DIR, { recursive: true });
const tmp = OUT + ".tmp";
writeFileSync(tmp, JSON.stringify(file));
renameSync(tmp, OUT);

console.log(`LF member organizations: ${orgs.length} distinct companies across ${Object.keys(perFoundation).length} foundations`);
console.log(`multi-foundation: ${orgs.filter((o) => o.foundationCount > 1).length} fund more than one`);
console.log(`top: ${orgs.slice(0, 5).map((o) => `${o.name} (${o.foundationCount})`).join(", ")}`);
console.log(`wrote ${OUT.replace(ROOT + "/", "")} (${(readFileSync(OUT).length / 1024).toFixed(0)} KB)`);
