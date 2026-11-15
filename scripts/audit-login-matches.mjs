/* ══ scripts/audit-login-matches.mjs — re-check every org -> GitHub login pair
   the crawler recorded, with the shared rulebook in scripts/lib/org-match.mjs.

   node scripts/audit-login-matches.mjs          report only
   node scripts/audit-login-matches.mjs --prune  revoke what fails

   Why this exists: the first pass matched on "the login equals the name after
   dropping boilerplate", and the word "org" is boilerplate - so cvat-org looked
   like a perfect answer for CVAT, dart-org like one for Dart, apidash-org like
   one for API Dash. All three are empty placeholder accounts. The rulebook now
   demands that the account itself carries an identity, and this script applies
   it to everything already in the cache, so an old match cannot outlive the rule
   that made it. Records with no fetched GitHub account yet are counted, not
   judged - there is nothing to check them against. ═══════════════════════════ */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { accepts, norm, bare } from "./lib/org-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "data/org-login-cache.json");
const ROSTER = join(ROOT, "public/data/program-roster.json");
const PRUNE = process.argv.includes("--prune");

const cache = JSON.parse(readFileSync(CACHE, "utf8"));

/* GitHub logins are case-insensitive, and the two passes that write this cache
   do not agree on which casing the API handed back. Look the account up by
   lowercase so a match is never judged against the wrong record - or none. */
const byLower = new Map();
for (const [k, v] of Object.entries(cache)) if (k.startsWith("@")) byLower.set(k.slice(1).toLowerCase(), v);
const recOf = (login) => byLower.get((login || "").toLowerCase());

/* a match can only be judged against the account's own record. The candidate
   pass leaves a "pending" placeholder behind until fetch-org-records.mjs reads
   the real one, and a placeholder proves nothing either way - so it is counted
   as unread rather than revoked. */
const isRead = (rec) => rec && rec.fetched && rec.fetched !== "pending" && rec.fetched !== "failed";

/* does the program archive itself point at this GitHub account? that is the
   organizers naming the account, which outranks any spelling we can guess. */
const roster = JSON.parse(readFileSync(ROSTER, "utf8"));
const listed = new Set();
for (const data of Object.values(roster.programs ?? {})) {
  for (const o of data.orgs ?? []) {
    const m = /^https?:\/\/github\.com\/([^/?#]+)/i.exec(o.url ?? "");
    if (m) listed.add(`${norm(o.name)}\t${m[1].toLowerCase()}`);
  }
}
const programNamesTheAccount = (name, login) =>
  listed.has(`${norm(name)}\t${login.toLowerCase()}`);

const pass = [], fail = [], blind = [], hand = [];

for (const [name, row] of Object.entries(cache)) {
  if (name.startsWith("@") || !row.login) continue;
  /* a human looked at the account and wrote down why it is the right one; the
     rulebook cannot re-derive that, and re-judging it would only lose it */
  if (row.hand_checked) { hand.push(`${name} -> ${row.login}   ${row.matched_on || ""}`); continue; }
  const rec = recOf(row.login);
  if (!isRead(rec)) { blind.push(`${name} -> ${row.login}`); continue; }
  const why = accepts({ ...rec, type: "Organization" }, name) ||
    (programNamesTheAccount(name, row.login) ? "the program archive links this account" : "");
  if (why) pass.push([name, row.login, why]);
  else fail.push([name, row.login, rec]);
}

console.log(`${pass.length} stand up to the rulebook, ${fail.length} do not, ${blind.length} not yet read, ${hand.length} settled by hand`);

if (hand.length) {
  console.log("\nchecked by a human, not by the rulebook:");
  for (const h of hand) console.log(`  ${h}`);
}

/* ── the one place the rulebook can still be fooled ─────────────
   "SONiC Foundation" folds to "sonic", and an account whose login is
   literally "sonic" spells it - but the real SONiC Foundation runs
   sonic-net, and that little account is someone else entirely. Any
   institution word (Foundation / Project / Association …) in the roster
   name means the distinctive word alone names a whole family of entities,
   so a bare login match is only safe when the account agrees in another
   way: its display name carries the institution phrase, its website host
   spells the word, or the program archive itself links that account.
   Everything else is listed here for a human to settle.             ═ */
const INSTITUTION = /\b(foundation|project|organization|organisation|consortium|association|institute|institution|society|alliance|federation|initiative|movement|community|working group|collaborative|network|trust|council|board|lab|labs|center|centre)\b/i;
const risky = pass.filter(([name, login, why]) => {
  if (why !== "login spells the name") return false;
  if (!INSTITUTION.test(name)) return false;
  const rec = recOf(login) ?? {};
  const w = norm(name).split(" ")[0];
  if (rec.name && INSTITUTION.test(rec.name) && norm(rec.name).includes(w)) return false;
  if (rec.blog && bare(rec.blog).includes(w)) return false;
  if (programNamesTheAccount(name, login)) return false;
  return true;
});
if (risky.length) {
  console.log(`\ninstitution names resting on the login alone - check these by eye:`);
  for (const [name, login] of risky) {
    const rec = recOf(login) ?? {};
    console.log(`  ${name.padEnd(36)} -> ${login.padEnd(18)} name "${(rec.name || "").slice(0, 32)}" site "${(rec.blog || "").slice(0, 28)}" repos ${rec.public_repos ?? "?"}`);
  }
}

if (fail.length) {
  console.log("\nrevoked or to revoke:");
  for (const [name, login, rec] of fail) {
    console.log(`  ${name} -> ${login}   (name "${rec.name || ""}", site "${rec.blog || ""}", ${rec.public_repos ?? "?"} repos)`);
  }
}
if (PRUNE) {
  const read = Object.entries(cache).filter(([k, v]) => k.startsWith("@") && isRead(v)).length;
  if (read < Math.max(20, pass.length)) {
    console.error(`only ${read} account records have been read - run scripts/fetch-org-records.mjs before pruning`);
    process.exit(1);
  }
  for (const [name] of fail) cache[name] = { ...cache[name], login: null, revoked: "failed the audit rulebook", checked: new Date().toISOString().slice(0, 10) };
  const tmp = CACHE + ".tmp";
  writeFileSync(tmp, JSON.stringify(cache, null, 1));
  renameSync(tmp, CACHE);
  console.log(`\npruned ${fail.length} matches from the cache`);
} else {
  console.log(`\n(dry run - add --prune to revoke the ${fail.length} above)`);
}

const held = Object.entries(cache).filter(([k, v]) => !k.startsWith("@") && v.login).length;
console.log(`${held} roster organizations currently carry a GitHub account`);
if (blind.length) console.log(`${blind.length} of them wait on fetch-org-records.mjs before they can be judged`);
