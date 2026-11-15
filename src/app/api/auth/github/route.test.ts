import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ issueSession: vi.fn() }));
/* Only the session write gets faked; githubReady runs for real, so "the app
   id is set but its secret is not" - the exact state this deploy is in -
   behaves as an offline server instead of a popup that can never land. */
vi.mock("@/lib/server/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/auth")>()),
  issueSession: m.issueSession,
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://x/api/auth/github", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const reply = (data: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(data) });
const fetchMock = vi.fn();

beforeEach(() => {
  m.issueSession.mockReset().mockResolvedValue({ id: "u1", name: "Octo", provider: "github" });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SESSION_SECRET", "a-secret-longer-than-16");
  vi.stubEnv("NEXT_PUBLIC_GITHUB_CLIENT_ID", "cid");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "csecret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/auth/github", () => {
  it("is 503 when the app id or its secret is missing", async () => {
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    expect((await post({ code: "c", verifier: "v" })).status).toBe(503);
    vi.stubEnv("GITHUB_CLIENT_SECRET", "csecret");
    vi.stubEnv("NEXT_PUBLIC_GITHUB_CLIENT_ID", "");
    expect((await post({ code: "c", verifier: "v" })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is 503 without a session secret", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect((await post({ code: "c", verifier: "v" })).status).toBe(503);
  });

  it("is 400 without code and verifier", async () => {
    expect((await post({ code: "c" })).status).toBe(400);
    expect((await post("{bad")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is 401 when GitHub rejects the code", async () => {
    fetchMock.mockReturnValueOnce(reply({ error: "bad_verification_code" }));
    expect((await post({ code: "c", verifier: "v" })).status).toBe(401);
    expect(m.issueSession).not.toHaveBeenCalled();
  });

  it("is 401 when the profile cannot be read", async () => {
    fetchMock.mockReturnValueOnce(reply({ access_token: "t" })).mockReturnValueOnce(reply({}, false));
    expect((await post({ code: "c", verifier: "v" })).status).toBe(401);
  });

  it("exchanges the code and starts a session from the GitHub profile", async () => {
    fetchMock
      .mockReturnValueOnce(reply({ access_token: "t" }))
      .mockReturnValueOnce(reply({ id: 7, login: "octo", name: null, email: null, avatar_url: "http://a/p.png" }));
    const res = await post({ code: "c", verifier: "v" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, user: { id: "u1", name: "Octo", provider: "github" } });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ client_id: "cid", client_secret: "csecret", code: "c", code_verifier: "v" });
    expect(m.issueSession).toHaveBeenCalledWith(expect.objectContaining({
      provider: "github", providerId: "7", login: "octo", name: "octo", picture: "http://a/p.png",
    }));
  });
});
