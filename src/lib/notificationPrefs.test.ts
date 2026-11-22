/* notificationPrefs.test.ts - the rules behind the preferences panel (#196) */
import { describe, expect, it } from "vitest";
import {
  applyPrefsPatch, CATEGORIES, defaultPrefs, digestDue, digestSubject, groupByCategory, isPreviewTemplate,
  isTimezone, kindToCategory, latestSlot, localParts, normalizePrefs, routeNotification, SAMPLE_EVENTS, type Prefs,
} from "./notificationPrefs";

const at = (iso: string) => new Date(iso);
const prefs = (over: Partial<Prefs> = {}): Prefs => ({ ...defaultPrefs(), ...over });

describe("defaults and normalizing", () => {
  it("emails nobody until they ask: every default channel is in-app or off", () => {
    expect(Object.values(defaultPrefs().categories)).not.toContain("email");
    expect(defaultPrefs().unsubscribedAll).toBe(false);
  });

  it("repairs whatever a row holds: bad values fall back, good ones stay", () => {
    const got = normalizePrefs({
      categories: { deadlines: "email", mentions: "loud", bogus: "email" },
      frequency: "hourly", timezone: "Mars/Olympus", digestHour: 31, unsubscribedAll: "yes",
    });
    expect(got.categories.deadlines).toBe("email");
    expect(got.categories.mentions).toBe(defaultPrefs().categories.mentions);
    expect(got).not.toHaveProperty("categories.bogus");
    expect(got.frequency).toBe("daily");
    expect(got.timezone).toBe("UTC");
    expect(got.digestHour).toBe(8);
    expect(got.unsubscribedAll).toBe(false);
    expect(normalizePrefs(null)).toEqual(defaultPrefs());
    expect(normalizePrefs("junk")).toEqual(defaultPrefs());
  });

  it("knows a real timezone from a made-up one", () => {
    expect(isTimezone("Asia/Kolkata")).toBe(true);
    expect(isTimezone("UTC")).toBe(true);
    for (const bad of ["", "Mars/Olympus", 5, null, "x".repeat(80)]) expect(isTimezone(bad)).toBe(false);
  });
});

describe("applyPrefsPatch", () => {
  it("changes only the fields that were sent", () => {
    const r = applyPrefsPatch(defaultPrefs(), { categories: { replies: "email" }, frequency: "weekly" });
    expect(r.ok && r.prefs.categories.replies).toBe("email");
    expect(r.ok && r.prefs.categories.mentions).toBe("in_app");
    expect(r.ok && r.prefs.frequency).toBe("weekly");
    expect(r.ok && r.prefs.timezone).toBe("UTC");
  });

  it("does not mutate the prefs it was given", () => {
    const base = defaultPrefs();
    applyPrefsPatch(base, { categories: { replies: "email" } });
    expect(base.categories.replies).toBe("in_app");
  });

  it("rejects a typo instead of defaulting it", () => {
    const cases: [unknown, RegExp][] = [
      [{ categories: { newsletter: "email" } }, /unknown category/],
      [{ categories: { replies: "sms" } }, /email, in_app or off/],
      [{ categories: ["replies"] }, /categories must be an object/],
      [{ frequency: "hourly" }, /frequency/],
      [{ timezone: "Mars/Olympus" }, /timezone/],
      [{ digestHour: 24 }, /digestHour/],
      [{ digestHour: 7.5 }, /digestHour/],
      [{ unsubscribedAll: "yes" }, /unsubscribedAll/],
      [{ role: "admin" }, /unknown field/],
      [null, /JSON object/],
      [[], /JSON object/],
    ];
    for (const [body, error] of cases) {
      const r = applyPrefsPatch(defaultPrefs(), body);
      expect(r.ok, JSON.stringify(body)).toBe(false);
      expect(!r.ok && r.error).toMatch(error);
    }
  });
});

describe("routeNotification", () => {
  const withChannel = (channel: "email" | "in_app" | "off", over: Partial<Prefs> = {}) =>
    prefs({ ...over, categories: { ...defaultPrefs().categories, mentions: channel } });

  it("off goes nowhere and in-app stays in the bell", () => {
    expect(routeNotification(withChannel("off"), "mentions")).toBe("none");
    expect(routeNotification(withChannel("in_app"), "mentions")).toBe("in_app");
  });

  it("email follows the frequency: now, or held for a digest", () => {
    expect(routeNotification(withChannel("email", { frequency: "immediate" }), "mentions")).toBe("email_now");
    expect(routeNotification(withChannel("email", { frequency: "daily" }), "mentions")).toBe("email_digest");
    expect(routeNotification(withChannel("email", { frequency: "weekly" }), "mentions")).toBe("email_digest");
  });

  it("the one-click unsubscribe stops email but never the bell", () => {
    expect(routeNotification(withChannel("email", { unsubscribedAll: true }), "mentions")).toBe("none");
    expect(routeNotification(withChannel("in_app", { unsubscribedAll: true }), "mentions")).toBe("in_app");
  });

  it("maps the feed's kinds onto the categories a person controls", () => {
    expect(kindToCategory("hackathon")).toBe("deadlines");
    expect(kindToCategory("deadline")).toBe("deadlines");
    expect(kindToCategory("mention")).toBe("mentions");
    expect(kindToCategory("follower")).toBeNull();
    expect(kindToCategory("anything-else")).toBeNull();
  });
});

