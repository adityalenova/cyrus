/* ══ scripts/refresh.mjs — cyrus.ai auto-update pipeline ══════════════
   node scripts/refresh.mjs            # every credential-free builder
   node scripts/refresh.mjs gsoc       # the GSoC project archive only
   node scripts/refresh.mjs issues     # the crawl-derived issue snapshot only
   node scripts/refresh.mjs roster     # the program roster only
   node scripts/refresh.mjs mentors    # the mentor index only

   Four datasets are rebuilt here, each by the script that owns it:

     gsoc     public/data/gsoc-projects.json      fetched below from the
                                                  public GSoC API (no credential)
     issues   src/data/issueSignals.ts            scripts/build-crawl-data.mjs
              src/data/crawlStats.ts              (reads data/crawl/issues.jsonl)
     roster   public/data/program-roster.json     scripts/build-program-roster.mjs
     mentors  public/data/mentor-index.json       scripts/build-mentor-index.mjs

   `all` means every credential-free builder. The GitHub crawl that produces
   data/crawl/issues.jsonl is not run here: it needs GH_TOKEN
   (scripts/crawl-github.mjs) and hours of rate-limited requests, so when that
   input is missing the issue snapshot step says so and names the variable
   instead of disappearing from the run.

   The README's "Dataset rebuild" line is written only from the datasets this
   run actually rebuilt, and only after every requested builder succeeded. A
   builder that exits non-zero aborts the run before the README is touched.
   ═════════════════════════════════════════════════════════════════════ */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;
const clean = (s) => (s || "").replace(EMOJI, "").replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
const today = new Date().toISOString().slice(0, 10);

const README_OPEN = "<!--refresh:datasets-->";
const README_CLOSE = "<!--/refresh:datasets-->";

/** The datasets this pipeline rebuilds, in the order the README lists them. */
export const DATASETS = [
  {
    id: "gsoc",
    label: "GSoC archive",
    builder: null, // fetched in this file; the public API needs no credential
    writes: "public/data/gsoc-projects.json",
  },
  {
    id: "issues",
    label: "issue snapshot",
    builder: "scripts/build-crawl-data.mjs",
    input: "data/crawl/issues.jsonl",
    // the builder itself reads a file and needs no credential; the crawl that
    // writes that file does, so a missing input is reported with the variable
    tokenGatedBy: "GH_TOKEN",
    writes: "src/data/issueSignals.ts + src/data/crawlStats.ts",
  },
  {
    id: "roster",
    label: "program roster",
    builder: "scripts/build-program-roster.mjs",
    writes: "public/data/program-roster.json",
  },
  {
    id: "mentors",
    label: "mentor index",
    builder: "scripts/build-mentor-index.mjs",
    writes: "public/data/mentor-index.json",
  },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Which datasets a invocation asks for, and which of them must be skipped.
 * Pure: the environment and the presence of the crawl input arrive as
 * arguments, so a test can ask "what would `all` do without GH_TOKEN".
 *
 * @param {string} which a dataset id, or "all"
 * @param {{ env?: Record<string, string|undefined>, hasCrawlInput?: boolean }} [context]
 * @returns {{ ok: boolean, datasets: Array<object>, usage?: boolean }}
 */
export function planRefresh(which, { env = {}, hasCrawlInput = true } = {}) {
  const key = String(which ?? "all").toLowerCase() || "all";
  let chosen;
  if (key === "all") chosen = DATASETS; // all credential-free builders
  else {
    const hit = DATASETS.find((d) => d.id === key);
    if (!hit) return { ok: false, usage: true, datasets: [] };
    chosen = [hit];
  }

  const datasets = chosen.map((dataset) => ({ ...dataset, skip: null }));
  for (const step of datasets) {
    if (step.id === "issues" && !hasCrawlInput) {
      step.skip = env.GH_TOKEN
        ? `${step.input} is missing; run scripts/crawl-github.mjs --phase issues first (GH_TOKEN is set, so the crawl can run)`
        : `${step.input} is missing and scripts/crawl-github.mjs cannot rebuild it because ${step.tokenGatedBy} is not set`;
    }
  }
  return { ok: true, datasets };
}

/**
 * What the README should say after a run. Nothing when a builder failed (the
 * run aborts before stamping) and nothing when no dataset was rebuilt, so the
 * line always means "these datasets were rebuilt now".
 *
 * Only the rebuilt datasets get this run's date; a date that was already on
 * the line for another dataset is carried forward untouched.
 *
 * @param {{ results: Array<{id: string, status: string, reason?: string}>,
 *           previous?: Record<string, string>, date: string }} opts
 * @returns {{ write: boolean, dates: Record<string, string>, reason?: string, rebuilt?: string[] }}
 */
export function stampPlan({ results, previous = {}, date }) {
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length) {
    return { write: false, dates: { ...previous }, reason: `no stamp: ${failed.map((r) => r.id).join(", ")} failed` };
  }
  const rebuilt = results.filter((r) => r.status === "rebuilt");
  if (!rebuilt.length) {
    return { write: false, dates: { ...previous }, reason: "no dataset was rebuilt in this run" };
  }
  const dates = { ...previous };
  for (const result of rebuilt) dates[result.id] = date;
  return { write: true, dates, rebuilt: rebuilt.map((r) => r.id) };
}

