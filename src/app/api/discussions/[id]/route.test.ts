import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  backendReady: vi.fn(), currentUser: vi.fn(),
  readThread: vi.fn(), addReply: vi.fn(), setVote: vi.fn(), setFlag: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({
  backendReady: m.backendReady,
  currentUser: m.currentUser,
  OFFLINE: () => Response.json({ error: "backend offline" }, { status: 503 }),
}));
vi.mock("@/lib/server/discussions", () => ({
  readThread: m.readThread,
  addReply: m.addReply,
  setVote: m.setVote,
  setFlag: m.setFlag,
}));

import { GET, POST } from "./route";

const THREAD = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const COMMENT = "11111111-2222-3333-4444-555555555555";
const ctx = { params: Promise.resolve({ id: THREAD }) };
const other = { params: Promise.resolve({ id: "not-a-uuid" }) };

const page = {
  head: { id: THREAD, title: "How do I run it?", locked: false },
  url: null,
  comments: [{ id: COMMENT, parentId: null, myVote: 0, upvotes: 1, downvotes: 0 }],
};

const post = (body: unknown, at = ctx) =>
  POST(new Request("http://x/api/discussions/thread", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), at);

let seq = 0;
beforeEach(() => {
  m.backendReady.mockReset().mockReturnValue(true);
  m.currentUser.mockReset().mockResolvedValue({ id: `u${++seq}`, name: "Akhil", login: "akhil" });
  m.readThread.mockReset().mockResolvedValue(page);
  m.addReply.mockReset().mockResolvedValue({ ok: true, id: "99999999-9999-9999-9999-999999999999" });
  m.setVote.mockReset().mockResolvedValue({ ok: true, upvotes: 2, downvotes: 0, myVote: 1 });
  m.setFlag.mockReset().mockResolvedValue({ ok: true });
});

describe("GET /api/discussions/[id]", () => {
  it("503s without a backend and 400s on an id that cannot be a thread", async () => {
    m.backendReady.mockReturnValue(false);
    expect((await GET(new Request("http://x"), ctx)).status).toBe(503);
    m.backendReady.mockReturnValue(true);
    expect((await GET(new Request("http://x"), { params: Promise.resolve({ id: "../../etc" }) })).status).toBe(400);
    expect(m.readThread).not.toHaveBeenCalled();
  });

  it("hands out the flat rows, and the reader's own votes if there is a reader", async () => {
    m.currentUser.mockResolvedValue({ id: "reader-1", name: "Akhil", login: "akhil" });
    const body = await (await GET(new Request("http://x"), ctx)).json();
    expect(m.readThread).toHaveBeenCalledWith(THREAD, "reader-1");
    expect(body.comments).toHaveLength(1);
    m.currentUser.mockResolvedValue(null);
    await GET(new Request("http://x"), ctx);
    expect(m.readThread.mock.calls.at(-1)![1]).toBeNull();
  });

  it("404s for a thread the store does not have", async () => {
    m.readThread.mockResolvedValue(null);
    expect((await GET(new Request("http://x"), ctx)).status).toBe(404);
  });
});

describe("POST /api/discussions/[id]", () => {
  it("needs a session for every action", async () => {
    m.currentUser.mockResolvedValue(null);
    for (const body of [
      { action: "reply", body: "hi" },
      { action: "vote", commentId: COMMENT, value: 1 },
      { action: "flag", commentId: COMMENT, reason: "spam" },
    ]) {
      expect((await post(body)).status).toBe(401);
    }
    expect(m.addReply).not.toHaveBeenCalled();
  });

  it("only knows three actions", async () => {
    expect((await post({ action: "delete" })).status).toBe(400);
    expect((await post("{bad")).status).toBe(400);
    expect((await post({ action: "pin", commentId: COMMENT })).status).toBe(400);
  });

  it("replies inside the thread named by the URL, not by the body", async () => {
    await post({ action: "reply", parentId: COMMENT, body: "me too", discussionId: "deadbeef" });
    expect(m.addReply.mock.calls[0][0]).toMatchObject({ discussionId: THREAD, parentId: COMMENT });
  });

  it("rejects a parent that is not a comment id", async () => {
    expect((await post({ action: "reply", parentId: "1; DROP TABLE comments", body: "x" })).status).toBe(400);
    expect(m.addReply).not.toHaveBeenCalled();
  });

  it("carries the store's answer through, including a closed thread", async () => {
    m.addReply.mockResolvedValue({ error: "this thread is closed to new replies", status: 403 });
    const res = await post({ action: "reply", body: "anyone still here?" });
    expect(res.status).toBe(403);
    m.addReply.mockResolvedValue({ error: "that discussion is gone", status: 404 });
    expect((await post({ action: "reply", body: "x" })).status).toBe(404);
  });

  it("takes only -1, 0 and 1 as a vote, and only for a real comment", async () => {
    expect((await post({ action: "vote", commentId: COMMENT, value: 7 })).status).toBe(400);
    expect((await post({ action: "vote", commentId: "zzz", value: 1 })).status).toBe(400);
    const res = await post({ action: "vote", commentId: COMMENT, value: -1 });
    expect(await res.json()).toEqual({ ok: true, upvotes: 2, downvotes: 0, myVote: 1 });
    expect(m.setVote.mock.calls[0][0]).toMatchObject({ commentId: COMMENT, value: -1 });
  });

  it("keeps a report to the reasons the site lists", async () => {
    expect((await post({ action: "flag", commentId: COMMENT, reason: "i dislike him" })).status).toBe(400);
    expect((await post({ action: "flag", commentId: COMMENT, reason: "harassment" })).status).toBe(200);
    expect(m.setFlag.mock.calls[0][0]).toEqual({ commentId: COMMENT, reason: "harassment" });
  });

  it("limits each action on its own, so voting does not spend replies", async () => {
    for (let i = 0; i < 20; i++) expect((await post({ action: "reply", body: `r${i}` })).status).toBe(201);
    expect((await post({ action: "reply", body: "one too many" })).status).toBe(429);
    expect((await post({ action: "vote", commentId: COMMENT, value: 1 })).status).toBe(200);
    expect((await post({ action: "flag", commentId: COMMENT, reason: "spam" })).status).toBe(200);
  });

  it("keeps one reader's limit to themselves", async () => {
    for (let i = 0; i < 20; i++) await post({ action: "reply", body: `r${i}` });
    m.currentUser.mockResolvedValue({ id: "somebody-else", name: "Else", login: "else" });
    expect((await post({ action: "reply", body: "fine, I am new here" })).status).toBe(201);
  });

  it("refuses a thread id that is not shaped like one before touching the store", async () => {
    expect((await post({ action: "reply", body: "x" }, other)).status).toBe(400);
    expect(m.addReply).not.toHaveBeenCalled();
  });
});
