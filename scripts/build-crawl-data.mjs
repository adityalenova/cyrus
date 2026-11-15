#!/usr/bin/env node
/* ══ build-crawl-data.mjs — turn the raw GitHub crawl into site data ══
   Reads data/crawl/*.jsonl (written by scripts/crawl-github.mjs) and emits:

     src/data/issueSignals.ts   a small, hand-sized sample of real open issues
                                for the home page hero panel

   Everything here is derived from the crawl. Nothing is invented: if a field
   is missing upstream it stays missing, and the counts printed at the end are
   the counts the site will show.
*/
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitArtifact, renderCrawlStats, renderIssueSignals, selectIssueSignals } from "./lib/emit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CRAWL = resolve(ROOT, "data/crawl");
const OUT = resolve(ROOT, "src/data");

const readJsonl = (file) => {
  const p = resolve(CRAWL, file);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
};

const issues = readJsonl("issues.jsonl");
if (!issues.length) {
  console.error("no issues in data/crawl/issues.jsonl - run scripts/crawl-github.mjs --phase issues first");
  process.exit(1);
}

const HELPFUL = /good first issue|help wanted|beginner|easy|starter|difficulty easy/i;

/* The day stamped into a changed artifact. CYRUS_AS_OF makes a re-run
   reproducible; an unchanged artifact keeps the stamp it already carries. */
const asOf = process.env.CYRUS_AS_OF || new Date().toISOString().slice(0, 10);

/* pick issues that a contributor could realistically still take: open,
   unlocked, nobody assigned, from a well-used repo, recently touched. Beginner
   labelled ones come first because that is what a stranger needs. The order is
   fixed by the record fields, not by the clock, so a re-run of the same crawl
   selects the same 30. */
const rows = selectIssueSignals(issues, { helpful: HELPFUL, asOf });

const signals = emitArtifact(
  resolve(OUT, "issueSignals.ts"),
  renderIssueSignals(rows, asOf),
);

console.log(`issueSignals.ts: ${rows.length} selected of ${issues.length} crawled issues${signals.written ? "" : ", unchanged, file left alone"}`);
console.log(`repos represented: ${new Set(rows.map((r) => r.repo)).size} stamped ${signals.asOf}`);

/* ── the numbers the site is allowed to print ─────────────────
   Every figure here is a count of rows in the crawl, so the copy can
   say "we track N issues" and have it be literally true. */
const repos = readJsonl("repos.jsonl");
const langs = new Set(issues.map((i) => i.repo_language).filter(Boolean));
const orgs = new Set(issues.map((i) => i.org).filter(Boolean));
const issueRepos = new Set(issues.map((i) => i.repo));
const newest = issues.reduce((a, i) => (i.updated_at > a ? i.updated_at : a), "");
const beginnerLabelled = issues.filter((i) => HELPFUL.test((i.labels ?? []).join(" "))).length;

const stats = emitArtifact(
  resolve(OUT, "crawlStats.ts"),
  renderCrawlStats(
    {
      issues: issues.length,
      reposWithIssues: issueRepos.size,
      catalogRepos: repos.length,
      orgs: orgs.size,
      languages: langs.size,
      beginnerLabelled,
      mostRecentUpdate: newest,
    },
    asOf,
  ),
);
console.log(`crawlStats.ts: ${issues.length} issues / ${issueRepos.size} repos / ${repos.length} catalog / ${orgs.size} orgs${stats.written ? "" : ", unchanged, file left alone"}`);
