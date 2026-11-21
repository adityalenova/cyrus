import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), feed: vi.fn(), render: vi.fn(), quota: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ currentPublicUser: mocks.user }));
vi.mock("@/app/api/users/[login]/activity/route", () => ({ GET: mocks.feed }));
vi.mock("@/lib/server/renderPdfReport", () => ({ renderPdfReport: mocks.render }));
vi.mock("@/lib/server/slidingRateLimit", () => ({ slidingRateLimiter: { check: mocks.quota } }));
import { POST } from "./route";
import { REPOS } from "@/data/repos";

const req = (body: unknown, headers: Record<string, string> = {}) => new Request("https://cyrus.test/api/reports", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
const project = { kind: "projects", ids: [REPOS[0].repo] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user.mockResolvedValue(null); mocks.quota.mockReturnValue({ allowed: true });
  mocks.render.mockResolvedValue(Buffer.from("%PDF-1.7\nfixture"));
  mocks.feed.mockResolvedValue(Response.json({ events: [], fetchedAt: 1_000 }));
});

describe("server PDF boundary", () => {
  it("returns a bounded, private attachment using catalog data only", async () => {
    const response = await POST(req(project)); expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="cyrus-projects-A4.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toMatch(/^%PDF/); expect(mocks.user).not.toHaveBeenCalled();
  });
  it("uses the incoming host when Next's internal request URL is behind a proxy", async () => {
    const response = await POST(req(project, { Host: "public.cyrus.test", Origin: "https://public.cyrus.test" }));
    expect(response.status).toBe(200);
    expect((await POST(req(project, { Host: "public.cyrus.test", Origin: "https://foreign.test" }))).status).toBe(403);
  });
  it("rejects foreign origins, invalid content and oversized streamed bodies before rendering", async () => {
    expect((await POST(req(project, { Origin: "https://evil.test" }))).status).toBe(403);
    expect((await POST(req(project, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await POST(req(project, { "Content-Length": "5000" }))).status).toBe(413);
    expect((await POST(req({ padding: "x".repeat(5000) }))).status).toBe(413);
    expect((await POST(new Request("https://cyrus.test/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status).toBe(400);
    expect((await POST(req({ ...project, html: "fake" }))).status).toBe(400);
    expect((await POST(req({ kind: "projects", ids: ["not/catalog"] }))).status).toBe(404);
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("requires a real session and linked login, and refuses arbitrary personal report identities", async () => {
    expect((await POST(req({ kind: "activity" }))).status).toBe(401);
    mocks.user.mockResolvedValue({ id: "email:one", login: null });
    expect((await POST(req({ kind: "activity" }))).status).toBe(409);
    expect((await POST(req({ kind: "activity", login: "victim" }))).status).toBe(400);
    expect(mocks.feed).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled();
  });
  it("fetches the session's own recent public feed, handles upstream failure and permits retry", async () => {
    mocks.user.mockResolvedValue({ id: "github:one", login: "session-owner" });
    mocks.feed.mockResolvedValueOnce(Response.json({ error: "private upstream detail" }, { status: 502 }));
    const failed = await POST(req({ kind: "activity" })); expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("private upstream");
    const response = await POST(req({ kind: "activity", size: "LETTER" })); expect(response.status).toBe(200);
    const context = mocks.feed.mock.calls[1][1]; expect(await context.params).toEqual({ login: "session-owner" });
    expect(mocks.render.mock.calls[0][0].title).toBe("Recent public activity");
  });
  it("bounds admission and concurrent rendering, and releases the slot after rejection", async () => {
    mocks.quota.mockReturnValueOnce({ allowed: false });
    const limited = await POST(req(project)); expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("60");
    let reject!: (reason: Error) => void;
    const started = new Promise<void>((resolve) => mocks.render.mockImplementationOnce(() => { resolve(); return new Promise((_res, fail) => { reject = fail; }); }));
    const first = POST(req(project)); await started;
    expect((await POST(req(project))).status).toBe(503);
    reject(new Error("private filesystem path"));
    const failed = await first; expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("filesystem");
    mocks.render.mockResolvedValue(Buffer.from("%PDF retry")); expect((await POST(req(project))).status).toBe(200);
  });
  it("rejects an oversized output without exposing a partial document", async () => {
    mocks.render.mockResolvedValue(Buffer.alloc(5 * 1024 * 1024 + 1));
    const response = await POST(req(project)); expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
});
