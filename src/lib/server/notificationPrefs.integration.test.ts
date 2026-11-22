/* notificationPrefs.integration.test.ts - preferences, outbox, digest run and
   delivery against a real (in-memory) Postgres running the real migration.
   Only the call out to Resend is faked, so the SQL, the claim-before-send rule
   and the rendered email are all exercised for real. (#196) */
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import * as schema from "../db/schema";
import { defaultPrefs } from "../notificationPrefs";
import { deliverNotification } from "./notificationDelivery";
import { runDigests } from "./notificationDigest";
import {
  claim, getPrefs, getStoredPrefs, pendingFor, release, savePrefs, unsubscribeAll, usersWithPending,
} from "./notificationPrefs";

const state = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("../db", () => ({ getDb: () => state.db }));

let client: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
let ada: string;
let bo: string;

beforeAll(async () => {
  client = new PGlite();
  await client.waitReady;
  // users (0000) and the bell's notifications table (0002), then the two tables under test (0005)
  for (const file of ["0000_volatile_forge.sql", "0002_mysterious_hawkeye.sql", "0005_notification_preferences.sql"]) {
    await client.exec(await readFile(new URL(`../../../drizzle/${file}`, import.meta.url), "utf8"));
  }
  database = drizzle(client, { schema });
  state.db = database as unknown as Db;
});
afterAll(async () => { state.db = null; await client?.close(); });

const fetchMock = vi.fn();
beforeEach(async () => {
  await client.exec('TRUNCATE "users" CASCADE');
  const rows = await database.insert(schema.users).values([
    { provider: "email", providerId: "ada", name: "Ada", email: "ada@example.test" },
    { provider: "github", providerId: "bo", name: "Bo", email: null },
  ]).returning();
  ada = rows[0].id;
  bo = rows[1].id;
  vi.stubEnv("SESSION_SECRET", "a-secret-that-is-long-enough-1234");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "cyrus.ai <hello@example.test>");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "mail_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const emailDaily = () => ({
  ...defaultPrefs(), timezone: "UTC", digestHour: 8, frequency: "daily" as const,
  categories: { ...defaultPrefs().categories, mentions: "email" as const, deadlines: "email" as const },
});
const queue = (userId: string, createdAt: string, title = "A mention") =>
  database.insert(schema.notificationOutbox).values({ userId, category: "mentions", title, body: "details", href: "/dashboard/issues", createdAt: new Date(createdAt) });
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

describe("preferences storage", () => {
  it("gives a person with no row the defaults, and writes nothing until they change something", async () => {
    expect((await getStoredPrefs(ada)).prefs).toEqual(defaultPrefs());
    expect(await database.select().from(schema.notificationPreferences)).toHaveLength(0);
  });

  it("saves, then updates the same row", async () => {
    await savePrefs(ada, emailDaily());
    await savePrefs(ada, { ...emailDaily(), frequency: "weekly", timezone: "Asia/Kolkata" });
    const got = await getPrefs(ada);
    expect(got.frequency).toBe("weekly");
    expect(got.timezone).toBe("Asia/Kolkata");
    expect(got.categories.mentions).toBe("email");
    expect(await database.select().from(schema.notificationPreferences)).toHaveLength(1);
  });

  it("deletes a person's preferences and waiting email with their account", async () => {
    await savePrefs(ada, emailDaily());
    await queue(ada, "2026-11-21T09:00:00Z");
    await database.delete(schema.users).where(eq(schema.users.id, ada));
    expect(await database.select().from(schema.notificationPreferences)).toHaveLength(0);
    expect(await database.select().from(schema.notificationOutbox)).toHaveLength(0);
  });
});

