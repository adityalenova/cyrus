/* ══ scripts/fetch-lfx-alltime.mjs — the whole LFX Mentorship record ═══════
   node scripts/fetch-lfx-alltime.mjs

   LFX Mentorship publishes every project through a plain, open API:
   https://api.mentorship.lfx.linuxfoundation.org/projects, paginated with an
   opaque nextPageKey. Each project row carries three things our archive was
   missing:

     lfProjectName  the Linux Foundation project hosting the work - this is what
                    LFX means by "organization", and it is what the ~800 figure
                    the program quotes actually counts;
     mentors[]      real mentor objects with real names, not a comma-separated
                    string we have to guess at;
     projectTerms[] the terms a project ran under, each with a start timestamp,
                    which is how a project gets attributed to a year.

   The previous LFX rows in public/data/otherProjects.json came from an early
   pass at this API that kept 941 projects and 24 organization strings. This
   crawl keeps everything, so the roster, the org count and the mentor count
   all come from one pull.

   Output: data/lfx-alltime-raw.json (gitignored build input, ~a few MB) and
   public/data/lfx-archive.json (what the site reads).                      ═ */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "data");
const RAW = join(RAW_DIR, "lfx-alltime-raw.json");
const OUT = join(ROOT, "public/data/lfx-archive.json");
const API = "https://api.mentorship.lfx.linuxfoundation.org/projects";
const PAGE = Number(process.argv[2] ?? 100);
const SLEEP = Number(process.argv[3] ?? 250);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) throw new Error(`LFX API ${r.status}`);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await sleep(1200 * (i + 1));
  }
  return null;
};

/** a project can run under several terms; each start timestamp is one year of work.
    The public list payload does not include projectTerms, so a row falls back to
    the year it was published under - labelled yearsFrom:"published" downstream. */
const termYears = (p) => {
  const t = [...new Set((p.projectTerms ?? [])
    .map((x) => new Date((x.startDateTime ?? 0) * 1000).getFullYear())
    .filter((y) => y > 2015 && y < 2100))].sort();
  if (t.length) return t;
  const c = Number(String(p.createdOn ?? "").slice(0, 4));
  return c > 2015 && c < 2100 ? [c] : [];
};

const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const slim = (p) => ({
  id: p.projectId,
  name: cleanName(p.name),
  lfid: p.lfid || null,
  org: cleanName(p.lfProjectName) || null,
  repo: p.repoLink && /^https?:\/\/github\.com\/[^/]+\/[^/?#]+/i.test(p.repoLink)
    ? p.repoLink.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i).slice(1).join("/") : null,
  industry: cleanName(p.industry) || null,
  years: termYears(p),
  created: String(p.createdOn ?? "").slice(0, 4) || null,
  mentors: [...new Set((p.apprenticeNeeds?.mentors ?? []).map((m) => cleanName(m.name)).filter((n) => n.length >= 3))],
  status: p.status || null,
});

async function crawl() {
  const projects = [];
  let key = "";
  let pages = 0;
  for (;;) {
    const url = `${API}?limit=${PAGE}${key ? `&nextPageKey=${encodeURIComponent(key)}` : ""}`;
    const j = await get(url);
    if (!j?.projects?.length) break;
    for (const p of j.projects) projects.push(slim(p));
    pages += 1;
    if (pages % 10 === 0) console.log(`  ${projects.length} projects, ${pages} pages`);
    key = j.nextPageKey;
    if (!key) break;
    await sleep(SLEEP);
  }
  return projects;
}

/* de-duplicate by projectId: the pagination cursor is a sort key, so a row can
   legitimately appear at a page boundary twice. */
const unique = (rows) => {
  const m = new Map();
  for (const r of rows) if (r.id && !m.has(r.id)) m.set(r.id, r);
  return [...m.values()];
};

const main = async () => {
  const rebuild = process.argv.slice(2).includes("rebuild");
  let rows;
  if (rebuild && existsSync(RAW)) {
    const cached = unique(JSON.parse(readFileSync(RAW, "utf8")).projects);
    rows = cached.map((r) => ({ ...r, years: r.years.length ? r.years : [Number(r.created)].filter((y) => y > 2015) }));
    console.log(`LFX Mentorship: re-deriving from data/lfx-alltime-raw.json (${rows.length} cached rows)`);
  } else {
    console.log("LFX Mentorship: crawling every published project");
    rows = unique(await crawl());
  }
  if (!rows.length) throw new Error("the API returned nothing - refusing to write an empty archive");

  const years = [...new Set(rows.flatMap((r) => r.years))].sort();
  const orgs = new Map();
  for (const r of rows) {
    if (!r.org) continue;
    const o = orgs.get(r.org) ?? { name: r.org, projects: 0, years: [], mentors: new Set(), repos: new Set(), industries: new Set() };
    o.projects += 1;
    for (const y of r.years) if (!o.years.includes(y)) o.years.push(y);
    for (const m of r.mentors) o.mentors.add(m);
    if (r.repo) o.repos.add(r.repo.toLowerCase().split("/")[0]);
    if (r.industry) for (const i of r.industry.split(",")) i.trim() && o.industries.add(i.trim());
    orgs.set(r.org, o);
  }
  const mentors = new Set(rows.flatMap((r) => r.mentors));

  const orgList = [...orgs.values()]
    .map((o) => ({
      name: o.name,
      projects: o.projects,
      years: o.years.sort(),
      mentors: o.mentors.size,
      githubOrgs: [...o.repos].sort().slice(0, 6),
      githubOrgCount: o.repos.size,
      industries: [...o.industries].sort().slice(0, 4),
    }))
    .sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(RAW, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), projects: rows }, null, 1));

  const file = {
    generated: new Date().toISOString().slice(0, 10),
    source: "api.mentorship.lfx.linuxfoundation.org",
    note: "Every project LFX Mentorship has published, with the Linux Foundation project that hosted it and the mentors named on the record.",
    programs: {
      lfx: {
        label: "LFX Mentorship",
        projects: rows.length,
        years,
        orgs: orgList,
        mentors: [...mentors].sort(),
      },
    },
  };
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(file));
  renameSync(tmp, OUT);

  console.log(`LFX: ${rows.length} projects · ${orgList.length} organizations · ${mentors.size} distinct mentor names`);
  console.log(`years ${years[0]}-${years[years.length - 1]} · raw kept at data/lfx-alltime-raw.json`);
  console.log(`top orgs: ${orgList.slice(0, 5).map((o) => `${o.name} (${o.projects})`).join(", ")}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
