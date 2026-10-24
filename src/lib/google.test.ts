/* Guards issue #53: after sign-in, user is redirected to /dashboard instead
 * of public pages previously visited. Only protected routes (/dashboard/*)
 * are preserved as return targets. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
});

import { isProtectedPath, startGoogleSignIn, takeGoogleReturn } from "./google";

describe("isProtectedPath", () => {
  it("identifies dashboard routes as protected", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/")).toBe(true);
    expect(isProtectedPath("/dashboard/issues")).toBe(true);
    expect(isProtectedPath("/dashboard/repos")).toBe(true);
    expect(isProtectedPath("/dashboard/calendar")).toBe(true);
    expect(isProtectedPath("/dashboard/demand")).toBe(true);
    expect(isProtectedPath("/dashboard?tab=recent")).toBe(true);
    expect(isProtectedPath("/dashboard/calendar?view=month#today")).toBe(true);
  });

  it("identifies public catalog pages as not protected", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/issues")).toBe(false);
    expect(isProtectedPath("/issues?q=good+first+issue")).toBe(false);
    expect(isProtectedPath("/programs")).toBe(false);
    expect(isProtectedPath("/programs/gsoc")).toBe(false);
    expect(isProtectedPath("/organizations")).toBe(false);
    expect(isProtectedPath("/organizations/meta")).toBe(false);
    expect(isProtectedPath("/projects")).toBe(false);
    expect(isProtectedPath("/skills")).toBe(false);
    expect(isProtectedPath("/sponsors")).toBe(false);
    expect(isProtectedPath("/leaderboard")).toBe(false);
    expect(isProtectedPath("/about")).toBe(false);
    expect(isProtectedPath("/privacy")).toBe(false);
    expect(isProtectedPath("/terms")).toBe(false);
  });

  it("guards against open redirects and malformed URLs", () => {
    expect(isProtectedPath("")).toBe(false);
    expect(isProtectedPath("//evil.com")).toBe(false);
    expect(isProtectedPath("//evil.com/dashboard")).toBe(false);
    expect(isProtectedPath("https://evil.com/dashboard")).toBe(false);
    expect(isProtectedPath("javascript:alert(1)")).toBe(false);
    expect(isProtectedPath("/dashboard-fake")).toBe(false);
  });
});

describe("takeGoogleReturn", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to /dashboard when no return URL is saved", () => {
    expect(takeGoogleReturn()).toBe("/dashboard");
  });

  it("defaults to /dashboard when saved return URL is a public page", () => {
    store.set("cyrus.google.return", "/issues");
    expect(takeGoogleReturn()).toBe("/dashboard");
    expect(store.has("cyrus.google.return")).toBe(false);

    store.set("cyrus.google.return", "/programs");
    expect(takeGoogleReturn()).toBe("/dashboard");

    store.set("cyrus.google.return", "/organizations/meta");
    expect(takeGoogleReturn()).toBe("/dashboard");
  });

  it("preserves return URL when user was trying to reach a protected route", () => {
    store.set("cyrus.google.return", "/dashboard/calendar");
    expect(takeGoogleReturn()).toBe("/dashboard/calendar");
    expect(store.has("cyrus.google.return")).toBe(false);

    store.set("cyrus.google.return", "/dashboard/issues?filter=saved");
    expect(takeGoogleReturn()).toBe("/dashboard/issues?filter=saved");
  });

  it("safely falls back to /dashboard if sessionStorage throws", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("Access denied in private mode");
      },
      removeItem: () => {},
    });
    expect(takeGoogleReturn()).toBe("/dashboard");
  });
});

describe("startGoogleSignIn", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("only stores RETURN_KEY for protected routes and clears it for public pages", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");

    const assignMock = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/issues",
        search: "?q=good",
        origin: "http://localhost:5330",
        assign: assignMock,
      },
    });

    // Start from a public page (/issues)
    startGoogleSignIn();
    expect(store.has("cyrus.google.return")).toBe(false);
    expect(store.has("cyrus.google.nonce")).toBe(true);

    // Now start from a protected page (/dashboard/calendar)
    vi.stubGlobal("window", {
      location: {
        pathname: "/dashboard/calendar",
        search: "?view=month",
        origin: "http://localhost:5330",
        assign: assignMock,
      },
    });

    startGoogleSignIn();
    expect(store.get("cyrus.google.return")).toBe("/dashboard/calendar?view=month");

    // Going back to a public page clears any stale return key
    vi.stubGlobal("window", {
      location: {
        pathname: "/programs",
        search: "",
        origin: "http://localhost:5330",
        assign: assignMock,
      },
    });

    startGoogleSignIn();
    expect(store.has("cyrus.google.return")).toBe(false);
  });
});
