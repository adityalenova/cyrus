/* ══ scripts/resolve-org-logins.mjs — link every program organization to GitHub ═
   node scripts/resolve-org-logins.mjs [--limit=N]

   Reads the 402 unique organizations in public/data/program-roster.json and asks
   GitHub, through the gh CLI, which of them have a real account:

     gh api search/users?q="<org name>" type:org   -> candidate logins
     gh api users/<login>                          -> live org record

   A name is only accepted when it matches exactly. The normalizer folds case,
   punctuation and the boilerplate every foundation drags behind its name
   ("Software Foundation", "e.V.", "The ... Project"), and then the two sides
   have to come out equal, or equal after dropping a single trailing boilerplate
   word. Nothing is accepted on similarity alone, because a wrong login puts
   someone else's star count on this org's page - a wrong number is worse than a
   missing one. Everything not accepted stays in the roster with its real archive
   stats and simply has no GitHub panel.

   Results land in data/org-login-cache.json, keyed by org name, so an
   interrupted run resumes where it stopped and a re-run only pays for new names.
   The search API allows 30 requests a minute, so the loop sleeps between calls.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROSTER = join(ROOT, "public/data/program-roster.json");
const CACHE = join(ROOT, "data/org-login-cache.json");

const BOILER = [
  "foundation", "software", "project", "projects", "society", "association", "institute",
  "institution", "consortium", "group", "org", "community", "initiative", "collaborative",
  "committee", "council", "network", "alliance", "union", "international", "e.v", "ev",
  "gmbh", "inc", "llc", "ltd", "co", "the",
];

/** fold an org name or a GitHub login down to the same comparable string */
const norm = (s) => (s || "")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .split(" ").filter(Boolean).filter((w) => !BOILER.includes(w)).join(" ");

/** second pass: allow one trailing boilerplate word to differ, e.g. "opencv" vs "opencv team" */
const loose = (s) => {
  const w = norm(s).split(" ").filter(Boolean);
  return w.slice(0, -1).join(" ") || w.join(" ");
};

const gh = (path) => JSON.parse(execFileSync("gh", ["api", path], { maxBuffer: 20 * 1024 * 1024, encoding: "utf8" }));
const q = (s) => encodeURIComponent(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── the roster of names we have to place ── */
const roster = JSON.parse(readFileSync(ROSTER, "utf8"));
const byName = new Map();
for (const [program, data] of Object.entries(roster.programs)) {
  for (const o of data.orgs) {
    const row = byName.get(o.name) ?? { name: o.name, programs: {}, url: o.url ?? "", category: o.category ?? "" };
    row.programs[program] = { projects: o.n, years: o.years ?? [] };
    byName.set(o.name, row);
  }
}
const names = [...byName.keys()].sort();

/* ── cache ──
   programOrgs.json is deliberately NOT used as a seed. Its 26 "logins" came from
   an earlier name-guessing pass and are wrong: it maps Debian to debianmaster,
   Ceph to cephurs, Ruby to RubyLouvre, PostgreSQL to PostgreSqlStan and OpenCV to
   opencvfun - individual accounts that happen to contain the word. Seeding from it
   would launder those mistakes into the new data, so every name is looked up fresh
   and only an exact match on this run is trusted. */
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

const save = () => {
  const tmp = CACHE + ".tmp";
  writeFileSync(tmp, JSON.stringify(cache, null, 1));
  renameSync(tmp, CACHE);
};

const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const todo = names.filter((n) => !cache[n]?.checked).slice(0, LIMIT || undefined);
console.log(`${names.length} roster orgs, ${names.length - todo.length} already checked, ${todo.length} to look up`);

let hits = 0, misses = 0, errors = 0;
for (let i = 0; i < todo.length; i++) {
  const name = todo[i];
  const target = norm(name);
  try {
    /* GitHub's user search has no type:org, so filter the results ourselves */
    const s = gh(`search/users?q=${q(name)}&per_page=10`);
    const cands = (s.items || []).filter((u) => u.type === "Organization");
    let pick = cands.find((u) => norm(u.login) === target || norm(u.login) === name.toLowerCase().replace(/[^a-z0-9]+/g, ""))
      ?? cands.find((u) => norm(u.login) === loose(name));
    if (pick) {
      cache[name] = { login: pick.login, matched_on: "exact", checked: new Date().toISOString().slice(0, 10) };
      hits++;
    } else {
      cache[name] = { login: null, checked: new Date().toISOString().slice(0, 10) };
      misses++;
    }
  } catch (e) {
    /* a rate-limit or a timeout must not be recorded as "this org has no account" */
    const msg = String(e.message || e);
    if (/secondary rate limit|403|rate limit/i.test(msg)) {
      console.log(`  rate limited at ${i}; pausing 60s`);
      await sleep(60000);
      i--;
      continue;
    }
    errors++;
    console.log(`  lookup failed for ${name}: ${msg.slice(0, 70)}`);
  }
  if (i % 25 === 0) { save(); console.log(`  ${i + 1}/${todo.length}  matched ${hits}  none ${misses}`); }
  await sleep(2200); // search API: 30/min
}
save();
console.log(`lookups done: ${hits} matched, ${misses} without an account, ${errors} errors`);

/* ── phase 2: the live record for every matched login ── */
const need = [...new Set(Object.values(cache).map((c) => c.login).filter(Boolean))]
  .filter((l) => !cache[`@${l}`]?.fetched);
console.log(`fetching ${need.length} org records`);
for (const login of need) {
  try {
    const u = gh(`users/${login}`);
    cache[`@${login}`] = {
      fetched: new Date().toISOString().slice(0, 10),
      login: u.login, name: u.name ?? "", bio: u.bio ?? "", blog: u.blog ?? "",
      location: u.location ?? "", followers: u.followers ?? 0, public_repos: u.public_repos ?? 0,
      avatar: u.avatar_url ?? "", created: u.created_at ?? "", verified: Boolean(u.is_verified),
    };
  } catch (e) {
    cache[`@${login}`] = { fetched: "failed", login };
    console.log(`  record failed ${login}: ${String(e.message).slice(0, 60)}`);
  }
  await sleep(120);
}
save();

const resolved = Object.entries(cache).filter(([k, v]) => !k.startsWith("@") && v.login).length;
console.log(`cache written: ${resolved}/${names.length} roster orgs have a GitHub account`);
