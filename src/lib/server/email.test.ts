/* ══ email.test.ts — verification-code logic (memory + envelope) ══
   No DATABASE_URL in the test env, so storeCode/checkCode exercise the
   fallbacks: in-memory round-trip, single-use burn, wrong tries lockout
   and the 30s resend lock, plus the HMAC envelope that lets a second
   serverless instance verify a code it never issued.                ═ */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCode, emailStatus, envelopeReady, genCode, issueEnvelope, normalizeEmail, sendCodeEmail, storeCode, validEmail, __mem,
} from "./email";

const mail = () => `t${Math.random().toString(36).slice(2, 8)}@example.com`;

describe("email validators", () => {
  it("accepts normal addresses", () => {
    expect(validEmail("ada@lovelace.dev")).toBe(true);
    expect(validEmail("  You@Example.COM ")).toBe(true);
  });
  it("rejects junk", () => {
    expect(validEmail("")).toBe(false);
    expect(validEmail("no-at-sign")).toBe(false);
    expect(validEmail("a@b")).toBe(false);
    expect(validEmail("a b@c.io")).toBe(false);
  });
  it("normalizes trim + lowercase", () => {
    expect(normalizeEmail("  Ada@Lovalace.Dev ")).toBe("ada@lovalace.dev");
  });
  it("generates six digits", () => {
    for (let i = 0; i < 20; i++) expect(genCode()).toMatch(/^\d{6}$/);
  });
});

describe("code store (memory fallback)", () => {
  it("verifies the right code once, then burns it", async () => {
    const e = mail();
    expect(await storeCode(e, "123456")).toBe(true);
    expect(await checkCode(e, "123456")).toEqual({ ok: true });
    expect(await checkCode(e, "123456")).toEqual({ ok: false, reason: "no_code" });
  });

  it("rejects a wrong code without burning it", async () => {
    const e = mail();
    await storeCode(e, "246810");
    expect(await checkCode(e, "000000")).toEqual({ ok: false, reason: "wrong" });
    expect(await checkCode(e, "246810")).toEqual({ ok: true });
  });

  it("locks after six wrong tries", async () => {
    const e = mail();
    await storeCode(e, "111222");
    for (let i = 0; i < 6; i++) expect(await checkCode(e, "999999")).toEqual({ ok: false, reason: "wrong" });
    expect(await checkCode(e, "111222")).toEqual({ ok: false, reason: "locked" });
    expect(__mem.has(e)).toBe(false);
  });

  it("enforces the 30s resend lock", async () => {
    const e = mail();
    expect(await storeCode(e, "135790")).toBe(true);
    expect(await storeCode(e, "246810")).toBe(false);
  });

  it("reports no_code for an unknown address", async () => {
    expect(await checkCode(mail(), "123456")).toEqual({ ok: false, reason: "no_code" });
  });
});

describe("code envelope (no DATABASE_URL, SESSION_SECRET set)", () => {
  const KEY = "qa-test-secret-length-over-sixteen";
  beforeEach(() => { process.env.SESSION_SECRET = KEY; });
  afterEach(() => { delete process.env.SESSION_SECRET; });

  it("is inert without a signing secret", () => {
    delete process.env.SESSION_SECRET;
    expect(envelopeReady()).toBe(false);
    expect(issueEnvelope(mail(), "123456")).toBeNull();
  });

  it("verifies on an instance that never saw the start request", async () => {
    const e = mail();
    const tok = issueEnvelope(e, "654321");
    expect(typeof tok).toBe("string");
    /* deliberately no storeCode(): only the envelope carries the hash */
    expect(await checkCode(e, "654321", tok!)).toEqual({ ok: true });
  });

  it("never trusts a tampered or foreign envelope", async () => {
    const e = mail();
    const tok = issueEnvelope(e, "111111")!;
    expect(await checkCode(e, "111111", "nonsense")).toEqual({ ok: false, reason: "no_code" });
    expect(await checkCode(e, "111111", tok + "x")).toEqual({ ok: false, reason: "no_code" });
    expect(await checkCode(`other@${e.split("@")[1]}`, "111111", tok)).toEqual({ ok: false, reason: "no_code" });
  });

  it("counts tries across instances and burns after six", async () => {
    const e = mail();
    let tok = issueEnvelope(e, "222222")!;
    for (let i = 0; i < 6; i++) {
      const r = await checkCode(e, "999999", tok);
      if (r.ok) throw new Error("a wrong code must not verify");
      expect(r.reason).toBe("wrong");
      expect(typeof r.challenge).toBe("string");
      tok = r.challenge!;
    }
    expect(await checkCode(e, "222222", tok)).toEqual({ ok: false, reason: "locked", challenge: null });
  });

  it("spends the envelope - a correct code works once", async () => {
    const e = mail();
    const tok = issueEnvelope(e, "333333")!;
    expect(await checkCode(e, "333333", tok)).toEqual({ ok: true });
    expect(await checkCode(e, "333333", tok)).toEqual({ ok: false, reason: "no_code" });
  });
});

