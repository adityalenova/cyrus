/* ══ scripts/verify-login-candidates.mjs — a second, harder pass for the names
   the user search could not place.
   node scripts/verify-login-candidates.mjs [--only=<substring>] [--limit=N] [--dry]

   resolve-org-logins.mjs asks GitHub "who is called exactly this?" and only
   accepts an exact answer. That is safe but it misses every organization whose
   account is spelled differently from the name on the program roster - Jenkins
   lives at jenkinsci, Blender at blender, the Django Software Foundation at
   django. None of those strings equal their own name, so search never returns
   them as an exact hit.

   This pass guesses candidate logins (name with the boilerplate removed, the
   acronym, the parenthetical, the GSoC slug) and then asks the live GitHub
   record to prove the guess with its OWN fields:

     type == Organization, AND one of
     - the login, normalized, equals the roster name normalized
     - the account's display name, normalized, equals the roster name
     - the account's website domain equals the roster name's core word

   So nothing is accepted because it looks similar; it is accepted because the
   organization itself says so on GitHub. Unproven guesses are written to
   cache as candidates with why they were rejected, never as a login.

   Uses the core API (5000/hr) instead of search (30/min), so it can try eight
   guesses per name in the time the search pass spends on one.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BOILER, norm, squash, accepts } from "./lib/org-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "data/org-login-cache.json");
const ROSTER = join(ROOT, "public/data/program-roster.json");
const GSOC = join(ROOT, "public/data/gsoc-orgs.json");

/* stderr stays piped: a 404 is an expected answer here, and gh shouting it
   into the log for every wrong guess buries the matches */
const gh = (path) => JSON.parse(execFileSync("gh", ["api", path], { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── slugs the GSoC archive carries, useful because they are the org's own
   name with the punctuation folded away ── */
const slugByName = new Map();
if (existsSync(GSOC)) {
  const g = JSON.parse(readFileSync(GSOC, "utf8"));
  for (const year of Object.keys(g)) for (const o of g[year] || []) {
    if (o.slug && !slugByName.has(o.name)) slugByName.set(o.name, o.slug);
  }
}

/** every login a name could plausibly be filed under, most likely first */
function candidates(name) {
  const out = [];
  const push = (s) => {
    const c = String(s || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "").replace(/^[._-]+|[._-]+$/g, "");
    if (c.length > 1 && c.length <= 32 && !out.includes(c)) out.push(c);
  };
  const words = norm(name).split(" ").filter(Boolean);
  words.forEach(push);                       /* Blender Foundation -> blender */
  push(words.join(""));                      /* GNU Image Manipulation Program -> gnuimage... */
  push(words.join("-"));                     /* Open Source Initiative -> open-source-initiative */
  if (words.length > 1) push(words.slice(0, 2).join(""));
  const paren = (name.match(/\(([^)]+)\)/) || [])[1];
  if (paren) { push(paren); push(paren.replace(/[^a-z0-9]/gi, "")); }        /* (CNCF) */
  const caps = (name.match(/\b[A-Z]{2,}\b/g) || []);
  caps.forEach(push);                        /* "LF Networking" -> LF, "..." */
  if (words.length > 2) push(words.map((w) => w[0]).join(""));               /* initials */
  const slug = slugByName.get(name) || "";
  if (slug) {
    const sw = slug.split(/[^a-z0-9]+/i).filter((w) => !BOILER.includes(w));
    (sw[0] || "").length > 2 && push(sw[0]);
    push(sw.join("")); push(sw.join("-"));
  }
  /* No "-org" / "-project" / "hq" suffix guessing. Those variants exist on
     GitHub as empty placeholder accounts - cvat-org holds one abandoned repo
     called cvat2, dart-org and apidash-org hold nothing at all - and the old
     normalizer made them look like exact matches because it stripped the word
     "org" off the login. A guess that only matches because of a suffix we added
     is not evidence, so the guess is not made. */
  return out.slice(0, 12);
}

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const save = () => { const t = CACHE + ".tmp"; writeFileSync(t, JSON.stringify(cache, null, 1)); renameSync(t, CACHE); };

const roster = JSON.parse(readFileSync(ROSTER, "utf8"));
const names = [...new Set(Object.values(roster.programs).flatMap((p) => (p.orgs || []).map((o) => o.name)))].sort();

const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";
const DRY = process.argv.includes("--dry");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const todo = names
  .filter((n) => !cache[n]?.login)                 /* unresolved */
  .filter((n) => !(cache[n]?.attempts && !cache[n]?.login))  /* not already tried */
  .filter((n) => !ONLY || n.toLowerCase().includes(ONLY.toLowerCase()))
  .slice(0, LIMIT || undefined);

console.log(`${names.length} roster names, ${todo.length} to attempt`);
if (DRY) {
  for (const n of todo.slice(0, 12)) console.log(`  ${n}  ->  ${candidates(n).join(", ")}`);
  process.exit(0);
}

let found = 0, tried = 0;
for (let i = 0; i < todo.length; i++) {
  const name = todo[i];
  const cands = candidates(name);
  const notes = [];
  let hit = null;
  for (const c of cands) {
    try {
      const u = gh(`users/${c}`);
      const why = accepts(u, name);
      if (why) {
        hit = { login: u.login, why };
        cache[`@${u.login}`] = cache[`@${u.login}`]?.fetched ? cache[`@${u.login}`] : {
          fetched: "pending", login: u.login,
        };
        break;
      }
      notes.push(`${c}:${u ? (u.type === "Organization" ? "not-this-org" : "person") : "gone"}`);
    } catch (e) {
      notes.push(`${c}:404`);
    }
    tried++;
    await sleep(220);
  }
  cache[name] = {
    login: hit ? hit.login : null,
    matched_on: hit ? hit.why : null,
    attempts: cands,
    rejected: notes.slice(0, 14),
    checked: new Date().toISOString().slice(0, 10),
  };
  if (hit) { found++; console.log(`  + ${name} = ${hit.login} (${hit.why})`); }
  if (i % 20 === 0) { save(); console.log(`  ${i + 1}/${todo.length}  newly placed ${found}  lookups ${tried}`); }
}
save();
const all = Object.entries(cache).filter(([k, v]) => !k.startsWith("@") && v.login).length;
console.log(`done: ${found} more placed, ${all}/${names.length} roster orgs now have a GitHub account (${tried} lookups)`);