/** The per-dataset dates already recorded in the README, by dataset id. */
export function parseRefreshLine(readme) {
  const block = String(readme).match(new RegExp(`${escapeRe(README_OPEN)}([\\s\\S]*?)${escapeRe(README_CLOSE)}`))?.[1];
  const dates = {};
  if (!block) return dates;
  for (const dataset of DATASETS) {
    const found = block.match(new RegExp(`${escapeRe(dataset.label)}\\s+(\\d{4}-\\d{2}-\\d{2})`));
    if (found) dates[dataset.id] = found[1];
  }
  return dates;
}

/** The marker block itself: one readable date per dataset that has one. */
export function renderRefreshLine(dates) {
  const entries = DATASETS.filter((d) => dates[d.id]).map((d) => `${d.label} ${dates[d.id]}`);
  if (!entries.length) throw new Error("no dated dataset to record in the README");
  return [
    README_OPEN,
    `**Dataset rebuild** - ${entries.join("; ")}. Each date is the day that dataset was last rebuilt by \`npm run refresh\`; a dataset that is not listed was not rebuilt by any recorded run.`,
    README_CLOSE,
  ].join("\n");
}

/** Replace the block in place; refuse to guess when the markers are gone. */
export function applyRefreshStamp(readme, dates) {
  const block = new RegExp(`${escapeRe(README_OPEN)}[\\s\\S]*?${escapeRe(README_CLOSE)}`);
  if (!block.test(readme)) {
    throw new Error(`Cannot find the dataset rebuild markers in README.md (${README_OPEN} ... ${README_CLOSE})`);
  }
  return readme.replace(block, renderRefreshLine(dates));
}

/**
 * Write the README line for the datasets this run rebuilt. `io` is injectable
 * so a test can assert the decision without touching the repository README.
 *
 * @param {string} root repository root
 * @param {{ results: Array<object>, date: string, readFile?: Function, writeFile?: Function }} opts
 */
export function updateReadmeSnapshot(root, { results, date, readFile = readFileSync, writeFile = writeFileSync }) {
  const path = join(root, "README.md");
  const readme = readFile(path, "utf8");
  const previous = parseRefreshLine(readme);
  const plan = stampPlan({ results, previous, date });
  if (!plan.write) return { written: false, reason: plan.reason, dates: plan.dates };

  const updated = applyRefreshStamp(readme, plan.dates);
  if (updated === readme) return { written: false, reason: "README already carries these dates", dates: plan.dates };
  writeFile(path, updated);
  return { written: true, dates: plan.dates, rebuilt: plan.rebuilt };
}

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

