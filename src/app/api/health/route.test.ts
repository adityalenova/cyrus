import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("reports everything off when nothing is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, db: false, auth: false, google: false, github: false, captcha: false });
    expect(typeof body.time).toBe("string");
  });

  it("separates a missing email key from an unverified sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await (await GET()).json()).email).toBe("missing_key");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "");
    expect((await (await GET()).json()).email).toBe("unverified_from");
    vi.stubEnv("EMAIL_FROM", "cyrus.ai <no-reply@example.com>");
    expect((await (await GET()).json()).email).toBe("ok");
  });

  it("reports db and auth when both are set", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://example");
    vi.stubEnv("SESSION_SECRET", "a-secret-longer-than-16");
    expect(await (await GET()).json()).toMatchObject({ db: true, auth: true });
  });

  it("does not count a short session secret as auth", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    expect((await (await GET()).json()).auth).toBe(false);
  });

  /* the sign-in sheet reads these to decide what a button is allowed to do,
     so a provider with an id but no secret must never report itself ready. */
  it("names the providers this deploy can actually finish", async () => {
    vi.stubEnv("SESSION_SECRET", "a-secret-longer-than-16");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "gid");
    vi.stubEnv("NEXT_PUBLIC_GITHUB_CLIENT_ID", "cid");
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    expect(await (await GET()).json()).toMatchObject({ auth: true, google: true, github: false, captcha: false });

    vi.stubEnv("GITHUB_CLIENT_SECRET", "csecret");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "x".repeat(20));
    vi.stubEnv("TURNSTILE_SECRET_KEY", "y".repeat(20));
    expect(await (await GET()).json()).toMatchObject({ github: true, captcha: true });

    vi.stubEnv("SESSION_SECRET", "");
    expect(await (await GET()).json()).toMatchObject({ auth: false, google: false, github: false });
  });
});
