import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sessionsReady: vi.fn(),
  issueSession: vi.fn(),
  checkCode: vi.fn(),
}));
/* the route only ever asks two questions of the session layer: can this
   deploy sign a cookie, and if so hand it the verified identity. */
vi.mock("@/lib/server/auth", () => ({
  sessionsReady: m.sessionsReady,
  issueSession: m.issueSession,
}));
vi.mock("@/lib/server/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/email")>()),
  checkCode: m.checkCode,
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://x/api/auth/email/verify", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const good = { email: "Sam@Example.com", code: "123456" };

beforeEach(() => {
  m.sessionsReady.mockReset().mockReturnValue(true);
  m.issueSession.mockReset().mockResolvedValue({ id: "u1", name: "Sam", provider: "email" });
  m.checkCode.mockReset().mockResolvedValue({ ok: true });
});

describe("POST /api/auth/email/verify", () => {
  it("rejects malformed email or code without checking anything", async () => {
    for (const body of [{ email: "x", code: "123456" }, { email: "a@b.co", code: "12345" }, { email: "a@b.co", code: "abcdef" }, "{bad"]) {
      expect(await (await post(body)).json()).toEqual({ ok: false, reason: "wrong" });
    }
    expect(m.checkCode).not.toHaveBeenCalled();
  });

  it("passes a wrong code through with the re-signed challenge", async () => {
    m.checkCode.mockResolvedValue({ ok: false, reason: "wrong", challenge: "new-env" });
    expect(await (await post({ ...good, challenge: "old-env" })).json()).toEqual({ ok: false, reason: "wrong", challenge: "new-env" });
    expect(m.checkCode).toHaveBeenCalledWith("sam@example.com", "123456", "old-env");
    expect(m.issueSession).not.toHaveBeenCalled();
  });

  it("starts a session from the verified address when the deploy can sign cookies", async () => {
    const res = await post({ ...good, name: " Sam S " });
    expect(await res.json()).toEqual({ ok: true, user: { id: "u1", name: "Sam", provider: "email" } });
    expect(m.issueSession).toHaveBeenCalledWith({ provider: "email", providerId: "sam@example.com", name: "Sam S", email: "sam@example.com" });
  });

  it("signs in locally (offline) when there is no session secret", async () => {
    m.sessionsReady.mockReturnValue(false);
    const body = await (await post(good)).json();
    expect(body).toMatchObject({ ok: true, offline: true, user: { id: "email:sam@example.com", name: "sam", provider: "email" } });
    expect(m.issueSession).not.toHaveBeenCalled();
  });
});