describe("unsubscribeAll", () => {
  it("says no for an id that is not an account", async () => {
    expect(await unsubscribeAll("11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("switches email off, keeps the other choices, and drops what was waiting", async () => {
    await savePrefs(ada, emailDaily());
    await queue(ada, "2026-11-21T09:00:00Z");
    expect(await unsubscribeAll(ada)).toBe(true);
    const got = await getPrefs(ada);
    expect(got.unsubscribedAll).toBe(true);
    expect(got.categories.mentions).toBe("email");
    expect(await pendingFor(ada)).toHaveLength(0);
  });

  it("works for someone who never opened the panel (no row yet)", async () => {
    expect(await unsubscribeAll(bo)).toBe(true);
    expect((await getPrefs(bo)).unsubscribedAll).toBe(true);
  });
});

describe("the outbox", () => {
  it("lets exactly one caller claim a row, and gives it back on release", async () => {
    await queue(ada, "2026-11-21T09:00:00Z");
    const ids = (await pendingFor(ada)).map((r) => r.id);
    expect(await claim(ada, ids, new Date())).toHaveLength(1);
    expect(await claim(ada, ids, new Date())).toHaveLength(0); // an overlapping run gets nothing
    expect(await pendingFor(ada)).toHaveLength(0);
    await release(ids);
    expect(await pendingFor(ada)).toHaveLength(1);
  });

  it("lists who has something waiting, once each", async () => {
    await queue(ada, "2026-11-21T09:00:00Z");
    await queue(ada, "2026-11-21T10:00:00Z");
    await queue(bo, "2026-11-21T11:00:00Z");
    expect((await usersWithPending()).sort()).toEqual([ada, bo].sort());
  });
});

describe("runDigests", () => {
  const OWED = new Date("2026-11-22T09:00:00Z"); // after 08:00 UTC the next day

  it("sends one digest with every waiting item, then does not send it again", async () => {
    await savePrefs(ada, emailDaily());
    await queue(ada, "2026-11-21T09:00:00Z", "First mention");
    await queue(ada, "2026-11-21T10:00:00Z", "Second mention");

    expect(await runDigests(OWED)).toEqual({ checked: 1, sent: 1, skipped: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const mail = sent();
    expect(mail.to).toEqual(["ada@example.test"]);
    expect(mail.subject).toBe("2 updates on cyrus.ai this day");
    expect(mail.html).toContain("First mention");
    expect(mail.html).toContain("Second mention");
    expect(mail.html).toContain("/unsubscribe?t="); // the link in the footer
    expect(mail.text).toContain("Second mention");
    expect(mail.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/.+\/api\/notifications\/unsubscribe\?t=.+>$/);
    expect(mail.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    expect(await pendingFor(ada)).toHaveLength(0);
    expect((await getStoredPrefs(ada)).lastDigestAt?.toISOString()).toBe(OWED.toISOString());
    expect(await runDigests(OWED)).toEqual({ checked: 0, sent: 0, skipped: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits for the person's own morning: a slot that has not come yet sends nothing", async () => {
    await savePrefs(ada, { ...emailDaily(), timezone: "Asia/Kolkata", digestHour: 8 }); // 08:00 IST = 02:30 UTC
    await queue(ada, "2026-11-21T09:00:00Z");
    expect((await runDigests(new Date("2026-11-22T02:00:00Z"))).sent).toBe(0); // 07:30 in Kolkata
    expect(await pendingFor(ada)).toHaveLength(1);
    expect((await runDigests(new Date("2026-11-22T03:00:00Z"))).sent).toBe(1); // 08:30 in Kolkata
  });

  it("puts the rows back when Resend refuses, so the next run tries again", async () => {
    await savePrefs(ada, emailDaily());
    await queue(ada, "2026-11-21T09:00:00Z");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", message: "bad" }), { status: 422 }));
    expect(await runDigests(OWED)).toMatchObject({ sent: 0, failed: 1 });
    expect(await pendingFor(ada)).toHaveLength(1);
    expect((await getStoredPrefs(ada)).lastDigestAt).toBeNull();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await runDigests(OWED)).toMatchObject({ sent: 1, failed: 0 });
  });

  it("keeps the rows and does not pretend to send when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await savePrefs(ada, emailDaily());
    await queue(ada, "2026-11-21T09:00:00Z");
    expect(await runDigests(OWED)).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingFor(ada)).toHaveLength(1);
  });

  it("sends nothing without a signed unsubscribe link or an address", async () => {
    await savePrefs(ada, emailDaily());
    await queue(ada, "2026-11-21T09:00:00Z");
    vi.stubEnv("SESSION_SECRET", "");
    expect((await runDigests(OWED)).sent).toBe(0);
    vi.stubEnv("SESSION_SECRET", "a-secret-that-is-long-enough-1234");
    await savePrefs(bo, emailDaily());
    await queue(bo, "2026-11-21T09:00:00Z");
    const run = await runDigests(OWED); // bo has no email address; ada is sent
    expect(run).toMatchObject({ sent: 1, skipped: 1 });
    expect(await pendingFor(bo)).toHaveLength(1);
  });

  it("drops the queue of someone who has unsubscribed from everything", async () => {
    await savePrefs(ada, { ...emailDaily(), unsubscribedAll: true });
    await queue(ada, "2026-11-21T09:00:00Z");
    expect(await runDigests(OWED)).toMatchObject({ sent: 0, skipped: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingFor(ada)).toHaveLength(0);
  });
});

describe("deliverNotification", () => {
  const event = { title: "A maintainer mentioned you", body: "On issue 42", href: "/dashboard/issues" };
  const withMentions = (channel: "email" | "in_app" | "off", over = {}) =>
    savePrefs(ada, { ...defaultPrefs(), ...over, categories: { ...defaultPrefs().categories, mentions: channel } });

  it("off: nothing is stored and nothing is sent", async () => {
    await withMentions("off");
    expect(await deliverNotification(ada, "mentions", event)).toEqual({ route: "none", delivered: false });
    expect(await database.select().from(schema.notifications)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("in-app: a row for the bell, no email", async () => {
    await withMentions("in_app");
    expect(await deliverNotification(ada, "mentions", event)).toMatchObject({ route: "in_app", delivered: true });
    const rows = await database.select().from(schema.notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("mention");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("in-app for a category the bell has no kind for says so instead of storing junk", async () => {
    const got = await deliverNotification(ada, "replies", event);
    expect(got).toMatchObject({ route: "in_app", delivered: false });
    expect(got.reason).toMatch(/no kind/);
    expect(await database.select().from(schema.notifications)).toHaveLength(0);
  });

  it("email, immediately: one message now with the unsubscribe link, nothing queued", async () => {
    await withMentions("email", { frequency: "immediate" });
    expect(await deliverNotification(ada, "mentions", event)).toMatchObject({ route: "email_now", delivered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().subject).toBe("A maintainer mentioned you");
    expect(sent().html).toContain("/unsubscribe?t=");
    expect(await pendingFor(ada)).toHaveLength(0);
  });

  it("email, digest: queued for later, nothing sent yet", async () => {
    await withMentions("email", { frequency: "daily" });
    expect(await deliverNotification(ada, "mentions", event)).toMatchObject({ route: "email_digest", delivered: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingFor(ada)).toHaveLength(1);
  });

  it("email after the one-click unsubscribe: dropped", async () => {
    await withMentions("email", { frequency: "immediate", unsubscribedAll: true });
    expect(await deliverNotification(ada, "mentions", event)).toEqual({ route: "none", delivered: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("email to an account with no address says why it was not sent", async () => {
    await savePrefs(bo, { ...defaultPrefs(), frequency: "immediate", categories: { ...defaultPrefs().categories, mentions: "email" } });
    const got = await deliverNotification(bo, "mentions", event);
    expect(got).toMatchObject({ route: "email_now", delivered: false });
    expect(got.reason).toMatch(/no email address/);
  });

  it("a title cannot inject markup into the email", async () => {
    await withMentions("email", { frequency: "immediate" });
    await deliverNotification(ada, "mentions", { ...event, title: '<img src=x onerror="alert(1)">', href: "javascript:alert(1)" });
    expect(sent().html).not.toContain("<img src=x");
    expect(sent().html).not.toContain("javascript:");
  });
});
