/* ══ notifications routes — the shape of each answer ═══════════════
   The store and the session are mocked; what is under test is the route
   contract: the offline / signed-out / success codes, the read-action
   validation, and that the SSE endpoint opens as a real event stream with a
   snapshot frame before it ever tails.                                ═ */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ backendReady: vi.fn(), currentUser: vi.fn() }));
const store = vi.hoisted(() => ({
  listNotifications: vi.fn(), countUnread: vi.fn(), notificationsSince: vi.fn(),
  markNotificationsRead: vi.fn(), markAllNotificationsRead: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  backendReady: auth.backendReady,
  currentUser: auth.currentUser,
  OFFLINE: () => Response.json({ error: "backend offline" }, { status: 503 }),
}));
vi.mock("@/lib/server/notifications", () => store);

import { GET as list } from "@/app/api/notifications/route";
import { POST as read } from "@/app/api/notifications/read/route";
import { GET as stream } from "@/app/api/notifications/stream/route";

const signedIn = { id: "u1" } as never;
const notif = (id: string, read = false) => ({ id, kind: "hackathon", title: "H", body: "", href: "/h", read, createdAt: `2026-11-1${id}T00:00:00Z` });

beforeEach(() => {
  vi.clearAllMocks();
  auth.backendReady.mockReturnValue(true);
  auth.currentUser.mockResolvedValue(signedIn);
});

describe("GET /api/notifications", () => {
  it("is 503 with no backend", async () => {
    auth.backendReady.mockReturnValue(false);
    expect((await list()).status).toBe(503);
  });
  it("is 401 signed out", async () => {
    auth.currentUser.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
  });
  it("returns the recent window and the unread count", async () => {
    store.listNotifications.mockResolvedValue([notif("2", true), notif("3")]);
    store.countUnread.mockResolvedValue(1);
    const body = await (await list()).json();
    expect(body.unread).toBe(1);
    expect(body.notifications.map((n: { id: string }) => n.id)).toEqual(["2", "3"]);
  });
});

describe("POST /api/notifications/read", () => {
  const req = (body: unknown) => new Request("http://x/api/notifications/read", { method: "POST", body: JSON.stringify(body) });
  it("is 401 signed out", async () => {
    auth.currentUser.mockResolvedValue(null);
    expect((await read(req({ all: true }))).status).toBe(401);
  });
  it("mark all delegates to the store", async () => {
    store.markAllNotificationsRead.mockResolvedValue(4);
    const body = await (await read(req({ all: true }))).json();
    expect(store.markAllNotificationsRead).toHaveBeenCalledWith("u1");
    expect(body.updated).toBe(4);
  });
  it("mark some validates ids before writing", async () => {
    store.markNotificationsRead.mockResolvedValue(2);
    expect((await read(req({ ids: ["a", "b"] }))).status).toBe(200);
    expect((await read(req({ ids: [""] }))).status).toBe(400);
    expect((await read(req({ ids: Array(101).fill("x") }))).status).toBe(400);
    expect((await read(req({}) )).status).toBe(400);
  });
});

describe("GET /api/notifications/stream", () => {
  it("is 503 with no backend and 401 signed out", async () => {
    auth.backendReady.mockReturnValue(false);
    expect((await stream(new Request("http://x/s"))).status).toBe(503);
    auth.backendReady.mockReturnValue(true);
    auth.currentUser.mockResolvedValue(null);
    expect((await stream(new Request("http://x/s"))).status).toBe(401);
  });

  it("opens as an event stream and delivers a snapshot frame", async () => {
    store.listNotifications.mockResolvedValue([notif("2", true), notif("3")]);
    store.countUnread.mockResolvedValue(1);
    store.notificationsSince.mockResolvedValue([]);
    const res = await stream(new Request("http://x/s"));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: snapshot");
    expect(text).toContain("data: {");
    await reader.cancel();
  });
});
