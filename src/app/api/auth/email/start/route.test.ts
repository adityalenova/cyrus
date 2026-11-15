import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(),
  storeCode: vi.fn(),
  sendCodeEmail: vi.fn(),
  dropCode: vi.fn(),
}));
vi.mock("@/lib/server/turnstile", () => ({ verifyTurnstile: m.verifyTurnstile }));
vi.mock("@/lib/server/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/email")>()),
  genCode: () => "123456",
  issueEnvelope: () => "signed-envelope",
  storeCode: m.storeCode,
  sendCodeEmail: m.sendCodeEmail,
  dropCode: m.dropCode,
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://x/api/auth/email/start", {
    method: "POST",
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

beforeEach(() => {
  m.verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  m.storeCode.mockReset().mockResolvedValue(true);
  m.sendCodeEmail.mockReset().mockResolvedValue({ sent: true });
  m.dropCode.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  const real = await vi.importActual<typeof import("@/lib/server/email")>("@/lib/server/email");
  real.__mem.clear();
});

describe("POST /api/auth/email/start", () => {
  it("sends a code and returns the challenge without calling dropCode (Test C)", async () => {
    const res = await post({ email: "  Sam@Example.com ", turnstile: "tok" });
    expect(await res.json()).toEqual({ ok: true, sent: true, challenge: "signed-envelope", expires_in_seconds: 600 });
    expect(m.verifyTurnstile).toHaveBeenCalledWith("tok", "1.2.3.4");
    expect(m.storeCode).toHaveBeenCalledWith("sam@example.com", "123456");
    expect(m.sendCodeEmail).toHaveBeenCalledWith("sam@example.com", "123456");
    expect(m.dropCode).not.toHaveBeenCalled();
  });

  it("rejects an invalid or missing email before anything else runs", async () => {
    expect(await (await post({ email: "nope" })).json()).toEqual({ ok: false, reason: "invalid_email" });
    expect(await (await post("{bad json")).json()).toEqual({ ok: false, reason: "invalid_email" });
    expect(m.verifyTurnstile).not.toHaveBeenCalled();
    expect(m.dropCode).not.toHaveBeenCalled();
  });

  it("stops at the captcha gate without sending mail or storing/dropping codes", async () => {
    m.verifyTurnstile.mockResolvedValue({ ok: false, reason: "captcha_required" });
    expect(await (await post({ email: "a@b.co" })).json()).toEqual({ ok: false, reason: "captcha_required" });
    expect(m.storeCode).not.toHaveBeenCalled();
    expect(m.sendCodeEmail).not.toHaveBeenCalled();
    expect(m.dropCode).not.toHaveBeenCalled();
  });

  it("applies the resend lock and does not invoke dropCode (Test C)", async () => {
    m.storeCode.mockResolvedValue(false);
    expect(await (await post({ email: "a@b.co" })).json()).toEqual({ ok: false, reason: "too_soon", retry_in_seconds: 30 });
    expect(m.sendCodeEmail).not.toHaveBeenCalled();
    expect(m.dropCode).not.toHaveBeenCalled();
  });

  it("returns the code in demo mode without invoking dropCode (Test D)", async () => {
    m.sendCodeEmail.mockResolvedValue({ sent: false, demo: true, code: "123456" });
    expect(await (await post({ email: "a@b.co" })).json()).toEqual({
      ok: true,
      sent: false,
      demo: true,
      code: "123456",
      challenge: "signed-envelope",
      expires_in_seconds: 600,
    });
    expect(m.dropCode).not.toHaveBeenCalled();
  });

  it("cleans up pending code with normalized email when email dispatch fails (Test A)", async () => {
    m.sendCodeEmail.mockResolvedValue({ sent: false, error: "boom" });
    const res = await post({ email: "  User@Example.com " });
    expect(await res.json()).toEqual({ ok: false, reason: "send_failed", error: "boom" });
    expect(m.dropCode).toHaveBeenCalledTimes(1);
    expect(m.dropCode).toHaveBeenCalledWith("user@example.com");
  });

  it("cleans up pending memory storage on delivery failure and allows immediate retry without too_soon (Test B)", async () => {
    const real = await vi.importActual<typeof import("@/lib/server/email")>("@/lib/server/email");
    m.storeCode.mockImplementation(real.storeCode);
    m.dropCode.mockImplementation(real.dropCode);

    const email = "retry-memory@example.com";
    real.__mem.clear();

    // 1. Simulate email delivery failure
    m.sendCodeEmail.mockResolvedValueOnce({ sent: false, error: "smtp timeout" });
    const res1 = await post({ email: `  ${email.toUpperCase()}  ` });
    expect(await res1.json()).toEqual({ ok: false, reason: "send_failed", error: "smtp timeout" });

    // 2. Verify that pending entry is removed from memory storage
    expect(real.__mem.has(email)).toBe(false);

    // 3. Immediately attempt another request for the same email
    m.sendCodeEmail.mockResolvedValueOnce({ sent: true });
    const res2 = await post({ email });
    expect(await res2.json()).toEqual({
      ok: true,
      sent: true,
      challenge: "signed-envelope",
      expires_in_seconds: 600,
    });

    // 4. Successful delivery preserves entry in memory and enforces resend lock on subsequent attempt
    expect(real.__mem.has(email)).toBe(true);
    const res3 = await post({ email });
    expect(await res3.json()).toEqual({
      ok: false,
      reason: "too_soon",
      retry_in_seconds: 30,
    });
  });

  /* the real sender against a mocked Resend: a 422 with a body that is not
     JSON still reaches the caller as a readable reason, never a 500 */
  it("passes a legible reason through when Resend answers 422 with a non-JSON body and invokes dropCode", async () => {
    const real = await vi.importActual<typeof import("@/lib/server/email")>("@/lib/server/email");
    m.sendCodeEmail.mockImplementation(real.sendCodeEmail);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "cyrus.ai <no-reply@example.com>");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>upstream error</html>", { status: 422 })));
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "send_failed", error: "resend rejected the request (422)" });
    expect(m.dropCode).toHaveBeenCalledWith("a@b.co");
  });
});