/* scripts/lib/readme-figures.mjs - the pure half of scripts/readme-stats.mjs.

   README.md and docs/readme/hero.svg quote figures about the site. Each one is
   owned by a named figure, so the script can rewrite it from the data instead
   of a person re-typing it:

     prose, tables, HTML   <!--stat:issues-->40,017<!--/stat-->
     hero banner tiles     <text ... data-stat="issues">40,017</text>
     places no marker fits (a code block, a Mermaid label, a badge URL) are
     listed in FIXED below, each as a pattern that must match exactly once.

   Nothing here reads the data or runs the tests; the caller passes the figures
   in, so the logic is testable on its own. */
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const FIGURE_KEYS = [
  "issues", "archive", "repos", "orgs", "programs", "archivePrograms",
  "pages", "handlers", "api", "testFiles", "tests",
];

const MARKER = /<!--stat:([A-Za-z]+)-->([^<]*)<!--\/stat-->/g;
const TILE = /(<text\b[^>]*\bdata-stat="([A-Za-z]+)"[^>]*>)([^<]*)(<\/text>)/g;

/* Each pattern keeps the text on both sides in two groups and replaces what is
   between them. `encode` is for a shields.io badge, where "40,017" is "40%2C017". */
export const FIXED = [
  { key: "issues", encode: true, re: /(badge\/open_issues-)[^-"]+(-[0-9a-f]{6})/g },
  { key: "archive", encode: true, re: /(badge\/program_projects-)[^-"]+(-[0-9a-f]{6})/g },
  { key: "repos", encode: true, re: /(badge\/repos_indexed-)[^-"]+(-[0-9a-f]{6})/g },
  { key: "testFiles", re: /(# vitest: )\d+( files, unit \+ data-integrity suites)/g },
  { key: "orgs", re: /(\/organizations - )\d+( generated org profiles)/g },
  { key: "pages", re: /(prerendered pages across )\d+( routes: Home)/g },
  { key: "api", re: /(API\[)\d+( API handlers \+ \/llms\.txt: auth)/g },
  { key: "pages", re: /(App Router: )\d+( pages \+ \d+ route handlers)/g },
  { key: "handlers", re: /(App Router: \d+ pages \+ )\d+( route handlers \()/g },
  { key: "api", re: /(route handlers \()\d+( API \+ llms\.txt\))/g },
];

const need = (figures, key) => {
  if (!(key in figures)) throw new Error(`Unknown figure "${key}" (known: ${FIGURE_KEYS.join(", ")})`);
  return figures[key];
};

/** @returns {{ text: string, changes: { key: string, from: string, to: string }[] }} */
export function rewriteMarkers(text, figures) {
  const changes = [];
  const out = text.replace(MARKER, (whole, key, old) => {
    const value = need(figures, key);
    if (old !== value) changes.push({ key, from: old, to: value });
    return `<!--stat:${key}-->${value}<!--/stat-->`;
  });
  return { text: out, changes };
}

export function rewriteTiles(svg, figures) {
  const changes = [];
  const out = svg.replace(TILE, (whole, open, key, old, close) => {
    const value = need(figures, key);
    if (old !== value) changes.push({ key, from: old, to: value });
    return open + value + close;
  });
  return { text: out, changes };
}

/** A pattern that matches nothing means a sentence was reworded; one that
 *  matches twice means it is no longer unique. Both fail rather than guess. */
export function rewriteFixed(text, figures, rules = FIXED) {
  const changes = [];
  let out = text;
  for (const { key, re, encode } of rules) {
    const value = need(figures, key);
    const found = [...out.matchAll(re)];
    if (found.length !== 1) {
      throw new Error(`${re} for "${key}" matched ${found.length} times, expected 1 - the text changed; update FIXED in scripts/lib/readme-figures.mjs`);
    }
    const shown = encode ? encodeURIComponent(value) : value;
    out = out.replace(re, (whole, before, after) => {
      const old = whole.slice(before.length, whole.length - after.length);
      const was = encode ? decodeURIComponent(old) : old;
      if (was !== value) changes.push({ key, from: was, to: value });
      return before + shown + after;
    });
  }
  return { text: out, changes };
}

/** page.tsx and route.ts files under an app directory; `api` is the route
 *  handlers inside its top-level api/ folder (the rest are files like llms.txt). */
export function routeCounts(appDir) {
  const counts = { pages: 0, handlers: 0, api: 0 };
  const walk = (dir, inApi) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), inApi || (dir === appDir && entry.name === "api"));
      else if (entry.name === "page.tsx") counts.pages++;
      else if (entry.name === "route.ts") { counts.handlers++; if (inApi) counts.api++; }
    }
  };
  walk(appDir, false);
  return counts;
}