/* ── 1. GSoC archive → public/data/gsoc-projects.json ──────────────────
     Accepted projects are the archive /projects reads; the open-issue
     crawl lives in scripts/crawl-github.mjs and scripts/build-crawl-data.mjs.
*/
async function refreshGsoc() {
  const BASE = "https://summerofcode.withgoogle.com/api";
  const FIRST_YEAR = 2022; // the archive starts here; the window runs on to the current year
  const YEARS = Array.from({ length: new Date().getFullYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const projects = [], orgs = {};
  const skipped = {}; // year -> rows dropped for falling outside YEARS
  const seenUids = new Set(); // NOTE: the live API currently ignores year= and returns the same
                               // mixed 2022-2026 archive page, so dedupe uids across passes.
  for (const year of YEARS) {
    const list = await get(`${BASE}/projects/?year=${year}`);
    if (!list?.result) { console.log("  no list for", year); continue; }
    const uids = list.result;
    let kept = 0, done = 0;
    const CONC = 12;
    for (let i = 0; i < uids.length; i += CONC) {
      const batch = await Promise.all(uids.slice(i, i + CONC).map((u) => get(`${BASE}/projects/${u}/`)));
      for (const j of batch) {
        done++;
        const p = j?.entities?.projects?.[0];
        if (!p || p.status !== "passed") continue;
        const yr = +p.program_slug || year; // trust the entity's program year when present
        if (seenUids.has(p.uid)) continue;
        seenUids.add(p.uid);
        if (!YEARS.includes(yr)) { skipped[yr] = (skipped[yr] || 0) + 1; continue; }
        const orgEnt = (j.entities.organizations || []).find((o) => o.uid === p.organization_id) || (j.entities.organizations || [])[0];
        const orgName = clean(orgEnt?.name || p.organization || "").slice(0, 80);
        if (orgEnt?.name) orgs[orgName] = { url: orgEnt.url || "", category: orgEnt.category || "" };
        kept++;
        projects.push({
          y: yr, u: p.uid,
          t: clean(p.title).slice(0, 120), o: orgName, s: p.size || "medium",
          tt: (p.tech_tags || []).slice(0, 5).map((x) => clean(x).slice(0, 22)).filter(Boolean),
          tp: (p.topic_tags || []).slice(0, 3).map((x) => clean(x).slice(0, 26)).filter(Boolean),
          b: clean(p.body).slice(0, 200), m: clean(p.mentors_display_name || "").slice(0, 60),
        });
      }
    }
    console.log(`gsoc ${year}: ${kept}/${done} accepted kept`);
  }
  const dropped = Object.entries(skipped).map(([y, n]) => `${y}: ${n}`).join(", ");
  if (dropped) console.log(`gsoc: skipped rows outside ${YEARS[0]}-${YEARS.at(-1)} (${dropped})`);
  if (projects.length < 5000) {
    const reason = `only ${projects.length} projects - archive looks degraded, keeping the existing file`;
    console.log(`gsoc: ${reason}`);
    return { status: "skipped", reason };
  }
  mkdirSync(join(ROOT, "public/data"), { recursive: true });
  writeFileSync(join(ROOT, "public/data/gsoc-projects.json"), JSON.stringify({ projects, orgs }));
  console.log(`gsoc: ${projects.length} projects, ${Object.keys(orgs).length} orgs → public/data/gsoc-projects.json`);
  return { status: "rebuilt" };
}

/** Run one builder script and report what it did. Output goes straight to
    this process's stdout/stderr so a failure is not summarised away. */
function runBuilder(step) {
  const result = spawnSync(process.execPath, [step.builder], { cwd: ROOT, stdio: "inherit" });
  if (result.error) {
    return { status: "failed", code: 1, reason: result.error.message };
  }
  if (result.status !== 0) {
    return { status: "failed", code: result.status ?? 1, reason: `${step.builder} exited ${result.status}` };
  }
  return { status: "rebuilt" };
}

const USAGE = "usage: node scripts/refresh.mjs [all|gsoc|issues|roster|mentors]";

async function main(which = process.argv[2] ?? "all") {
  const plan = planRefresh(which, {
    env: process.env,
    hasCrawlInput: existsSync(join(ROOT, "data/crawl/issues.jsonl")),
  });
  if (!plan.ok) {
    console.error(USAGE);
    return 1;
  }

  const results = [];
  for (const step of plan.datasets) {
    if (step.skip) {
      console.log(`${step.id}: skipped - ${step.skip}`);
      results.push({ id: step.id, status: "skipped", reason: step.skip });
      continue;
    }

    const outcome = step.builder ? runBuilder(step) : await refreshGsoc();
    results.push({ id: step.id, ...outcome });
    if (outcome.status === "failed") {
      console.error(`refresh aborted: ${step.label} failed (${step.builder} exited ${outcome.code}); README not stamped`);
      return outcome.code && outcome.code > 0 ? outcome.code : 1;
    }
    if (outcome.status === "skipped") console.log(`${step.id}: skipped - ${outcome.reason}`);
  }

  const stamp = updateReadmeSnapshot(ROOT, { results, date: today });
  console.log(stamp.written
    ? `README: dataset rebuild line updated (${stamp.rebuilt.join(", ")})`
    : `README: not stamped - ${stamp.reason}`);
  console.log("refresh done", today);
  return 0;
}

/* Only an invocation of this file runs the pipeline; importing it (a test
   asking planRefresh a question) must not touch the network or the README. */
function invokedDirectly() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(SELF);
  } catch {
    return false;
  }
}

if (invokedDirectly()) process.exitCode = await main();
