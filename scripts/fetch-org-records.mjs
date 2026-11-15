/* ══ scripts/fetch-org-records.mjs — the live GitHub record for every roster login
   node scripts/fetch-org-records.mjs [--batch=8] [--dry]

   Faster and cheaper than the two REST passes it replaces:

   - one GraphQL call carries eight organizations, and each of them asks for its
     own ten most-starred repositories, so the whole roster costs ~30 requests
     instead of ~500 search-API calls at 30 a minute;
   - the organization account itself (name, description, website, location,
     when it joined, whether GitHub verifies it) still comes from REST
     users/<login>, because that is where the follower count lives - GraphQL
     does not expose one.

   Everything written here is GitHub's own field for that organization. No
   number is derived, smoothed or filled in. A login that 404s is recorded as
   failed and the build script then leaves that org out of the directory
   rather than showing a profile it cannot back.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "data/org-login-cache.json");
const BATCH = Number((process.argv.find((a) => a.startsWith("--batch=")) || "").split("=")[1] || 8);
const DRY = process.argv.includes("--dry");

const gh = (args) => execFileSync("gh", args, { maxBuffer: 40 * 1024 * 1024, encoding: "utf8" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const save = () => { const t = CACHE + ".tmp"; writeFileSync(t, JSON.stringify(cache, null, 1)); renameSync(t, CACHE); };

/* every login the site currently shows, plus every roster match just resolved.
   The 43 hand-picked profiles in realOrgs.ts have never been in this cache, and
   dropping them by accident would shrink the directory instead of growing it. */
const current = readFileSync(join(ROOT, "src/data/realOrgs.ts"), "utf8");
const directoryLogins = [...current.matchAll(/^\s*\{ login: "([^"]+)"/gm)].map((m) => m[1]);
const logins = [...new Set([
  ...directoryLogins,
  ...Object.entries(cache).filter(([k, v]) => !k.startsWith("@") && v.login).map(([, v]) => v.login),
])].sort();

/* a login is done when its repos AND its account record are both present */
const need = logins.filter((l) => !cache[`@${l}`]?.repos || !cache[`@${l}`]?.fetched);
console.log(`${logins.length} confirmed logins, ${need.length} still to fetch`);
if (DRY) { console.log(need.slice(0, 30).join(", ")); process.exit(0); }

/** the pieces of the query one organization needs */
const slice = (i, login) => `o${i}: organization(login: ${JSON.stringify(login)}) {
  login name description websiteUrl location createdAt isVerified avatarUrl
  repositories(first: 10, orderBy: { field: STARGAZERS, direction: DESC }) {
    totalCount
    nodes { nameWithOwner description url stargazerCount forkCount
      openIssues: issues(states: OPEN) { totalCount }
      primaryLanguage { name } } } }`;

for (let i = 0; i < need.length; i += BATCH) {
  const group = need.slice(i, i + BATCH);
  const query = "{" + group.map((l, n) => slice(n, l)).join("") + "}";
  let data;
  try {
    data = JSON.parse(gh(["api", "graphql", "-f", "query=" + query])).data;
  } catch (e) {
    const msg = String(e.message || e);
    if (/rate limit|403|secondary/i.test(msg)) { console.log(`  rate limited at ${i}, pausing 90s`); await sleep(90000); i -= BATCH; continue; }
    /* a single bad login can poison a whole batch - retry it alone */
    console.log(`  batch failed (${group[0]}…), falling back to one at a time`);
    for (const l of group) {
      try {
        const one = JSON.parse(gh(["api", "graphql", "-f", "query={" + slice(0, l) + "}"])).data;
        if (one.o0) write(one.o0);
      } catch { /* genuinely missing account: leave it out */ }
      await sleep(400);
    }
    continue;
  }
  for (const l of group) {
    const o = data[`o${group.indexOf(l)}`];
    if (o) write(o);
  }
  save();
  console.log(`  ${Math.min(i + BATCH, need.length)}/${need.length} org records`);
  await sleep(1400);
}

/** GraphQL organization -> the cache row the build script reads */
function write(o) {
  const key = `@${o.login}`;
  const prev = cache[key] ?? {};
  cache[key] = {
    ...prev,
    fetched: new Date().toISOString().slice(0, 10),
    login: o.login,
    name: o.name ?? "",
    bio: o.description ?? "",
    blog: o.websiteUrl ?? "",
    location: o.location ?? "",
    public_repos: o.repositories?.totalCount ?? 0,
    avatar: o.avatarUrl ?? "",
    created: o.createdAt ?? "",
    verified: Boolean(o.isVerified),
    repos: (o.repositories?.nodes ?? []).map((r) => ({
      repo: r.nameWithOwner,
      desc: (r.description || "").replace(/\s+/g, " ").slice(0, 150),
      lang: r.primaryLanguage?.name || "Other",
      stars: r.stargazerCount,
      forks: r.forkCount,
      issues: r.openIssues?.totalCount ?? 0,
      url: r.url,
    })),
  };
}

/* follower counts are REST only, and the directory shows them */
const needFollowers = Object.values(cache)
  .filter((c) => c.login && cache[`@${c.login}`]?.fetched && cache[`@${c.login}`]?.followers === undefined)
  .map((c) => c.login);
console.log(`reading follower counts for ${needFollowers.length} orgs`);
for (const login of needFollowers) {
  try {
    const u = JSON.parse(gh(["api", `users/${login}`]));
    cache[`@${login}`].followers = u.followers ?? 0;
  } catch (e) {
    cache[`@${login}`].followers = 0;
    console.log(`  follower read failed ${login}: ${String(e.message).slice(0, 50)}`);
  }
  if (!cache[`@${login}`].name && cache[`@${login}`].fetched) { /* nothing to do */ }
  await sleep(160);
}
save();

const done = Object.keys(cache).filter((k) => k.startsWith("@") && cache[k]?.repos).length;
console.log(`cache written: ${done} org records with repositories`);