describe("sendCodeEmail error reporting", () => {
  const rejected = (body: string, status = 422) => new Response(body, { status });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const setup = (res: Response) => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "cyrus.ai <no-reply@example.com>");
    const f = vi.fn().mockResolvedValue(res);
    vi.stubGlobal("fetch", f);
    return f;
  };

  it("turns a JSON error body into a short reason with every address masked", async () => {
    setup(rejected(JSON.stringify({
      statusCode: 422,
      name: "validation_error",
      message: "You can only send testing emails to your own email address (owner@x.dev). Recipient Visitor@Example.com refused.",
    })));
    const r = await sendCodeEmail("visitor@example.com", "123456");
    expect(r).toEqual({
      sent: false,
      error: "resend 422: validation_error: You can only send testing emails to your own email address ([address]). Recipient [address] refused.",
    });
    expect(JSON.stringify(r)).not.toMatch(/owner@x\.dev|visitor@example\.com/i);
  });

  it("caps a long upstream message", async () => {
    setup(rejected(JSON.stringify({ name: "x", message: "y".repeat(1000) })));
    const r = await sendCodeEmail("a@b.co", "123456");
    expect("error" in r && r.error.length).toBeLessThanOrEqual("resend 422: ".length + 200);
  });

  it("falls back to a generic reason when the body is not JSON", async () => {
    setup(rejected("<html>bad gateway</html>"));
    expect(await sendCodeEmail("a@b.co", "123456")).toEqual({
      sent: false, error: "resend rejected the request (422)",
    });
  });

  it("falls back to a generic reason when the JSON has no name or message", async () => {
    setup(rejected("null", 403));
    expect(await sendCodeEmail("a@b.co", "123456")).toEqual({
      sent: false, error: "resend rejected the request (403)",
    });
  });

  it("reports success", async () => {
    setup(new Response("{}", { status: 200 }));
    expect(await sendCodeEmail("a@b.co", "123456")).toEqual({ sent: true });
  });

  it("refuses to send from the testing address in production", async () => {
    const f = setup(new Response("{}", { status: 200 }));
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("NODE_ENV", "production");
    const r = await sendCodeEmail("a@b.co", "123456");
    expect(r).toMatchObject({ sent: false, error: expect.stringContaining("EMAIL_FROM") });
    expect(f).not.toHaveBeenCalled();
  });

  it("uses the testing address outside production", async () => {
    const f = setup(new Response("{}", { status: 200 }));
    vi.stubEnv("EMAIL_FROM", "");
    await sendCodeEmail("a@b.co", "123456");
    expect(JSON.parse(f.mock.calls[0][1].body).from).toContain("onboarding@resend.dev");
  });
});

describe("emailStatus", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("separates a missing key from an unverified sender", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailStatus()).toBe("missing_key");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "");
    expect(emailStatus()).toBe("unverified_from");
    vi.stubEnv("EMAIL_FROM", "cyrus.ai <onboarding@resend.dev>");
    expect(emailStatus()).toBe("unverified_from");
    vi.stubEnv("EMAIL_FROM", "cyrus.ai <no-reply@example.com>");
    expect(emailStatus()).toBe("ok");
  });
});
