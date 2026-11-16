#!/usr/bin/env node
/* ══ build-issue-index.mjs — the servable half of the crawl ════════════
   data/crawl/issues.jsonl is 70 MB of GitHub API responses. A browser has
   no business downloading that, and a request function has no business
   parsing it per call. So this trims it down to the fields the issue finder
   actually filters and shows, and writes it gzipped next to the other
   generated datasets in public/data/.

   Nothing is invented here. A row that is missing a language upstream is
   missing a language in the index, and the counts printed at the end are
   the counts the site states.

     node scripts/build-issue-index.mjs
   ═════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
  validateIssueSnapshot,
} from "../src/lib/crawlSnapshotSchema.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "data/crawl/issues.jsonl");
const OUT = resolve(ROOT, "public/data/issues.json.gz");

const BEGINNER = /good first issue|help wanted|beginner|easy|starter|difficulty easy/i;
const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

if (!existsSync(SRC)) {
  console.error("no data/crawl/issues.jsonl - run scripts/crawl-github.mjs --phase issues first");
  process.exit(1);
}

const seen = new Set();
const items = [];
const repos = new Set();
const orgs = new Set();
const langs = new Set();
let skippedClosed = 0;

for (const line of readFileSync(SRC, "utf8").split("\n")) {
  if (!line) continue;
  let i;
  try { i = JSON.parse(line); } catch { continue; }
  if (i.state && i.state !== "open") { skippedClosed++; continue; }
  if (!i.repo || !i.number || !i.title) continue;
  const key = `${i.repo}#${i.number}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const labels = (i.labels ?? []).map((l) => (typeof l === "string" ? l : l?.name ?? "")).filter(Boolean);
  const lang = i.repo_language ?? null;
  items.push({
    r: i.repo,
    n: i.number,
    t: String(i.title).slice(0, 180),
    /* assignees are the difference between "you can take this" and "someone
       already has", so the finder shows the count rather than hiding it */
    a: (i.assignees ?? []).length,
    l: labels.slice(0, 6),
    g: lang,
    s: i.repo_stars ?? 0,
    u: day(i.updated_at),
    c: day(i.created_at),
    m: i.comments ?? 0,
    b: labels.some((l) => BEGINNER.test(l)) ? 1 : 0,
  });
  repos.add(i.repo);
  orgs.add(i.org || i.repo.split("/")[0]);
  if (lang) langs.add(lang);
}

items.sort((x, y) => y.s - x.s);

const snapshot = {
  schemaVersion: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
  meta: {
    schemaVersion: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
    generated: new Date().toISOString().slice(0, 10),
    issues: items.length,
    repos: repos.size,
    orgs: orgs.size,
    languages: langs.size,
    beginner: items.filter((i) => i.b).length,
    unassigned: items.filter((i) => i.a === 0).length,
  },
  items,
};

try {
  validateIssueSnapshot(snapshot);
} catch (err) {
  console.error(`snapshot validation failed: ${err.message}`);
  if (err.action) console.error(`action: ${err.action}`);
  process.exit(1);
}

const payload = JSON.stringify(snapshot);
const gz = gzipSync(Buffer.from(payload, "utf8"), { level: 9 });
writeFileSync(OUT, gz);

const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.log(`wrote public/data/issues.json.gz  ${mb(gz.length)} MB gzipped from ${mb(payload.length)} MB of json`);
console.log(`  ${items.length} open issues · ${repos.size} repositories · ${orgs.size} orgs · ${langs.size} languages`);
console.log(`  ${items.filter((i) => i.b).length} beginner-labelled · ${items.filter((i) => i.a === 0).length} with nobody assigned`);
if (skippedClosed) console.log(`  dropped ${skippedClosed} rows that were not open`);
