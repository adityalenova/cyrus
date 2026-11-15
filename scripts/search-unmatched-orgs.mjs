/* ══ scripts/search-unmatched-orgs.mjs — the roster names our own guesses could not spell
   node scripts/search-unmatched-orgs.mjs [--dry]

   The two passes before this one both start from the roster name and try to
   spell a login out of it: the search-API pass looks for the name, the
   candidate pass guesses its words, acronyms and slugs. That gets 278 of 402.
   The rest are accounts that simply are not spelled from their own name -
   JuliaLang for "The Julia Language", linuxfoundation for "The Linux
   Foundation", rust-lang for "The Rust Foundation".

   So this pass asks GitHub who it would file a name under, and then makes the
   account prove it. The search only ever supplies candidates; the decision is
   the shared rulebook in scripts/lib/org-match.mjs reading the account's own
   login, display name, website and repository count. A name that clears the
   rulebook with every suggestion stays unplaced, and the roster shows it with
   its archive numbers and no GitHub figures.

   Search is 30 requests a minute, so this is slow on purpose.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { accepts, norm } from "./lib/org-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "data/org-login-cache.json");
const ROSTER = join(ROOT, "public/data/program-roster.json");
const DRY = process.argv.includes("--dry");

/* stderr stays piped: gh prints every 404 it sees and there are hundreds here */
const gh = (path) => JSON.parse(execFileSync("gh", ["api", path], { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const save = () => { const t = CACHE + ".tmp"; writeFileSync(t, JSON.stringify(cache, null, 1)); renameSync(t, CACHE); };

const roster = JSON.parse(readFileSync(ROSTER, "utf8"));
const names = [...new Set(Object.values(roster.programs).flatMap((p) => (p.orgs || []).map((o) => o.name)))].sort();

/* an account already held by another roster name is not free to claim twice */
const taken = new Set(Object.values(cache).filter((v) => v?.login).map((v) => v.login.toLowerCase()));

const todo = names.filter((n) => !cache[n]?.login && !cache[n]?.revoked);
console.log(`${names.length} roster names, ${todo.length} still unplaced`);
if (DRY) { console.log(todo.join("\n")); process.exit(0); }

/** what GitHub would file this name under, best suggestion first */
const suggestions = (name) => {
  const q = encodeURIComponent(`${name} type:org`);
  try { return (gh(`search/users?q=${q}&per_page=6`).items ?? []).map((u) => u.login); }
  catch (e) {
    const msg = String(e.message || e);
    if (/rate limit|403|secondary/i.test(msg)) return "ratelimited";
    return [];
  }
};

/** the live record for one login, or null when GitHub has no such account */
const record = (login) => {
  try { return gh(`users/${encodeURIComponent(login)}`); }
  catch { return null; }
};

let placed = 0, lookups = 0;
for (let i = 0; i < todo.length; i++) {
  const name = todo[i];
  const hits = suggestions(name);
  if (hits === "ratelimited") { console.log(`  search rate limited at ${i}, pausing 70s`); await sleep(70000); i--; continue; }

  let why = "";
  for (const login of hits) {
    if (taken.has(login.toLowerCase())) continue;
    const u = record(login); lookups++;
    await sleep(120);
    const proof = accepts(u, name);
    if (proof) {
      cache[name] = { ...(cache[name] ?? {}), login, matched_on: proof, via: "search suggestion", checked: new Date().toISOString().slice(0, 10) };
      cache[`@${login}`] = { ...(cache[`@${login}`] ?? {}), fetched: "pending", login };
      taken.add(login.toLowerCase());
      why = `${login} (${proof})`;
      placed++;
      console.log(`  + ${name} = ${why}`);
      break;
    }
  }
  if (!why) console.log(`  · ${name} - ${hits.length ? hits.slice(0, 3).join(", ") + " none proven" : "no suggestion"}`);
  cache[name] = { ...(cache[name] ?? {}), suggestions: hits === "ratelimited" ? [] : hits.slice(0, 6), searched: new Date().toISOString().slice(0, 10) };
  if (i % 10 === 9) { save(); console.log(`  ${i + 1}/${todo.length} searched, ${placed} placed, ${lookups} lookups`); }
  await sleep(2200);
}
save();

const held = Object.entries(cache).filter(([k, v]) => !k.startsWith("@") && v.login).length;
console.log(`done: ${placed} more placed, ${held}/${names.length} roster orgs now have a GitHub account (${lookups} lookups)`);
