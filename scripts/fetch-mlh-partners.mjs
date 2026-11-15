/* ══ scripts/fetch-mlh-partners.mjs — the organizations MLH works with ══
   node scripts/fetch-mlh-partners.mjs

   MLH Fellowship publishes no participant or partner list, but it does leave a
   public trail: the MLH-Fellowship GitHub organization holds a fork of every
   repository a batch has worked on, and a fork's `parent` is the upstream
   organization that owns it. That is the closest thing to a partner roster the
   program offers, and it is verifiable one repo at a time.

     gh api "orgs/MLH-Fellowship/repos?per_page=100" --paginate   -> fork names
     gh api repos/MLH-Fellowship/<name>                           -> parent owner

   What this is and what it is not: it is evidence that MLH batch work happened
   against those repositories. It is not a batch-by-batch manifest - there is no
   per-batch list, and recent batches no longer use the fork pattern, so the set
   is historical rather than current. We label it that way. Forks of
   MLH-Fellowship's own repos are dropped - they are not partner organizations.

   Output: data/mlh-parents.json (cache) and public/data/mlh-partners.json. ═ */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "data/mlh-parents.json");
const OUT = join(ROOT, "public/data/mlh-partners.json");

const gh = (args) => {
  try {
    return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch { return ""; }
};

const forks = gh(["api", "orgs/MLH-Fellowship/repos?per_page=100", "--paginate",
  "--jq", ".[] | select(.fork==true) | .name"]).split("\n").map((s) => s.trim()).filter(Boolean);
if (!forks.length) throw new Error("no forked repositories read from MLH-Fellowship - refusing to write");
console.log(`MLH-Fellowship holds ${forks.length} forks of upstream repositories`);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
let done = 0;
for (const name of forks) {
  if (cache[name]) continue;
  const tsv = gh(["api", `repos/MLH-Fellowship/${encodeURIComponent(name)}`,
    "--jq", "[.name, .parent.full_name, .parent.owner.login, .parent.owner.type, .parent.description, .parent.stargazers_count, .pushed_at] | @tsv"]);
  const f = tsv.trim().split("\t");
  cache[name] = f[1] ? {
    fork: name, parent: f[1], owner: f[2], type: f[3],
    desc: String(f[4] ?? "").replace(/\s+/g, " ").slice(0, 160),
    stars: Number(f[5] ?? 0) || 0, pushed: String(f[6] ?? "").slice(0, 10),
  } : { fork: name, parent: null };
  if (++done % 40 === 0) {
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache));
    console.log(`  ${done}/${forks.length} parents resolved`);
  }
}
mkdirSync(dirname(CACHE), { recursive: true });
writeFileSync(CACHE, JSON.stringify(cache));

/* a fork of another MLH-Fellowship repo is not a partner */
const rows = Object.values(cache).filter((r) => r.parent && r.owner.toLowerCase() !== "mlh-fellowship");
const byOwner = new Map();
for (const r of rows) {
  const key = r.owner.toLowerCase();
  const e = byOwner.get(key) ?? { name: r.owner, login: r.owner, type: r.type, repos: new Set(), stars: 0, pushed: "" };
  e.repos.add(r.parent);
  e.stars += r.stars ?? 0;
  if (r.pushed > e.pushed) e.pushed = r.pushed;
  byOwner.set(key, e);
}

const orgs = [...byOwner.values()]
  .map((o) => ({
    name: o.name, login: o.login, type: o.type, projects: o.repos.size,
    repos: [...o.repos].sort().slice(0, 6), stars: o.stars, lastWork: o.pushed,
  }))
  .sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

const file = {
  generated: new Date().toISOString().slice(0, 10),
  source: "github.com/MLH-Fellowship - every fork and the upstream repository it was forked from",
  note: "MLH Fellowship publishes no partner list. What it does publish is a fork of every repository its batches worked on, and each fork names the organization upstream. That is evidence of work together, not a batch manifest - recent batches no longer fork this way, so the set is historical.",
  forks: forks.length,
  resolved: rows.length,
  owners: orgs.length,
  organizations: orgs.filter((o) => o.type === "Organization").length,
  orgs,
};
const tmp = OUT + ".tmp";
writeFileSync(tmp, JSON.stringify(file));
renameSync(tmp, OUT);

console.log(`${rows.length} forks resolved · ${orgs.length} upstream owners (${file.organizations} GitHub Organizations) · ${new Set(rows.map((r) => r.parent)).size} repositories`);
console.log(`top: ${orgs.filter((o) => o.type === "Organization").slice(0, 6).map((o) => `${o.name} (${o.projects})`).join(", ")}`);