describe("digest timing in the person's own timezone", () => {
  const kolkata = prefs({ timezone: "Asia/Kolkata", digestHour: 8 }); // 08:00 IST = 02:30 UTC

  it("reads the wall clock of a zone, including a half-hour offset", () => {
    expect(localParts(at("2026-11-22T03:00:00Z"), "Asia/Kolkata")).toMatchObject({ day: 22, hour: 8, minute: 30 });
    expect(localParts(at("2026-11-22T20:00:00Z"), "Asia/Kolkata")).toMatchObject({ day: 23, hour: 1, minute: 30 });
  });

  it("finds the latest 8 o'clock local, whatever the offset", () => {
    expect(latestSlot(kolkata, at("2026-11-22T03:00:00Z")).toISOString()).toBe("2026-11-22T02:30:00.000Z");
    expect(latestSlot(kolkata, at("2026-11-22T02:00:00Z")).toISOString()).toBe("2026-11-21T02:30:00.000Z");
    expect(latestSlot(prefs({ timezone: "Asia/Kathmandu" }), at("2026-11-22T12:00:00Z")).toISOString()).toBe("2026-11-22T02:15:00.000Z");
    expect(latestSlot(prefs({ timezone: "America/Los_Angeles" }), at("2026-11-22T20:00:00Z")).toISOString()).toBe("2026-11-22T16:00:00.000Z");
  });

  it("is due once a slot has passed since the last digest, and not before", () => {
    const now = at("2026-11-22T03:00:00Z"); // 08:30 in Kolkata
    expect(digestDue(kolkata, now, at("2026-11-21T03:00:00Z"))).toBe(true); // last sent yesterday
    expect(digestDue(kolkata, now, at("2026-11-22T02:45:00Z"))).toBe(false); // already sent after today's slot
    expect(digestDue(kolkata, at("2026-11-22T02:00:00Z"), at("2026-11-21T03:00:00Z"))).toBe(false); // slot not reached
  });

  it("does not depend on how often the cron runs", () => {
    // a run four hours after the slot, or only once a day, still finds it owed
    expect(digestDue(kolkata, at("2026-11-22T06:30:00Z"), at("2026-11-21T03:00:00Z"))).toBe(true);
    expect(digestDue(kolkata, at("2026-11-23T01:00:00Z"), at("2026-11-21T03:00:00Z"))).toBe(true);
  });

  it("weekly digests go out on Monday", () => {
    const weekly = prefs({ timezone: "UTC", digestHour: 8, frequency: "weekly" });
    // 2026-11-22 is a Sunday, so the latest slot is Monday the 16th
    expect(latestSlot(weekly, at("2026-11-22T10:00:00Z")).toISOString()).toBe("2026-11-16T08:00:00.000Z");
    expect(digestDue(weekly, at("2026-11-22T10:00:00Z"), at("2026-11-16T09:00:00Z"))).toBe(false);
    expect(digestDue(weekly, at("2026-11-23T08:30:00Z"), at("2026-11-16T09:00:00Z"))).toBe(true); // Monday morning
  });

  it("stays at 8 o'clock local across a daylight-saving change", () => {
    const ny = prefs({ timezone: "America/New_York", digestHour: 8 });
    expect(latestSlot(ny, at("2026-03-07T20:00:00Z")).toISOString()).toBe("2026-03-07T13:00:00.000Z"); // EST, UTC-5
    expect(latestSlot(ny, at("2026-03-08T12:30:00Z")).toISOString()).toBe("2026-03-08T12:00:00.000Z"); // EDT, UTC-4
    expect(latestSlot(ny, at("2026-03-08T11:59:00Z")).toISOString()).toBe("2026-03-07T13:00:00.000Z");
  });

  it("does not throw for an hour the clock skips", () => {
    const ny = prefs({ timezone: "America/New_York", digestHour: 2 });
    expect(() => latestSlot(ny, at("2026-03-08T12:00:00Z"))).not.toThrow();
  });
});

describe("presenting a batch", () => {
  it("groups by category in panel order and drops empty ones", () => {
    const items = [
      { category: "replies" as const, n: 1 }, { category: "deadlines" as const, n: 2 }, { category: "replies" as const, n: 3 },
    ];
    expect(groupByCategory(items).map((g) => [g.category, g.items.map((i) => i.n)])).toEqual([["deadlines", [2]], ["replies", [1, 3]]]);
    expect(groupByCategory([])).toEqual([]);
  });

  it("words the subject by count and cadence", () => {
    expect(digestSubject(1, "daily")).toBe("1 update on cyrus.ai this day");
    expect(digestSubject(4, "weekly")).toBe("4 updates on cyrus.ai this week");
  });

  it("has a sample for every category and a preview for each template", () => {
    for (const c of CATEGORIES) expect(SAMPLE_EVENTS[c].title.length, c).toBeGreaterThan(0);
    for (const t of [...CATEGORIES, "digest"]) expect(isPreviewTemplate(t), t).toBe(true);
    expect(isPreviewTemplate("newsletter")).toBe(false);
  });
});
