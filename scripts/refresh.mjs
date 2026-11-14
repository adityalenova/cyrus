/* ══ scripts/refresh.mjs — cyrus.ai auto-update pipeline ══════════════
   node scripts/refresh.mjs            # the GSoC project archive
   node scripts/refresh.mjs gsoc       # the same, named explicitly

   Writes:
     public/data/gsoc-projects.json (fetched at runtime by /projects)
   The open-issue index is not here: that is crawl-github.mjs, and it has to
   be run with a GitHub token, so it stays a scheduled job rather than this one.
   The archive is staged, checked, and only then swapped in, so a run whose
   fetch came back short leaves the file the site is serving alone - see
   scripts/lib/promote.mjs.
   Cron example (daily 06:00): 0 6 * * * cd /path/to/cyrus && npm run refresh
   ═════════════════════════════════════════════════════════════════════ */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";
import { openStaging, promoteSnapshot, formatPromotion } from "./lib/promote.mjs";
// import { updateReadmeSnapshot } from "./readme-snapshot.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA = join(ROOT, "public", "data");
const DATASET = "gsoc-projects.json";
/* the archive has held a little over five thousand accepted projects for as
   long as this script has run, so a read that comes back under this is a
   partial page rather than a smaller program */
const FLOOR = 5000;
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;
const clean = (s) => (s || "").replace(EMOJI, "").replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
const today = new Date().toISOString().slice(0, 10);

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

  /* the read goes to a versioned directory first, and only a file that passes
     the checks below is swapped into public/data; a short or malformed read is
     reported and the archive the site is serving stays exactly as it was */
  const staging = openStaging({ dataDir: DATA, workDir: join(ROOT, "data"), name: "gsoc-projects", stamp: today });
  writeFileSync(staging.stage(DATASET), JSON.stringify({ projects, orgs }));
  const report = promoteSnapshot({
    staging,
    files: [DATASET],
    check: (rel, j) => {
      const problems = [];
      if (!Array.isArray(j.projects)) return ["no projects array"];
      if (j.projects.length < FLOOR) {
        problems.push(`only ${j.projects.length} project${j.projects.length === 1 ? "" : "s"}; the archive has held ${FLOOR} for as long as this script has run, so this read looks degraded`);
      }
      if (!j.orgs || !Object.keys(j.orgs).length) problems.push("no organizations came back with the projects");
      const loose = (j.projects || []).find((p) => !p.t || !p.o);
      if (loose) problems.push(`a row has no title or organization: ${JSON.stringify(loose).slice(0, 80)}`);
      return problems;
    },
    meta: { readAt: today, projects: projects.length, orgs: Object.keys(orgs).length },
  });
  console.log(formatPromotion(report));
  if (!report.ok) process.exit(1);
  console.log(`gsoc: ${projects.length} projects, ${Object.keys(orgs).length} orgs -> public/data/gsoc-projects.json`);
}

const which = (process.argv[2] || "all").toLowerCase();
if (which === "gsoc" || which === "all") await refreshGsoc();
if (which !== "gsoc" && which !== "all") console.log("usage: node scripts/refresh.mjs [gsoc|all]");
// updateReadmeSnapshot(ROOT);
console.log("refresh done", today);
