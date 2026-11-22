/* preferences routes - the contract of each answer (#196)
   The store, the session and the digest run are mocked; what is under test is the
   route: offline / signed-out / invalid / success codes, that the unsubscribe
   link needs a valid signed token, that the cron route is closed without its
   secret, and that every email template really renders with an unsubscribe link. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ backendReady: vi.fn(), currentUser: vi.fn() }));
const store = vi.hoisted(() => ({
  getPrefs: vi.fn(), savePrefs: vi.fn(), discardPending: vi.fn(), unsubscribeAll: vi.fn(),
}));
const digest = vi.hoisted(() => ({ runDigests: vi.fn() }));

vi.mock("@/lib/server/auth", () => ({
  backendReady: auth.backendReady,
  currentUser: auth.currentUser,
  OFFLINE: () => Response.json({ error: "backend offline" }, { status: 503 }),
}));
vi.mock("@/lib/server/notificationPrefs", () => store);
vi.mock("@/lib/server/notificationDigest", () => digest);

import { GET as cron } from "@/app/api/cron/notification-digest/route";
import { GET as getPrefs, PUT as putPrefs } from "@/app/api/me/notification-preferences/route";
import { GET as preview } from "@/app/api/notifications/preview/route";
import { POST as unsubscribe } from "@/app/api/notifications/unsubscribe/route";
import { defaultPrefs, PREVIEW_TEMPLATES } from "@/lib/notificationPrefs";
import { signUnsubscribeToken } from "@/lib/server/unsubscribeToken";

const UID = "3f2b8a40-1c5d-4e6f-9a7b-0d1e2f3a4b5c";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SESSION_SECRET", "a-secret-that-is-long-enough-1234");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "cyrus.ai <hello@example.test>");
  auth.backendReady.mockReturnValue(true);
  auth.currentUser.mockResolvedValue({ id: UID, email: "ada@example.test" });
  store.getPrefs.mockResolvedValue(defaultPrefs());
  store.savePrefs.mockImplementation(async (_id: string, p: unknown) => p);
});
afterEach(() => vi.unstubAllEnvs());

const put = (body: unknown) =>
  putPrefs(new Request("http://x/api/me/notification-preferences", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("GET /api/me/notification-preferences", () => {
  it("is 503 with no backend and 401 signed out", async () => {
    auth.backendReady.mockReturnValue(false);
    expect((await getPrefs()).status).toBe(503);
    auth.backendReady.mockReturnValue(true);
    auth.currentUser.mockResolvedValue(null);
    expect((await getPrefs()).status).toBe(401);
  });

  it("returns the choices, whether there is an address, and whether this deploy can send", async () => {
    const body = await (await getPrefs()).json();
    expect(body.prefs).toEqual(defaultPrefs());
    expect(body.hasEmail).toBe(true);
    expect(body.emailStatus).toBe("ok");
    auth.currentUser.mockResolvedValue({ id: UID, email: null });
    vi.stubEnv("RESEND_API_KEY", "");
    const bare = await (await getPrefs()).json();
    expect(bare.hasEmail).toBe(false);
    expect(bare.emailStatus).toBe("missing_key");
  });
});

describe("PUT /api/me/notification-preferences", () => {
  it("is 503 / 401 like the rest", async () => {
    auth.backendReady.mockReturnValue(false);
    expect((await put({ frequency: "weekly" })).status).toBe(503);
    auth.backendReady.mockReturnValue(true);
    auth.currentUser.mockResolvedValue(null);
    expect((await put({ frequency: "weekly" })).status).toBe(401);
  });

  it("saves a partial update on top of what is stored", async () => {
    const res = await put({ categories: { replies: "email" }, frequency: "weekly" });
    expect(res.status).toBe(200);
    const saved = store.savePrefs.mock.calls[0];
    expect(saved[0]).toBe(UID);
    expect(saved[1].categories.replies).toBe("email");
    expect(saved[1].categories.mentions).toBe("in_app"); // untouched
    expect(saved[1].frequency).toBe("weekly");
    expect((await res.json()).prefs.frequency).toBe("weekly");
    expect(store.discardPending).not.toHaveBeenCalled();
  });

  it("turning unsubscribe-all on also drops what was waiting", async () => {
    expect((await put({ unsubscribedAll: true })).status).toBe(200);
    expect(store.discardPending).toHaveBeenCalledWith(UID);
  });

  it("rejects anything invalid with 400 and writes nothing", async () => {
    for (const body of [{ frequency: "hourly" }, { categories: { newsletter: "email" } }, { timezone: "Mars/Olympus" }, { role: "admin" }, [], "not json"]) {
      expect((await put(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(store.savePrefs).not.toHaveBeenCalled();
  });
});

describe("POST /api/notifications/unsubscribe", () => {
  const post = (query: string, init: RequestInit = {}) =>
    unsubscribe(new Request(`http://x/api/notifications/unsubscribe${query}`, { method: "POST", ...init }));

  it("unsubscribes the person the signed link belongs to, with no sign-in", async () => {
    store.unsubscribeAll.mockResolvedValue(true);
    auth.currentUser.mockResolvedValue(null);
    const res = await post(`?t=${signUnsubscribeToken(UID)}`);
    expect(res.status).toBe(200);
    expect(store.unsubscribeAll).toHaveBeenCalledWith(UID);
  });

  it("accepts a mail client's one-click POST (form body, token in the address)", async () => {
    store.unsubscribeAll.mockResolvedValue(true);
    const res = await post(`?t=${signUnsubscribeToken(UID)}`, {
      headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click",
    });
    expect(res.status).toBe(200);
  });

  it("also takes the token in a JSON body", async () => {
    store.unsubscribeAll.mockResolvedValue(true);
    const res = await post("", { headers: { "content-type": "application/json" }, body: JSON.stringify({ token: signUnsubscribeToken(UID) }) });
    expect(res.status).toBe(200);
  });

  it("refuses a missing, forged or tampered link and changes nothing", async () => {
    const good = signUnsubscribeToken(UID)!;
    for (const q of ["", "?t=", "?t=garbage", `?t=${good.slice(0, -3)}abc`]) expect((await post(q)).status, q).toBe(400);
    expect(store.unsubscribeAll).not.toHaveBeenCalled();
  });

  it("is 404 for a valid link to an account that is gone, and 503 with no backend", async () => {
    store.unsubscribeAll.mockResolvedValue(false);
    expect((await post(`?t=${signUnsubscribeToken(UID)}`)).status).toBe(404);
    auth.backendReady.mockReturnValue(false);
    expect((await post(`?t=${signUnsubscribeToken(UID)}`)).status).toBe(503);
  });

  it("is POST-only: a scanner opening the link with GET cannot unsubscribe anyone", async () => {
    const mod = await import("@/app/api/notifications/unsubscribe/route");
    expect("GET" in mod).toBe(false);
  });
});

describe("GET /api/notifications/preview", () => {
  const get = (template: string) => preview(new Request(`http://x/api/notifications/preview?template=${template}`));

  it("renders every template as HTML with an unsubscribe link and a way back to the preferences", async () => {
    for (const t of PREVIEW_TEMPLATES) {
      const res = await get(t);
      expect(res.status, t).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
      const html = await res.text();
      expect(html, t).toContain("Unsubscribe from all email");
      expect(html, t).toContain("/dashboard/settings");
    }
  });

  it("the digest groups every category", async () => {
    const html = await (await get("digest")).text();
    for (const label of ["Hackathon deadlines", "New programs", "Weekly digest", "Mentions", "Replies"]) expect(html).toContain(label);
  });

  it("rejects an unknown template and reads nothing about any user", async () => {
    expect((await get("newsletter")).status).toBe(400);
    expect((await preview(new Request("http://x/api/notifications/preview"))).status).toBe(400);
    expect(auth.currentUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/notification-digest", () => {
  const SECRET = "cron-secret-long-enough-9999";
  const call = (authorization?: string) =>
    cron(new Request("http://x/api/cron/notification-digest", { headers: authorization ? { authorization } : {} }));

  it("is off without a CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer anything")).status).toBe(503);
    expect(digest.runDigests).not.toHaveBeenCalled();
  });

  it("is closed to a missing or wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401); // the Bearer scheme is required
    expect(digest.runDigests).not.toHaveBeenCalled();
  });

  it("runs one pass for the right secret and returns its counts", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    digest.runDigests.mockResolvedValue({ checked: 3, sent: 2, skipped: 1, failed: 0 });
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 3, sent: 2, skipped: 1, failed: 0 });
  });

  it("is 503 with no backend, even for the right secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    auth.backendReady.mockReturnValue(false);
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
    expect(digest.runDigests).not.toHaveBeenCalled();
  });
});
