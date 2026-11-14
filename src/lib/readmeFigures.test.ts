/* readmeFigures.test.ts - the README and hero banner quote figures the script owns */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FIGURE_KEYS, FIXED, rewriteFixed, rewriteMarkers, rewriteTiles, routeCounts,
} from "../../scripts/lib/readme-figures.mjs";

const figures = Object.fromEntries(FIGURE_KEYS.map((key) => [key, `<${key}>`]));
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

describe("README figures", () => {
  it("rewrites only the marked figure and leaves the prose around it alone", () => {
    const before = "Over <!--stat:issues-->1<!--/stat--> issues, <b><!--stat:tests-->2<!--/stat--></b> tests.";
    const { text, changes } = rewriteMarkers(before, { ...figures, issues: "40,017", tests: "2" });
    expect(text).toBe("Over <!--stat:issues-->40,017<!--/stat--> issues, <b><!--stat:tests-->2<!--/stat--></b> tests.");
    expect(changes).toEqual([{ key: "issues", from: "1", to: "40,017" }]);
    expect(rewriteMarkers(text, { ...figures, issues: "40,017", tests: "2" }).changes).toEqual([]);
  });

  it("refuses a marker for a figure it does not own", () => {
    expect(() => rewriteMarkers("<!--stat:hackathons-->161<!--/stat-->", figures)).toThrow('Unknown figure "hackathons"');
  });

  it("rewrites the hero tiles by their data-stat key", () => {
    const svg = '<text x="1" fill="#d9a441" data-stat="issues">40,017</text><text x="2">open issues</text>';
    const { text, changes } = rewriteTiles(svg, { ...figures, issues: "41,000" });
    expect(text).toBe('<text x="1" fill="#d9a441" data-stat="issues">41,000</text><text x="2">open issues</text>');
    expect(changes).toEqual([{ key: "issues", from: "40,017", to: "41,000" }]);
    expect(() => rewriteTiles('<text data-stat="nope">1</text>', figures)).toThrow('Unknown figure "nope"');
  });

  it("encodes a figure that sits in a badge URL and still sees when it changed", () => {
    const rules = [FIXED[0]];
    const badge = '<img src="https://img.shields.io/badge/open_issues-40%2C017-4e8f6b?style=flat">';
    const same = rewriteFixed(badge, { ...figures, issues: "40,017" }, rules);
    expect(same.text).toBe(badge);
    expect(same.changes).toEqual([]);
    const next = rewriteFixed(badge, { ...figures, issues: "41,500" }, rules);
    expect(next.text).toContain("open_issues-41%2C500-4e8f6b");
    expect(next.changes).toEqual([{ key: "issues", from: "40,017", to: "41,500" }]);
  });

  it("fails when a fixed sentence is missing or no longer unique instead of guessing", () => {
    const rules = [{ key: "orgs", re: /(\/organizations - )\d+( generated org profiles)/g }];
    const line = "/organizations - 364 generated org profiles";
    expect(rewriteFixed(line, { ...figures, orgs: "365" }, rules).text).toBe("/organizations - 365 generated org profiles");
    expect(() => rewriteFixed("reworded", figures, rules)).toThrow("matched 0 times");
    expect(() => rewriteFixed(`${line}\n${line}`, figures, rules)).toThrow("matched 2 times");
  });

  it("counts pages and route handlers, and which handlers are API", () => {
    const app = mkdtempSync(join(tmpdir(), "cyrus-app-"));
    fixtures.push(app);
    for (const dir of ["", "about", "organizations/[login]", "api/me", "api/auth/logout", "llms.txt"]) {
      mkdirSync(join(app, dir), { recursive: true });
    }
    for (const file of ["page.tsx", "about/page.tsx", "organizations/[login]/page.tsx", "organizations/[login]/opengraph-image.tsx",
      "api/me/route.ts", "api/auth/logout/route.ts", "api/auth/logout/route.test.ts", "llms.txt/route.ts"]) {
      writeFileSync(join(app, file), "");
    }
    expect(routeCounts(app)).toEqual({ pages: 3, handlers: 3, api: 2 });
  });

  it("still finds every fixed sentence in the checked-in README exactly once", () => {
    const readme = read("README.md");
    for (const rule of FIXED) expect([...readme.matchAll(rule.re)], String(rule.re)).toHaveLength(1);
  });

  it("only uses markers and tiles for figures the script knows, and keeps all five tiles", () => {
    const readmeKeys = [...read("README.md").matchAll(/<!--stat:([A-Za-z]+)-->/g)].map((m) => m[1]);
    const tileKeys = [...read("docs/readme/hero.svg").matchAll(/data-stat="([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(readmeKeys.length).toBeGreaterThan(0);
    for (const key of [...readmeKeys, ...tileKeys]) expect(FIGURE_KEYS).toContain(key);
    expect(tileKeys.sort()).toEqual(["archive", "issues", "orgs", "programs", "repos"]);
  });
});
