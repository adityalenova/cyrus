import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  backendReady: vi.fn(), currentUser: vi.fn(), listThreads: vi.fn(), createThread: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({
  backendReady: m.backendReady,
  currentUser: m.currentUser,
  OFFLINE: () => Response.json({ error: "backend offline" }, { status: 503 }),
}));
vi.mock("@/lib/server/discussions", () => ({
  listThreads: m.listThreads,
  createThread: m.createThread,
}));

import { GET, POST } from "./route";

const get = (query: string) => GET(new Request(`http://x/api/discussions${query}`));
const post = (body: unknown) =>
  POST(new Request("http://x/api/discussions", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

const user = { id: "u1", name: "Akhil", login: "Akhil-Pisipati" };

/* the limiter is keyed by account, so each test signs in as somebody new */
let seq = 0;

beforeEach(() => {
  m.backendReady.mockReset().mockReturnValue(true);
  m.currentUser.mockReset().mockResolvedValue({ ...user, id: `u${++seq}` });
  m.listThreads.mockReset().mockResolvedValue([{ id: "d1", title: "How do I run it?", replies: 2 }]);
  m.createThread.mockReset().mockResolvedValue({ ok: true, id: "c1" });
});

describe("GET /api/discussions", () => {
  it("503s before the database exists, so the panel can say why", async () => {
    m.backendReady.mockReturnValue(false);
    expect((await get("?project=a/b")).status).toBe(503);
    expect(m.listThreads).not.toHaveBeenCalled();
  });

  it("reads a project's threads and defaults to the repo kind", async () => {
    const body = await (await get("?project=foo/bar")).json();
    expect(m.listThreads).toHaveBeenCalledWith("repo", "foo/bar");
    expect(body.threads).toHaveLength(1);
  });

  it("rejects a kind it does not model and an empty project id", async () => {
    expect((await get("?kind=gist&project=a/b")).status).toBe(400);
    expect((await get("?kind=repo&project=")).status).toBe(400);
    expect(m.listThreads).not.toHaveBeenCalled();
  });
});

describe("POST /api/discussions", () => {
  it("needs a session, and never trusts one smuggled in the body", async () => {
    m.currentUser.mockResolvedValue(null);
    expect((await post({ projectKind: "repo", projectId: "a/b", title: "T", body: "B", authorId: "u9" })).status).toBe(401);
    m.currentUser.mockResolvedValue(user);
    await post({ projectKind: "repo", projectId: "a/b", title: "T", body: "B", authorId: "u9" });
    const arg = m.createThread.mock.calls[0][0] as { user: { id: string }; authorId?: string };
    expect(arg.user.id).toBe("u1");
    expect(arg.authorId).toBeUndefined();
  });

  it("validates the project before writing", async () => {
    expect((await post({ projectKind: "wiki", projectId: "a/b", title: "T", body: "B" })).status).toBe(400);
    expect((await post({ projectKind: "repo", projectId: "", title: "T", body: "B" })).status).toBe(400);
    expect((await post("{oops")).status).toBe(400);
    expect(m.createThread).not.toHaveBeenCalled();
  });

  it("returns the opening comment's id with 201", async () => {
    const res = await post({ projectKind: "org", projectId: "kde", title: " Docs thread ", body: "hello" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, id: "c1" });
    expect(m.listThreads).not.toHaveBeenCalled();
  });

  it("refuses the store's own rejection instead of hiding it", async () => {
    m.createThread.mockResolvedValue({ error: "a discussion needs a title", status: 400 });
    const res = await post({ projectKind: "repo", projectId: "a/b", title: "", body: "x" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/title/);
  });

  it("stops the ninth opening in the window", async () => {
    for (let i = 0; i < 8; i++) {
      expect((await post({ projectKind: "repo", projectId: "a/b", title: `t${i}`, body: "x" })).status).toBe(201);
    }
    const res = await post({ projectKind: "repo", projectId: "a/b", title: "one too many", body: "x" });
    expect(res.status).toBe(429);
    expect(m.createThread).toHaveBeenCalledTimes(8);
  });
});
