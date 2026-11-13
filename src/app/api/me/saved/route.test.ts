import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ currentUser: vi.fn(), listSaved: vi.fn(), addSaved: vi.fn(), removeSaved: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ currentUser: m.currentUser }));
vi.mock("@/lib/server/queries", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/queries")>()),
  listSaved: m.listSaved,
  addSaved: m.addSaved,
  removeSaved: m.removeSaved,
}));

import { DELETE, GET, POST } from "./route";

const req = (method: string, body?: unknown) =>
  new Request("http://x/api/me/saved", { method, body: typeof body === "string" ? body : body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  m.currentUser.mockReset().mockResolvedValue({ id: "u1" });
  m.listSaved.mockReset().mockResolvedValue([{ itemType: "repo", itemId: "a/b", title: "T", meta: null, createdAt: "d", extra: 1 }]);
  m.addSaved.mockReset().mockResolvedValue({ itemType: "repo", itemId: "a/b", title: "T" });
  m.removeSaved.mockReset().mockResolvedValue(true);
});

describe("/api/me/saved", () => {
  it("returns 401 on every method when signed out", async () => {
    m.currentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(req("POST", {}))).status).toBe(401);
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
    u2: [{ itemType: "repo", itemId: "b/two", title: "Two", meta: null, createdAt: "d" }],
  };
  beforeEach(() => {
    m.listSaved.mockImplementation(async (id: string) => rows[id] ?? []);
    m.removeSaved.mockImplementation(async (id: string, t: string, item: string) => {
      const before = rows[id]?.length ?? 0;
      rows[id] = (rows[id] ?? []).filter((r) => !(r.itemType === t && r.itemId === item));
      return rows[id].length < before;
    });
  });

  it("GET returns only the signed-in account's rows", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    const mine = await (await GET()).json();
    expect(mine.items.map((i: { itemId: string }) => i.itemId)).toEqual(["a/one"]);
    m.currentUser.mockResolvedValue({ id: "u2" });
    const theirs = await (await GET()).json();
    expect(theirs.items.map((i: { itemId: string }) => i.itemId)).toEqual(["b/two"]);
  });

  it("DELETE cannot remove another account's item, even by naming it", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    const res = await DELETE(req("DELETE", { itemType: "repo", itemId: "b/two" }));
    expect((await res.json()).removed).toBe(false);
    expect(rows.u2).toHaveLength(1);
    expect(m.removeSaved).toHaveBeenCalledWith("u1", "repo", "b/two");
  });

  it("ignores a userId smuggled into the body and uses the session", async () => {
    m.currentUser.mockResolvedValue({ id: "u1" });
    await DELETE(req("DELETE", { itemType: "repo", itemId: "b/two", userId: "u2" }));
    await POST(req("POST", { itemType: "repo", itemId: "x/y", userId: "u2" }));
    expect(m.removeSaved.mock.calls.at(-1)![0]).toBe("u1");
    expect(m.addSaved.mock.calls.at(-1)![0]).toBe("u1");
    expect(rows.u2).toHaveLength(1);
  });
});
