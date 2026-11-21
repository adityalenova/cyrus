import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  currentUser: vi.fn(), listSaved: vi.fn(), addSaved: vi.fn(), removeSaved: vi.fn(), renameSaved: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ currentUser: m.currentUser }));
vi.mock("@/lib/server/queries", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/queries")>()),
  listSaved: m.listSaved,
  addSaved: m.addSaved,
  removeSaved: m.removeSaved,
  renameSaved: m.renameSaved,
}));

import { DELETE, GET, PATCH, POST } from "./route";

const req = (method: string, body?: unknown) =>
  new Request("http://x/api/me/saved", { method, body: typeof body === "string" ? body : body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  m.currentUser.mockReset().mockResolvedValue({ id: "u1" });
  m.listSaved.mockReset().mockResolvedValue([{ itemType: "repo", itemId: "a/b", title: "T", meta: null, createdAt: "d", extra: 1 }]);
  m.addSaved.mockReset().mockResolvedValue({ itemType: "repo", itemId: "a/b", title: "T" });
  m.removeSaved.mockReset().mockResolvedValue(true);
  m.renameSaved.mockReset().mockResolvedValue(null);
});

describe("/api/me/saved", () => {
  it("returns 401 on every method when signed out", async () => {
    m.currentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(req("POST", {}))).status).toBe(401);
    expect((await PATCH(req("PATCH", {}))).status).toBe(401);
    expect((await DELETE(req("DELETE", {}))).status).toBe(401);
  });

  it("GET lists the saved rows of the current user", async () => {
    const body = await (await GET()).json();
    expect(m.listSaved).toHaveBeenCalledWith("u1");
    expect(body.items).toEqual([{ itemType: "repo", itemId: "a/b", title: "T", meta: null, createdAt: "d" }]);
  });

  it("POST saves an item and trims the title", async () => {
    const res = await POST(req("POST", { itemType: "repo", itemId: "a/b", title: "x".repeat(300) }));
    expect(await res.json()).toEqual({ ok: true, item: { itemType: "repo", itemId: "a/b", title: "T" } });
    expect(m.addSaved.mock.calls[0][3]).toHaveLength(200);
  });

  it("POST and DELETE reject bad input with 400", async () => {
    for (const fn of [POST, DELETE]) {
      expect((await fn(req("POST", "{bad"))).status).toBe(400);
      expect((await fn(req("POST", { itemType: "nope", itemId: "a" }))).status).toBe(400);
      expect((await fn(req("POST", { itemType: "repo", itemId: "" }))).status).toBe(400);
    }
    expect(m.addSaved).not.toHaveBeenCalled();
    expect(m.removeSaved).not.toHaveBeenCalled();
  });

  it("DELETE reports whether something was removed", async () => {
    expect(await (await DELETE(req("DELETE", { itemType: "repo", itemId: "a/b" }))).json()).toEqual({ ok: true, removed: true });
    m.removeSaved.mockResolvedValue(false);
    expect((await (await DELETE(req("DELETE", { itemType: "repo", itemId: "zzz" }))).json()).removed).toBe(false);
  });
});

