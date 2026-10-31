/* ══ scripts/refresh.mjs — cyrus.ai auto-update pipeline ══════════════
   node scripts/refresh.mjs            # the GSoC project archive
   node scripts/refresh.mjs gsoc       # the same, named explicitly

   Writes:
     public/data/gsoc-projects.json (fetched at runtime by /opensource)
   The open-issue index is not here: that is crawl-github.mjs, and it has to
   be run with a GitHub token, so it stays a scheduled job rather than this one.
   Cron example (daily 06:00): 0 6 * * * cd ~/Desktop/agent-skills && npm run refresh -- gsoc
   ═════════════════════════════════════════════════════════════════════ */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";
import { updateReadmeSnapshot } from "./readme-snapshot.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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
     Accepted projects are the archive /opensource reads; the open-issue
     crawl lives in scripts/crawl-github.mjs and scripts/build-crawl-data.mjs.
*/
async function refreshGsoc() {
  const BASE = "https://summerofcode.withgoogle.com/api";
  const YEARS = [2022, 2023, 2024, 2025, 2026];
  const projects = [], orgs = {};
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
        if (!YEARS.includes(yr)) continue;
        if (seenUids.has(p.uid)) continue;
        seenUids.add(p.uid);
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
  if (projects.length < 5000) { console.log(`gsoc: only ${projects.length} projects - archive looks degraded, keeping the existing file`); return; }
  mkdirSync(join(ROOT, "public/data"), { recursive: true });
  writeFileSync(join(ROOT, "public/data/gsoc-projects.json"), JSON.stringify({ projects, orgs }));
  console.log(`gsoc: ${projects.length} projects, ${Object.keys(orgs).length} orgs → public/data/gsoc-projects.json`);
}

const which = (process.argv[2] || "all").toLowerCase();
if (which === "gsoc" || which === "all") await refreshGsoc();
if (which !== "gsoc" && which !== "all") console.log("usage: node scripts/refresh.mjs [gsoc|all]");
updateReadmeSnapshot(ROOT);
console.log("refresh done", today);
