/* ══ scripts/fetch-24pr.mjs — the 24 Pull Requests listing ═══════════════
   node scripts/fetch-24pr.mjs

   24 Pull Requests is not a mentored summer program: it is a December
   gift-a-pull-request campaign, and what it publishes is a curated wishlist of
   repositories whose maintainers asked for contributions. Its documented API
   (24pullrequests.com/api) serves two lists that matter here:

     https://24pullrequests.com/projects.json?page=N       -> the wishlist
     https://24pullrequests.com/organisations.json?page=N   -> the organizations

   Two limits we verified rather than assumed:
   - `?year=` is ignored. Every value we tried, valid or not, returned
     byte-identical bytes, so there is no per-year archive here and none is
     invented; this is the one current list;
   - projects.json serves 20 rows per page and organisations.json 99, both
     until an empty page. An owner appearing twice is one organization.

   Output: public/data/24pr-archive.json.                                ═ */
import { writeFileSync, mkdirSync, renameSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "data");
const RAW = join(RAW_DIR, "24pr-raw.json");
const OUT = join(ROOT, "public/data/24pr-archive.json");
const SITE = "https://24pullrequests.com";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status !== 403 && r.status < 500) throw new Error(`${url} -> ${r.status}`);
      /* 403 and 429 here are the rate limiter, not a refusal - back off */
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await sleep(1500 * (i + 1));
  }
  return null;
};

/* Paginate to the end. projects.json ignores ?year= and organisations.json
   pages alphabetically, so the stop condition is an empty page or a page that
   repeats rows we already hold - never a fixed page count. */
async function pages(path, size, cap = 400) {
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= cap; page++) {
    const j = await get(`${SITE}${path}?page=${page}`);
    if (!Array.isArray(j) || !j.length) break;
    let fresh = 0;
    for (const r of j) {
      const key = String(r.login ?? r.github_url ?? JSON.stringify(r)).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(r);
      fresh += 1;
    }
    if (!fresh) break;
    if (j.length < size) break;
    await sleep(450);
  }
  return rows;
}

const repoOf = (u) => {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(String(u ?? ""));
  return m ? { owner: m[1], repo: `${m[1]}/${m[2].replace(/\.git$/i, "")}` } : null;
};

const main = async () => {
  /* the raw pull is kept, so a re-derive of the rollups costs no requests */
  const cached = process.argv.includes("rebuild") && existsSync(RAW)
    ? JSON.parse(readFileSync(RAW, "utf8")) : null;

  /* the wishlist, deduplicated by repository - one record per repo */
  const rawProjects = cached?.projects ?? await pages("/projects.json", 20);
  const byRepo = new Map();
  const addRepo = (owner, repo, lang, title) => {
    const key = repo.toLowerCase();
    if (byRepo.has(key)) return;
    byRepo.set(key, { owner, repo, lang: String(lang ?? "").trim(), title: String(title ?? "").replace(/\s+/g, " ").trim().slice(0, 140) });
  };
  if (cached?.projects) {
    /* the cached file already holds slim repo rows - reuse them as they are */
    for (const p of cached.projects) addRepo(p.owner, p.repo, p.lang, p.title);
  } else {
    for (const p of rawProjects) {
      const r = repoOf(p.github_url);
      if (r) addRepo(r.owner, r.repo, p.main_language, p.description);
    }
  }
  const projects = [...byRepo.values()];
  if (!projects.length) throw new Error("24pullrequests.com returned no projects - refusing to write");

  /* the organization list the site itself publishes */
  const rawOrgs = cached?.orgs ?? await pages("/organisations.json", 99);
  const byOrg = new Map();
  for (const o of rawOrgs) {
    const login = String(o.login ?? "").trim();
    if (!login || byOrg.has(login.toLowerCase())) continue;
    byOrg.set(login.toLowerCase(), {
      name: login, listed: true, repos: 0, langs: new Set(),
      users: Array.isArray(o.users) ? o.users.length : (Number(o.users ?? 0) || 0),
      link: String(o.link ?? "").trim(),
    });
  }
  for (const p of projects) {
    const key = p.owner.toLowerCase();
    const o = byOrg.get(key) ?? { name: p.owner, listed: false, repos: 0, langs: new Set(), users: 0, link: "" };
    o.repos += 1;
    if (p.lang) o.langs.add(p.lang);
    byOrg.set(key, o);
  }

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(RAW, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), projects, orgs: rawOrgs }));

  const orgList = [...byOrg.values()]
    .map((o) => ({ name: o.name, listed: o.listed, projects: o.repos, users: o.users,
      languages: [...o.langs].sort().slice(0, 5), url: o.link || `https://github.com/${o.name}` }))
    .sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

  const file = {
    generated: new Date().toISOString().slice(0, 10),
    source: `${SITE}/projects.json + ${SITE}/organisations.json`,
    note: "24 Pull Requests publishes a curated wishlist of repositories that want contributions, plus a list of the organizations behind them. The organization is the GitHub account that owns a listed repo. The site's ?year= parameter is ignored by the API, so this is the single current list rather than a per-year archive - and these are wishlist repos, not accepted mentored projects.",
    projects: projects.length,
    listedOrgs: rawOrgs.length,
    orgs: orgList,
  };
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(file));
  renameSync(tmp, OUT);

  console.log(`24 Pull Requests: ${projects.length} listed repositories · ${orgList.length} GitHub accounts (${orgList.filter((o) => o.listed).length} on the site's own organization list)`);
  console.log(`top: ${orgList.slice(0, 5).map((o) => `${o.name} (${o.projects})`).join(", ")}`);
  if (existsSync(RAW)) console.log("raw kept at data/24pr-raw.json");
};

main().catch((e) => { console.error(e); process.exit(1); });
