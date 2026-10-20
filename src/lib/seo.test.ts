/* ══ seo.test.ts — the tags exist and they agree with each other ═══════
   A new route that forgets its canonical URL is invisible until someone
   compares search results, so the check runs over the filesystem.     ══ */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_ORIGIN, canonical, clip } from "./seo";

const APP = join(__dirname, "..", "app");

/** every page.tsx in the router, paired with the route it serves */
function routeFiles(dir: string, prefix = ""): { file: string; route: string }[] {
  const out: { file: string; route: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...routeFiles(p, `${prefix}/${e.name}`));
    else if (e.name === "page.tsx") out.push({ file: p, route: prefix || "/" });
  }
  return out;
}

describe("canonical URLs", () => {
  it("is emitted by every route in the app router", () => {
    const missing = routeFiles(APP)
      .filter(({ file }) => !readFileSync(file, "utf8").includes("alternates"))
      .map(({ route }) => route);
    expect(missing).toEqual([]);
  });

  it("builds absolute URLs on one origin", () => {
    expect(canonical("/")).toBe(`${SITE_ORIGIN}/`);
    expect(canonical("projects")).toBe(`${SITE_ORIGIN}/projects`);
    expect(canonical("/repo/owner%2Fname")).toBe(`${SITE_ORIGIN}/repo/owner%2Fname`);
  });
});

describe("clip", () => {
  it("leaves short text alone and flattens dataset newlines", () => {
    expect(clip("Real MCP servers for agents")).toBe("Real MCP servers for agents");
    expect(clip("one\ntwo   three\nfour")).toBe("one two three four");
  });

  it("caps long text at a search-snippet length on a word boundary", () => {
    const out = clip("alpha beta gamma ".repeat(20).trim());
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("…")).toBe(true);
    expect(out.trim().slice(0, -1).split(" ").pop()).toBe("gamma");
  });
});
