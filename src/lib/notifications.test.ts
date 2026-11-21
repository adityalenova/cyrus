/* ══ notifications.test.ts — the feed's promises, no socket required ══
   The route and the bell both consume these helpers, so a green run here is
   what makes the live stream honest: order, de-dup, read accounting, SSE
   framing and the reconnect backoff are all decided by this pure layer. ═ */
import { describe, expect, it } from "vitest";
import {
  KIND_LABEL, NOTIF_KINDS, backoffDelay, dedupe, encodeSse, heartbeat, markAllRead,
  markRead, merge, normalize, normalizeAll, pollInterval, recent, sortNewest, unreadCount,
  type Notification,
} from "./notifications";

const n = (o: Partial<Notification> = {}): Notification => ({
  id: "1", kind: "hackathon", title: "t", body: "b", href: "/h", read: false,
  createdAt: "2026-11-17T00:00:00Z", ...o,
});

describe("normalize", () => {
  it("keeps a well-formed row", () => {
    expect(normalize(n({ id: "x" }))).toEqual(n({ id: "x" }));
  });
  it("drops a non-object, an unknown kind and a missing id", () => {
    expect(normalize(null)).toBeNull();
    expect(normalize("nope")).toBeNull();
    expect(normalize(n({ kind: "email" as never }))).toBeNull();
    expect(normalize({ ...n(), id: "" })).toBeNull();
  });
  it("coerces absent optional strings to empty and read to a boolean", () => {
    const out = normalize({ id: "a", kind: "deadline", createdAt: "2026-01-01T00:00:00Z" });
    expect(out).toEqual({ id: "a", kind: "deadline", title: "", body: "", href: "", read: false, createdAt: "2026-01-01T00:00:00Z" });
    expect(normalize({ ...n(), read: "yes" })?.read).toBe(false);
    expect(normalize({ ...n(), read: true })?.read).toBe(true);
  });
  it("normalizeAll drops junk, sorts newest first and de-dupes", () => {
    const rows = normalizeAll([n({ id: "a", createdAt: "2026-11-16T00:00:00Z" }), null, n({ id: "b", createdAt: "2026-11-18T00:00:00Z" }), n({ id: "a" })]);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("ordering and de-duplication", () => {
  it("sorts newest first, tie-broken by id", () => {
    const ordered = sortNewest([
      n({ id: "b", createdAt: "2026-11-17T00:00:00Z" }),
      n({ id: "a", createdAt: "2026-11-17T00:00:00Z" }),
      n({ id: "c", createdAt: "2026-11-18T00:00:00Z" }),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("first occurrence of an id wins", () => {
    const d = dedupe([n({ id: "x", title: "keep" }), n({ id: "x", title: "drop" })]);
    expect(d).toHaveLength(1);
    expect(d[0].title).toBe("keep");
  });
});

describe("read accounting", () => {
  it("counts only unread rows", () => {
    expect(unreadCount([n({ read: true }), n(), n()])).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
  it("markRead flips one row and leaves the rest, without mutating", () => {
    const rows = [n({ id: "1" }), n({ id: "2" })];
    const after = markRead(rows, "1");
    expect(after.find((r) => r.id === "1")?.read).toBe(true);
    expect(after.find((r) => r.id === "2")?.read).toBe(false);
    expect(rows[0].read).toBe(false);
  });
  it("markRead of an already-read id returns a new array without touching the row", () => {
    const rows = [n({ id: "1", read: true })];
    const after = markRead(rows, "1");
    expect(after).not.toBe(rows);
    expect(after[0]).toBe(rows[0]);
  });
  it("markAllRead clears the badge", () => {
    expect(unreadCount(markAllRead([n(), n(), n({ read: true })]))).toBe(0);
  });
});

describe("recent and merge", () => {
  it("caps to the freshest N", () => {
    const rows = [n({ id: "a", createdAt: "2026-11-15T00:00:00Z" }), n({ id: "b", createdAt: "2026-11-17T00:00:00Z" }), n({ id: "c", createdAt: "2026-11-16T00:00:00Z" })];
    expect(recent(rows, 2).map((r) => r.id)).toEqual(["b", "c"]);
    expect(recent(rows, 0)).toEqual([]);
    expect(recent(rows, -3)).toEqual([]);
  });
  it("keeps local reads when a live batch re-delivers the same id", () => {
    const existing = [n({ id: "1", read: true, createdAt: "2026-11-17T00:00:00Z" })];
    const incoming = [n({ id: "1", read: false, createdAt: "2026-11-17T00:00:00Z" }), n({ id: "2", createdAt: "2026-11-18T00:00:00Z" })];
    const out = merge(existing, incoming, 10);
    expect(out.map((r) => r.id)).toEqual(["2", "1"]);
    expect(out.find((r) => r.id === "1")?.read).toBe(true);
  });
});

describe("SSE framing", () => {
  it("writes an event line, data lines and a terminating blank line", () => {
    expect(encodeSse("notify", { id: "1" })).toBe('event: notify\ndata: {"id":"1"}\n\n');
  });
  it("prefixes every line of a multi-line payload", () => {
    expect(encodeSse("msg", "a\nb")).toBe("event: msg\ndata: a\ndata: b\n\n");
  });
  it("emits a heartbeat the client can ignore but a proxy can see", () => {
    expect(heartbeat().startsWith("event: ping\ndata: ")).toBe(true);
    expect(heartbeat().endsWith("\n\n")).toBe(true);
  });
});

describe("reconnection backoff", () => {
  it("doubles from the base for each attempt", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
    expect(backoffDelay(3)).toBe(8000);
  });
  it("clamps at the cap so an outage stops growing", () => {
    expect(backoffDelay(4, { cap: 5000 })).toBe(5000);
    expect(backoffDelay(50)).toBe(30_000);
  });
  it("treats a negative attempt as zero", () => {
    expect(backoffDelay(-5)).toBe(1000);
  });
  it("widens the poll fallback after misses and caps it", () => {
    expect(pollInterval(0)).toBe(15_000);
    expect(pollInterval(1)).toBe(20_000);
    expect(pollInterval(100)).toBe(120_000);
  });
});

describe("kinds", () => {
  it("labels each of the four feed types", () => {
    expect(NOTIF_KINDS).toEqual(["hackathon", "deadline", "follower", "mention"]);
    for (const k of NOTIF_KINDS) expect(KIND_LABEL[k]).toBeTruthy();
  });
});
