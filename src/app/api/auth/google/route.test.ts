import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ issueSession: vi.fn() }));
/* Only the last step gets faked. googleReady runs for real against the
   environment, so these tests prove a deploy without SESSION_SECRET or without
   a client id refuses to finish rather than half-signing someone in. */
vi.mock("@/lib/server/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/auth")>()),
  issueSession: m.issueSession,
}));

import { POST } from "./route";

const fetchMock = vi.fn();
const post = (body: unknown) =>
  POST(new Request("http://x/api/auth/google", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const tokeninfo = (data: unknown, ok = true) => fetchMock.mockResolvedValueOnce({ ok, json: () => Promise.resolve(data) });
const claims = { iss: "https://accounts.google.com", aud: "gid", sub: "123", name: "Sam", email: "sam@example.com", picture: "p" };

beforeEach(() => {
  m.issueSession.mockReset().mockResolvedValue({ id: "u1", name: "Sam", provider: "google" });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SESSION_SECRET", "a-secret-longer-than-16");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "gid");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/auth/google", () => {
  it("is 503 without a session secret or without a client id", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect((await post({ idToken: "t" })).status).toBe(503);
    vi.stubEnv("SESSION_SECRET", "a-secret-longer-than-16");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    expect((await post({ idToken: "t" })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is 400 without an idToken", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post("{bad")).status).toBe(400);
  });

  it("is 401 for a wrong audience, wrong issuer, or failed tokeninfo", async () => {
    tokeninfo({ ...claims, aud: "someone-else" });
    expect((await post({ idToken: "t" })).status).toBe(401);
    tokeninfo({ ...claims, iss: "https://evil.example" });
    expect((await post({ idToken: "t" })).status).toBe(401);
    tokeninfo({}, false);
    expect((await post({ idToken: "t" })).status).toBe(401);
    expect(m.issueSession).not.toHaveBeenCalled();
  });

  it("verifies the token and starts a session from its claims", async () => {
    tokeninfo(claims);
    const res = await post({ idToken: "a b" });
    expect(await res.json()).toEqual({ ok: true, user: { id: "u1", name: "Sam", provider: "google" } });
    expect(fetchMock.mock.calls[0][0]).toContain("id_token=a%20b");
    expect(m.issueSession).toHaveBeenCalledWith(expect.objectContaining({
      provider: "google", providerId: "123", name: "Sam", email: "sam@example.com", picture: "p",
    }));
  });
});
