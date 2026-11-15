/* Fetch the real GitHub Sponsors / funding setup for the catalog's top repos.
   A repo is published only when .github/FUNDING.yml on its default branch
   exists and names at least one platform - that is the file that makes the
   Sponsor button appear. Repos that do not get published are NOT merged into
   one silent "no sponsors" bucket: the run counts each outcome apart -
   funded | absent (404) | failed (rate limit, server error, network) |
   unparseable (arrived but cannot be read as a funding config).
   Output: public/data/sponsors.json
   Run:  node scratch/fetch-sponsors.mjs [--offline]
   --offline re-reads the published JSON and never touches the network or gh. */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const OUT = "public/data/sponsors.json";

/* crude YAML: top-level "key:" followed by scalar or [a, b] or list items */
/** @returns {Record<string, string[]>} */
export function parseFunding(b64) {
  const text = Buffer.from(b64, "base64").toString("utf8");
  const out = {};
  let key = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) {
      key = m[1].toLowerCase();
      const v = m[2].replace(/\s*#.*$/, "").trim();
      if (!v) { out[key] = out[key] || []; continue; }
      if (v.startsWith("[")) {
        out[key] = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      } else out[key] = [v.replace(/^['"]|['"]$/g, "")];
    } else if (line.startsWith("- ") && key) {
      (out[key] = out[key] || []).push(line.slice(2).trim().replace(/^['"]|['"]$/g, ""));
    }
  }
  return out;
}

/* One repo's read of its funding file, decided as pure logic over the
   transport so a vitest stub can drive every branch. `get(url)` resolves to
   a Response-shaped object (or null) and may throw. */
export async function fundingOutcome(repo, get) {
  const [owner, name] = repo.split("/");
  const url = `https://api.github.com/repos/${owner}/${name}/contents/.github/FUNDING.yml`;
  let res;
  try { res = await get(url); } catch { return { outcome: "failed" }; }
  if (!res || res.status === 404) return { outcome: "absent" };
  if (!res.ok) return { outcome: "failed" };
  try {
    const body = await res.json();
    const platforms = parseFunding(body.content);
    if (!Object.keys(platforms).length) return { outcome: "unparseable" };
    return { outcome: "funded", platforms };
  } catch { return { outcome: "unparseable" }; }
}

/* the run's receipt: the published count first, then the three reasons a
   scanned repo is not in the directory - never lumped into one "no sponsors" */
export function tallyLine(t) {
  const why = t.absent === undefined
    ? "outcome breakdown not recorded in this snapshot"
    : `${t.absent} absent, ${t.failed} failed to fetch, ${t.unparseable} unparseable`;
  return `DONE  ${t.funded} funded repos of ${t.scanned} scanned (${why})`;
}

const platformLine = (items) => {
  const c = (f) => items.filter(f).length;
  return `github: ${c((i) => i.platforms.github)}` +
    ` patreon: ${c((i) => i.platforms.patreon)}` +
    ` opencollective: ${c((i) => i.platforms.open_collective || i.platforms.opencollective)}` +
    ` custom: ${c((i) => i.platforms.custom)}`;
};

async function offlineRun() {
  let data;
  try {
    data = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    console.error(`offline: no published snapshot at ${OUT} - run without --offline first`);
    process.exitCode = 1;
    return;
  }
  console.log(`offline: reading the published snapshot at ${OUT}, no network`);
  console.log(tallyLine({ scanned: data.scanned, funded: data.items.length, ...data.tally }));
  console.log(platformLine(data.items));
}

async function main() {
  if (process.argv.includes("--offline")) return offlineRun();

  const TOKEN = execSync("gh auth token", { encoding: "utf8" }).trim();
  const src = readFileSync("src/data/repos.ts", "utf8");
  const repos = [];
  for (const line of src.split("\n")) {
    const t = line.trim().replace(/,$/, "");
    if (t.startsWith("{") && t.endsWith("}")) {
      try { repos.push(JSON.parse(t)); } catch { /* not a row */ }
    }
  }
  const top = repos.sort((a, b) => b.stars - a.stars).slice(0, 260);
  console.log(`scanning ${top.length} repos, ${repos.length} in catalog`);

  const get = (url) => fetch(url, { headers: {
    Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json",
    "User-Agent": "cyrus-sponsors-scan", "X-GitHub-Api-Version": "2022-11-28",
  }});

  const items = [];
  const tally = { absent: 0, failed: 0, unparseable: 0 };
  let done = 0;
  const QUEUE = [...top];
  async function worker() {
    while (QUEUE.length) {
      const r = QUEUE.shift();
      const res = await fundingOutcome(r.repo, get);
      tally[res.outcome]++;
      if (res.outcome === "funded") {
        items.push({ repo: r.repo, stars: r.stars, lang: r.lang, desc: r.desc,
          url: `https://github.com/${r.repo}`, platforms: res.platforms });
      }
      done++;
      if (done % 40 === 0) {
        console.log(`  ${done}/${top.length} checked, ${items.length} funded, ` +
          `${tally.absent} absent, ${tally.failed} failed, ${tally.unparseable} unparseable`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

  items.sort((a, b) => b.stars - a.stars);
  const data = { crawledAt: new Date().toISOString().slice(0, 10), scanned: top.length, tally, items };
  writeFileSync(OUT, JSON.stringify(data));
  console.log(tallyLine({ scanned: top.length, funded: items.length, ...tally }));
  console.log(platformLine(items));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
