import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRepos = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/queries", () => ({ queryRepos }));

import { GET } from "./route";

const get = (qs = "") => GET(new Request(`http://x/api/catalog/repos${qs}`));

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://example");
  vi.stubEnv("SESSION_SECRET", "a-secret-longer-than-16");
  queryRepos.mockReset().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], total: 2 });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/catalog/repos", () => {
  it("is 503 when offline", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await get()).status).toBe(503);
  });

  it("returns rows with default paging and pagination metadata", async () => {
    const body = await (await get()).json();
    expect(body).toEqual({ total: 2, page: 1, per: 24, pages: 1, repos: [{ id: 1 }, { id: 2 }] });
    expect(queryRepos).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 24, cat: undefined }));
  });

  it("handles multiple pages and calculates total pages correctly", async () => {
    const mockRows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    queryRepos.mockResolvedValue({ rows: mockRows, total: 50 });

    const body = await (await get("?page=1&per=20")).json();
    expect(body).toEqual({ total: 50, page: 1, per: 20, pages: 3, repos: mockRows });
    expect(queryRepos).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 20 }));
  });

  it("handles partial final pages correctly", async () => {
    const lastPageRows = Array.from({ length: 10 }, (_, i) => ({ id: 40 + i + 1 }));
    queryRepos.mockResolvedValue({ rows: lastPageRows, total: 50 });

    const body = await (await get("?page=3&per=20")).json();
    expect(body).toEqual({ total: 50, page: 3, per: 20, pages: 3, repos: lastPageRows });
    expect(queryRepos).toHaveBeenCalledWith(expect.objectContaining({ page: 3, perPage: 20 }));
  });

  it("handles zero matching repositories with pages=1 and empty repos array", async () => {
    queryRepos.mockResolvedValue({ rows: [], total: 0 });

    const body = await (await get("?q=nonexistent")).json();
    expect(body).toEqual({ total: 0, page: 1, per: 24, pages: 1, repos: [] });
  });

  it("distinguishes out-of-range page requests from empty results", async () => {
    queryRepos.mockResolvedValue({ rows: [], total: 50 });

    const body = await (await get("?page=200&per=24")).json();
    expect(body).toEqual({ total: 50, page: 200, per: 24, pages: 3, repos: [] });
    expect(queryRepos).toHaveBeenCalledWith(expect.objectContaining({ page: 200, perPage: 24 }));
  });

  it("returns filtered results with accurate total count and filter parameters", async () => {
    queryRepos.mockResolvedValue({ rows: [{ id: 42, cat: "mcp" }], total: 1 });

    const body = await (await get("?cat=mcp&domain=coding&model=claude")).json();
    expect(body).toEqual({ total: 1, page: 1, per: 24, pages: 1, repos: [{ id: 42, cat: "mcp" }] });
    expect(queryRepos).toHaveBeenCalledWith(expect.objectContaining({
      cat: "mcp",
      domain: "coding",
      model: "claude",
      page: 1,
      perPage: 24,
    }));
  });

  it("rejects an unknown category with 400", async () => {
    const res = await get("?cat=nope");
    expect(res.status).toBe(400);
    expect(queryRepos).not.toHaveBeenCalled();
  });

  it("clamps page and per, and sanitises filter words", async () => {
    await get("?cat=mcp&page=9999&per=500&q=a%25b_c%20d&domain=we!b&model=");
    expect(queryRepos).toHaveBeenCalledWith({
      cat: "mcp", q: "abcd", domain: "web", model: undefined, format: undefined, framework: undefined,
      page: 500, perPage: 60,
    });
    await get("?page=-3&per=abc");
    expect(queryRepos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, perPage: 24 }));
  });

  it("is 500 when the query throws", async () => {
    queryRepos.mockRejectedValue(new Error("boom"));
    const res = await get();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("boom");
  });
});
