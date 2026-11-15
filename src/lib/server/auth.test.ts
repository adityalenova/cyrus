import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The session layer is where a sign-in actually ends, so these run the real
   code with only two things faked: where the cookie jar lives and whether a
   database exists. Everything else - the JWT, the identity id, the read-back -
   is the same code production runs. */

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const getDb = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { value: jar.store.get(name) } : undefined),
    set: (name: string, value: string) => { jar.store.set(name, value); },
    delete: (name: string) => { jar.store.delete(name); },
  }),
}));
vi.mock("@/lib/db", () => ({ getDb, dbReady: () => Boolean(getDb()) }));

import {
  currentPublicUser, githubReady, googleReady, identityId, issueSession,
  readSession, sessionsReady, setSession,
} from "./auth";

const SECRET = "a-secret-longer-than-16";
const IDENTITY = { provider: "google" as const, providerId: "123", name: "Sam", email: "sam@example.com", picture: "p" };

/** the smallest object that satisfies the two query shapes auth.ts uses.
   `stored` is the row an insert returns, `found` the one a select finds - they
   differ so a vanished row can be tested. */
function fakeDb(stored: Record<string, unknown>, found: Record<string, unknown> | null = stored) {
  return {
    insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [stored] }) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (found ? [found] : []) }) }) }),
  };
}

beforeEach(() => {
  jar.store.clear();
  getDb.mockReset().mockReturnValue(null);
  vi.stubEnv("SESSION_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("capability flags", () => {
  it("counts a secret, not a database, as the ability to sign someone in", () => {
    expect(sessionsReady()).toBe(true);
    vi.stubEnv("SESSION_SECRET", "short");
    expect(sessionsReady()).toBe(false);
    vi.stubEnv("SESSION_SECRET", "");
    expect(sessionsReady()).toBe(false);
  });

  it("only calls a provider ready when this server can actually finish it", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "gid");
    expect(googleReady()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    expect(googleReady()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_GITHUB_CLIENT_ID", "cid");
    expect(githubReady()).toBe(false);                       // id alone cannot trade a code
    vi.stubEnv("GITHUB_CLIENT_SECRET", "csecret");
    expect(githubReady()).toBe(true);
    vi.stubEnv("SESSION_SECRET", "");
    expect(githubReady()).toBe(false);
  });
});

describe("issueSession", () => {
  it("signs a cookie from the provider's claims when there is no database", async () => {
    const user = await issueSession(IDENTITY);
    expect(user).toEqual({
      id: "google:123", name: "Sam", login: null,
      email: "sam@example.com", picture: "p", provider: "google",
    });
    expect(jar.store.has("cyrus.session")).toBe(true);
  });

  it("stores the users row and sessions that row's id when a database exists", async () => {
    const row = { id: "u1", name: "Sam", login: null, email: "sam@example.com", picture: "p", provider: "google" };
    const db = fakeDb({ ...row, providerId: "123" });
    const insert = vi.spyOn(db, "insert");
    getDb.mockReturnValue(db as never);

    /* the client gets the public shape back - providerId stays in the table */
    expect(await issueSession(IDENTITY)).toEqual(row);
    expect(insert).toHaveBeenCalled();
    expect(await readSession()).toEqual({ uid: "u1", name: "Sam", provider: "google" });
  });

  it("gives the same id to the same account on every deploy", () => {
    expect(identityId(IDENTITY)).toBe("google:123");
    expect(identityId({ provider: "email", providerId: "Sam@Example.com", name: "Sam" })).toBe("email:Sam@Example.com");
  });
});

describe("readSession / currentPublicUser", () => {
  it("reads the identity back out of a cookie this server minted", async () => {
    await issueSession(IDENTITY);
    expect(await readSession()).toEqual({ uid: "google:123", name: "Sam", provider: "google" });
    expect(await currentPublicUser()).toMatchObject({ id: "google:123", name: "Sam", provider: "google" });
  });

  it("answers nobody when the cookie was not signed here", async () => {
    await setSession({ uid: "google:123", name: "Sam", provider: "google" });
    jar.store.set("cyrus.session", "not-a-jose-token");
    expect(await readSession()).toBeNull();
    expect(await currentPublicUser()).toBeNull();
  });

  it("does not fall back to the claims once a database exists, if the row is gone", async () => {
    getDb.mockReturnValue(fakeDb({ id: "u1" }, null) as never);
    await setSession({ uid: "gone", name: "Sam", provider: "google" });
    expect(await currentPublicUser()).toBeNull();
  });
});
