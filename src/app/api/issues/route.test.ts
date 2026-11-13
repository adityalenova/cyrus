import { beforeEach, describe, expect, it, vi } from "vitest";

const loadIndex = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/issueIndex", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/issueIndex")>()),
  loadIndex,
}));

import { GET } from "./route";

const row = (n: number, t: string) => ({ r: "o/r", n, t, l: ["good first issue"], g: "TypeScript", s: 5, u: 1, c: 1, m: 0, a: 0, b: 1 });
const index = { meta: { generated: "2026-01-01" }, items: [row(1, "fix the parser"), row(2, "add docs")] };

let n = 0;
const get = (qs = "", ip = `10.1.0.${++n}`) =>
  GET(new Request(`http://x/api/issues${qs}`, { headers: { "x-forwarded-for": ip } }));

beforeEach(() => loadIndex.mockReset().mockResolvedValue(index));

describe("GET /api/issues", () => {
  it("returns shaped issues with the snapshot meta", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toEqual(index.meta);
    expect(body.total).toBe(2);
    expect(body.issues[0]).toMatchObject({
      url: expect.stringMatching(/^https:\/\/github\.com\/o\/r\/issues\/\d$/),
      repo: "o/r", lang: "TypeScript", beginner: true,
    });
    expect(loadIndex).toHaveBeenCalledWith("http://x/");
  });

  it("counts facets for the query that was asked, not the whole snapshot", async () => {
    const mixed = {
      meta: { generated: "2026-01-01" },
      items: [
        { ...row(1, "fix the parser"), r: "a/x", g: "Python", l: ["bug"] },
        { ...row(2, "add docs"), r: "b/y", g: "Java", l: ["docs"] },
        { ...row(3, "docs for py"), r: "c/z", g: "Python", l: ["docs"] },
      ],
    };
    loadIndex.mockResolvedValue(mixed);
    const all = await (await get()).json();
    expect(all.facets.langs).toEqual([{ value: "Python", count: 2 }, { value: "Java", count: 1 }]);
    expect(all.facets.orgs.length).toBe(3);

    const py = await (await get("?lang=Python")).json();
    expect(py.total).toBe(2);
    /* siblings stay on the language rail, the other rails narrow */
    expect(py.facets.langs).toEqual([{ value: "Python", count: 2 }, { value: "Java", count: 1 }]);
    expect(py.facets.orgs.map((o: { value: string }) => o.value).sort()).toEqual(["a", "c"]);
    expect(py.facets.labels).toEqual([{ value: "bug", count: 1 }, { value: "docs", count: 1 }]);

    const search = await (await get("?q=docs")).json();
    expect(search.facets.langs).toEqual([{ value: "Java", count: 1 }, { value: "Python", count: 1 }]);

    /* sort and page do not change the facets */
    expect((await (await get("?lang=Python&sort=stars&page=2")).json()).facets).toEqual(py.facets);
  });

  it("does not serve a cached facet result after the index is reloaded", async () => {
    await get("?lang=Python");
    loadIndex.mockResolvedValue({ meta: index.meta, items: [{ ...row(9, "other"), g: "Go", l: [] }] });
    const body = await (await get("?lang=Python")).json();
    /* the old entry for ?lang=Python would say Python, the new index only has Go */
    expect(body.facets.langs).toEqual([{ value: "Go", count: 1 }]);
  });

  it("is 503 when the index is not available", async () => {
    loadIndex.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not available/);
  });

  it("is 429 after 60 requests from one address", async () => {
    for (let i = 0; i < 60; i++) expect((await get("", "7.7.7.7")).status).toBe(200);
    expect((await get("", "7.7.7.7")).status).toBe(429);
    expect((await get("", "7.7.7.8")).status).toBe(200);
  });
});
