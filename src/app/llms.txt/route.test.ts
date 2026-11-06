/* ══ route.test.ts — the agent index stays honest ═══════════════════
   llms.txt is hand-written prose around derived numbers, so the check is
   that the shape and the route names it promises are still true.      ══ */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "./route";
import sitemap from "../sitemap";

/** every API handler on disk, as a path like /api/catalog/repos */
function handlers(): string[] {
  const API = join(__dirname, "..", "api");
  return readdirSync(API, { recursive: true, encoding: "utf8" })
    .filter((f): f is string => typeof f === "string" && f.endsWith("route.ts"))
    .map((f) => `/api/${f.replace(/[/\\]route\.ts$/, "").replace(/\\/g, "/")}`);
}

describe("GET /llms.txt", () => {
  it("serves plain text, in a size an agent will actually read", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body.startsWith("# cyrus.ai")).toBe(true);
    expect(body.length).toBeLessThan(4000);
  });

  it("quotes only API routes that exist on disk", async () => {
    const body = await (await GET()).text();
    const named = body.split("\n").flatMap((l) => l.match(/\/api\/[a-z/]+/g) ?? []);
    expect(named.length).toBeGreaterThan(0);
    for (const path of new Set(named)) expect(handlers(), `${path} is not a handler`).toContain(path);
  });

  it("lists every indexable sitemap hub with priority at least 0.5 in Pages", async () => {
    const body = await (await GET()).text();
    const pages = body.split("## Pages\n")[1]?.split("\n## ")[0] ?? "";
    const listed = new Set(pages.split("\n").flatMap((line) => {
      const url = line.match(/^- (https:\/\/\S+)/)?.[1];
      return url ? [url.replace(/\/$/, "")] : [];
    }));
    // Daily entries are sitemap hubs; weekly entries are individual records.
    // Read the actual output so adding a new hub requires updating this index.
    const missing = sitemap()
      .filter((entry) => entry.changeFrequency === "daily" && (entry.priority ?? 0) >= 0.5)
      .map((entry) => entry.url.replace(/\/$/, ""))
      .filter((url) => !listed.has(url));
    expect(missing).toEqual([]);
  });
});