describe("/api/me/saved account isolation", () => {
  /* a tiny in-memory store keyed by user id, so a leak between accounts shows up */
  const rows: Record<string, { itemType: string; itemId: string; title: string | null; meta: null; createdAt: string }[]> = {
    u1: [{ itemType: "repo", itemId: "a/one", title: "One", meta: null, createdAt: "d" }],
    u2: [{ itemType: "repo", itemId: "b/two", title: "Two", meta: null, createdAt: "d" },
         { itemType: "search", itemId: "sq-2", title: "Their rust search", meta: null, createdAt: "d" }],
  };
  beforeEach(() => {
    m.listSaved.mockImplementation(async (id: string) => rows[id] ?? []);
    m.removeSaved.mockImplementation(async (id: string, t: string, item: string) => {
      const before = rows[id]?.length ?? 0;
      rows[id] = (rows[id] ?? []).filter((r) => !(r.itemType === t && r.itemId === item));
      return rows[id].length < before;
    });
    /* the real UPDATE carries the user id in its predicate; a store that
       ignores it would let one account rename another's search */
    m.renameSaved.mockImplementation(async (id: string, t: string, item: string, title: string) => {
      const row = (rows[id] ?? []).find((r) => r.itemType === t && r.itemId === item);
      if (!row) return null;
      row.title = title;
      return row;
    });
  });

  it("GET returns only the signed-in account's rows", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    const mine = await (await GET()).json();
    expect(mine.items.map((i: { itemId: string }) => i.itemId)).toEqual(["a/one"]);
    m.currentUser.mockResolvedValue({ id: "u2" });
    const theirs = await (await GET()).json();
    expect(theirs.items.map((i: { itemId: string }) => i.itemId)).toEqual(["b/two", "sq-2"]);
  });

  it("DELETE cannot remove another account's item, even by naming it", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    const res = await DELETE(req("DELETE", { itemType: "repo", itemId: "b/two" }));
    expect((await res.json()).removed).toBe(false);
    expect(rows.u2).toHaveLength(2);
    expect(m.removeSaved).toHaveBeenCalledWith("u1", "repo", "b/two");
  });

  it("PATCH cannot rename another account's saved search", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    const res = await PATCH(req("PATCH", { itemType: "search", itemId: "sq-2", title: "Mine now" }));
    expect(res.status).toBe(404);
    expect(rows.u2![1]!.title).toBe("Their rust search");
    expect(m.renameSaved).toHaveBeenCalledWith("u1", "search", "sq-2", "Mine now");
  });

  it("renaming your own saved search keeps the row and the filters", async () => {
    m.currentUser.mockResolvedValue({ id: "u2" });
    const res = await PATCH(req("PATCH", { itemType: "search", itemId: "sq-2", title: "  Rust,  good first  " }));
    expect(await res.json()).toEqual({ ok: true, item: { itemType: "search", itemId: "sq-2", title: "Rust, good first" } });
    expect(rows.u2).toHaveLength(2);
  });

  it("ignores a userId smuggled into the body and uses the session", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    await DELETE(req("DELETE", { itemType: "repo", itemId: "b/two", userId: "u2" }));
    await POST(req("POST", { itemType: "repo", itemId: "x/y", userId: "u2" }));
    await PATCH(req("PATCH", { itemType: "search", itemId: "sq-2", title: "Not yours", userId: "u2" }));
    expect(m.removeSaved.mock.calls.at(-1)![0]).toBe("u1");
    expect(m.addSaved.mock.calls.at(-1)![0]).toBe("u1");
    expect(m.renameSaved.mock.calls.at(-1)![0]).toBe("u1");
    expect(rows.u2).toHaveLength(2);
  });
});

describe("/api/me/saved search rows", () => {
  /* a search row is a question, not a list of issues: only the name and the
     normalised filters may be written, and only within the finder's rules */
  const post = (title: unknown, meta: unknown) =>
    POST(req("POST", { itemType: "search", itemId: "sq-1", title, meta }));

  beforeEach(() => {
    m.addSaved.mockResolvedValue({ itemType: "search", itemId: "sq-1", title: "Rust good first" });
  });

  it("stores the trimmed name and the filters, with defaults dropped", async () => {
    const res = await post("  Rust  good  first  ", { filters: { q: "docs", sort: "relevance", beginner: true } });
    expect(res.status).toBe(200);
    expect(m.addSaved.mock.calls[0]).toEqual([
      "u1", "search", "sq-1", "Rust good first", { filters: { q: "docs", beginner: true } },
    ]);
  });

  it("refuses a name that is empty, blank or longer than the finder allows", async () => {
    for (const title of [undefined, "", "   ", "x".repeat(81), 42]) {
      expect((await post(title, { filters: { q: "go" } })).status).toBe(400);
    }
    expect(m.addSaved).not.toHaveBeenCalled();
  });

  it("refuses filters the finder cannot replay, and absurd counts", async () => {
    for (const meta of [
      undefined, { filters: "rust" }, { filters: { status: "open" } }, { filters: { page: "2" } },
      { filters: { org: "Vercel" } }, { filters: { q: "x".repeat(121) } },
      { filters: { lang: Array.from({ length: 40 }, (_, i) => `l${i}`) } },
    ]) {
      const res = await post("a name", meta);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect(m.addSaved).not.toHaveBeenCalled();
  });

  it("never lets a payload ride along beside the filters", async () => {
    await post("a name", { filters: { q: "go" }, issues: ["a/b#1"], userId: "u2" });
    expect(m.addSaved.mock.calls[0]![4]).toEqual({ filters: { q: "go" } });
  });

  it("leaves the other item types exactly as they were", async () => {
    await POST(req("POST", { itemType: "issue", itemId: "a/b#1", title: "A title", meta: { url: "x" } }));
    expect(m.addSaved.mock.calls[0]).toEqual(["u1", "issue", "a/b#1", "A title", { url: "x" }]);
  });

  it("PATCH needs a usable name for a search and a plain title for the rest", async () => {
    expect((await PATCH(req("PATCH", { itemType: "search", itemId: "sq-1", title: "  " }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { itemType: "repo", itemId: "a/b", title: "  " }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { itemType: "nope", itemId: "sq-1", title: "x" }))).status).toBe(400);
    expect((await PATCH(req("PATCH", "{bad"))).status).toBe(400);
    expect(m.renameSaved).not.toHaveBeenCalled();
  });
});
