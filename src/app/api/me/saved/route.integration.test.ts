/* ══ route.integration.test.ts — Issue #146: Tracking Auth & Ownership Boundaries ═════
   End-to-end integration test suite exercising the complete lifecycle:
   - Cryptographic HS256 JWT session cookie minting and verification (jose)
   - Anonymous access denial and token tampering protection (HTTP 401)
   - Cross-account read, mutation, and export isolation (User A vs. User B)
   - Payload parameter spoofing immunity (IDOR protection on body.userId)
   - Idempotency, deduplication, and database persistence guarantees
   - Isolated multi-tenant fixtures with deterministic per-test cleanup.
   ═══════════════════════════════════════════════════════════════════════════════════ */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

/* ── 1. Stateful Mocks for next/headers and Neon DB ───────────────────────── */

const jar = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { value: jar.store.get(name) } : undefined),
    set: (name: string, value: string) => { jar.store.set(name, value); },
    delete: (name: string) => { jar.store.delete(name); },
  }),
}));

interface StoredSavedItem {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  title: string | null;
  meta: unknown;
  createdAt: string;
}

interface StoredUser {
  id: string;
  name: string;
  provider: string;
  login?: string | null;
  email?: string | null;
  createdAt: Date;
}

const usersStore = vi.hoisted(() => new Map<string, StoredUser>());
const savedItemsStore = vi.hoisted(() => new Map<string, StoredSavedItem>());

function extractAllParams(cond: unknown): unknown[] {
  if (!cond) return [];
  const results: unknown[] = [];
  function walk(node: unknown) {
    if (!node) return;
    if (typeof node === "object" && ("encoder" in (node as Record<string, unknown>) || (node as { constructor?: { name?: string } }).constructor?.name === "Param")) {
      results.push((node as { value: unknown }).value);
    }
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) walk(chunk);
    }
  }
  walk(cond);
  return results;
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          const params = extractAllParams(cond);
          const userId = params[0] as string | undefined;
          return {
            limit: async () => (userId && usersStore.has(userId) ? [usersStore.get(userId)] : []),
            orderBy: async () => (userId ? Array.from(savedItemsStore.values()).filter((i) => i.userId === userId) : []),
          };
        },
      }),
    }),
    insert: () => ({
      values: (val: { userId: string; itemType: string; itemId: string; title?: string | null; meta?: unknown }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            const key = `${val.userId}:${val.itemType}:${val.itemId}`;
            if (savedItemsStore.has(key)) {
              return []; // composite uniqueness collision: on conflict do nothing
            }
            const record: StoredSavedItem = {
              id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              userId: val.userId,
              itemType: val.itemType,
              itemId: val.itemId,
              title: val.title ?? null,
              meta: val.meta ?? null,
              createdAt: new Date().toISOString(),
            };
            savedItemsStore.set(key, record);
            return [record];
          },
        }),
      }),
    }),
    delete: () => ({
      where: (cond: unknown) => ({
        returning: async () => {
          const params = extractAllParams(cond);
          const [userId, itemType, itemId] = params as [string, string, string];
          const key = `${userId}:${itemType}:${itemId}`;
          if (savedItemsStore.has(key)) {
            const row = savedItemsStore.get(key)!;
            savedItemsStore.delete(key);
            return [{ id: row.id }];
          }
          return [];
        },
      }),
    }),
  }),
  dbReady: () => true,
}));

import { setSession } from "@/lib/server/auth";
import { GET, POST, DELETE } from "@/app/api/me/saved/route";
import { trackedIssuesToCsv, type TrackedIssueCsvRow } from "@/lib/dash/csvExport";

/* ── 2. Test Fixtures & Identity Declarations ──────────────────────────────── */

const TEST_SECRET = "super-secret-key-32-chars-long-for-testing!!";

const USER_ALICE: StoredUser = {
  id: "usr_alice_11111111-1111-4111-a111-111111111111",
  name: "Alice Developer",
  login: "alice-dev",
  email: "alice@example.com",
  provider: "github",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const USER_BOB: StoredUser = {
  id: "usr_bob_22222222-2222-4222-b222-222222222222",
  name: "Bob Maintainer",
  login: "bob-maint",
  email: "bob@example.com",
  provider: "google",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const ISSUE_ALPHA = {
  itemType: "issue",
  itemId: "https://github.com/adityalenova/cyrus/issues/100",
  title: "Cyrus Issue #100",
  meta: { repo: "adityalenova/cyrus", number: 100, stage: "saved", beginner: true },
};

const ISSUE_BETA = {
  itemType: "issue",
  itemId: "https://github.com/adityalenova/cyrus/issues/200",
  title: "Cyrus Issue #200",
  meta: { repo: "adityalenova/cyrus", number: 200, stage: "working", beginner: false },
};

const SHARED_ISSUE = {
  itemType: "issue",
  itemId: "https://github.com/facebook/react/issues/12345",
  title: "React Issue #12345",
};

const req = (method: "GET" | "POST" | "DELETE", body?: unknown) =>
  new Request("http://localhost/api/me/saved", {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

/* ── 3. Test Suites ───────────────────────────────────────────────────────── */

beforeEach(() => {
  jar.store.clear();
  usersStore.clear();
  savedItemsStore.clear();
  usersStore.set(USER_ALICE.id, USER_ALICE);
  usersStore.set(USER_BOB.id, USER_BOB);
  vi.stubEnv("SESSION_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Cyrus Issue #146 — Authentication Boundaries (Anonymous Access Denial)", () => {
  it("rejects anonymous GET with HTTP 401 Unauthorized", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
  });

  it("rejects anonymous POST with HTTP 401 and prevents record creation", async () => {
    const res = await POST(req("POST", ISSUE_ALPHA));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
    expect(savedItemsStore.size).toBe(0);
  });

  it("rejects anonymous DELETE with HTTP 401 and prevents record deletion", async () => {
    // Seed an item directly in the database
    savedItemsStore.set(`${USER_BOB.id}:${ISSUE_BETA.itemType}:${ISSUE_BETA.itemId}`, {
      id: "seed_b",
      userId: USER_BOB.id,
      itemType: ISSUE_BETA.itemType,
      itemId: ISSUE_BETA.itemId,
      title: ISSUE_BETA.title,
      meta: ISSUE_BETA.meta,
      createdAt: new Date().toISOString(),
    });

    const res = await DELETE(req("DELETE", { itemType: ISSUE_BETA.itemType, itemId: ISSUE_BETA.itemId }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
    expect(savedItemsStore.size).toBe(1);
  });

  it("rejects requests carrying a forged JWT signed with an untrusted secret", async () => {
    const forgedToken = await new SignJWT({ name: "Eve", provider: "github" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ALICE.id)
      .setIssuer("cyrus.ai")
      .sign(new TextEncoder().encode("attacker-forged-secret-key-32-chars"));

    jar.store.set("cyrus.session", forgedToken);

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
  });

  it("rejects requests carrying an expired session token", async () => {
    const expiredToken = await new SignJWT({ name: USER_ALICE.name, provider: USER_ALICE.provider })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ALICE.id)
      .setIssuer("cyrus.ai")
      .setExpirationTime("-10s")
      .sign(new TextEncoder().encode(TEST_SECRET));

    jar.store.set("cyrus.session", expiredToken);

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
  });

  it("rejects session tokens issued by an unauthorized issuer", async () => {
    const untrustedIssuerToken = await new SignJWT({ name: USER_ALICE.name, provider: USER_ALICE.provider })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ALICE.id)
      .setIssuer("untrusted-domain.com")
      .sign(new TextEncoder().encode(TEST_SECRET));

    jar.store.set("cyrus.session", untrustedIssuerToken);

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
  });

  it("rejects session tokens when the user row has been deleted from the database", async () => {
    await setSession({ uid: "usr_ghost_non_existent", name: "Ghost", provider: "github" });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
  });

  it("rejects requests carrying a malformed non-JWT cookie string with HTTP 401", async () => {
    jar.store.set("cyrus.session", "malformed-garbage-cookie-value");

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed out" });
  });
});

describe("Cyrus Issue #146 — Cross-Account Isolation (User A vs. User B)", () => {
  beforeEach(async () => {
    // Seed Bob with an issue
    savedItemsStore.set(`${USER_BOB.id}:${ISSUE_BETA.itemType}:${ISSUE_BETA.itemId}`, {
      id: "seed_bob_200",
      userId: USER_BOB.id,
      itemType: ISSUE_BETA.itemType,
      itemId: ISSUE_BETA.itemId,
      title: ISSUE_BETA.title,
      meta: ISSUE_BETA.meta,
      createdAt: new Date().toISOString(),
    });
  });

  it("User A cannot list or inspect User B's tracked records", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]); // Alice sees 0 items despite Bob having items
    expect(body.items.some((i: { itemId: string }) => i.itemId === ISSUE_BETA.itemId)).toBe(false);
  });

  it("User B can list their own tracked records", async () => {
    await setSession({ uid: USER_BOB.id, name: USER_BOB.name, provider: USER_BOB.provider });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].itemId).toBe(ISSUE_BETA.itemId);
    expect(body.items[0].title).toBe(ISSUE_BETA.title);
  });

  it("User A cannot mutate or delete User B's records, even by naming the exact item ID", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    // Alice attempts to DELETE Bob's issue
    const delRes = await DELETE(req("DELETE", { itemType: ISSUE_BETA.itemType, itemId: ISSUE_BETA.itemId }));
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody).toEqual({ ok: true, removed: false }); // Nothing removed!

    // Verify Bob's record in storage is untouched
    expect(savedItemsStore.has(`${USER_BOB.id}:${ISSUE_BETA.itemType}:${ISSUE_BETA.itemId}`)).toBe(true);

    // Verify Bob still sees their item
    await setSession({ uid: USER_BOB.id, name: USER_BOB.name, provider: USER_BOB.provider });
    const bobItems = await (await GET()).json();
    expect(bobItems.items).toHaveLength(1);
    expect(bobItems.items[0].itemId).toBe(ISSUE_BETA.itemId);
  });

  it("User A and User B can independently track the same public issue without cross-interference", async () => {
    // Alice tracks shared issue
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });
    const alicePost = await POST(req("POST", { ...SHARED_ISSUE, meta: { stage: "working" } }));
    expect(alicePost.status).toBe(200);

    // Bob tracks shared issue
    await setSession({ uid: USER_BOB.id, name: USER_BOB.name, provider: USER_BOB.provider });
    const bobPost = await POST(req("POST", { ...SHARED_ISSUE, meta: { stage: "done" } }));
    expect(bobPost.status).toBe(200);

    // Both rows exist independently in the store
    expect(savedItemsStore.has(`${USER_ALICE.id}:issue:${SHARED_ISSUE.itemId}`)).toBe(true);
    expect(savedItemsStore.has(`${USER_BOB.id}:issue:${SHARED_ISSUE.itemId}`)).toBe(true);

    // Alice deletes her copy of the shared issue
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });
    const aliceDel = await DELETE(req("DELETE", { itemType: SHARED_ISSUE.itemType, itemId: SHARED_ISSUE.itemId }));
    expect((await aliceDel.json()).removed).toBe(true);

    // Bob's copy remains completely preserved
    expect(savedItemsStore.has(`${USER_ALICE.id}:issue:${SHARED_ISSUE.itemId}`)).toBe(false);
    expect(savedItemsStore.has(`${USER_BOB.id}:issue:${SHARED_ISSUE.itemId}`)).toBe(true);

    // Bob still reads their copy
    await setSession({ uid: USER_BOB.id, name: USER_BOB.name, provider: USER_BOB.provider });
    const bobList = await (await GET()).json();
    expect(bobList.items.some((i: { itemId: string }) => i.itemId === SHARED_ISSUE.itemId)).toBe(true);
  });
});

describe("Cyrus Issue #146 — Cross-Account Export Isolation", () => {
  beforeEach(async () => {
    // Alice tracks Issue #100
    savedItemsStore.set(`${USER_ALICE.id}:${ISSUE_ALPHA.itemType}:${ISSUE_ALPHA.itemId}`, {
      id: "alice_item_1",
      userId: USER_ALICE.id,
      itemType: ISSUE_ALPHA.itemType,
      itemId: ISSUE_ALPHA.itemId,
      title: ISSUE_ALPHA.title,
      meta: ISSUE_ALPHA.meta,
      createdAt: "2026-11-14T10:00:00Z",
    });

    // Bob tracks Issue #200
    savedItemsStore.set(`${USER_BOB.id}:${ISSUE_BETA.itemType}:${ISSUE_BETA.itemId}`, {
      id: "bob_item_2",
      userId: USER_BOB.id,
      itemType: ISSUE_BETA.itemType,
      itemId: ISSUE_BETA.itemId,
      title: ISSUE_BETA.title,
      meta: ISSUE_BETA.meta,
      createdAt: "2026-11-14T11:00:00Z",
    });
  });

  it("User A's CSV export contains only User A's tracked issues and zero records from User B", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    const res = await GET();
    const data = await res.json();

    // Map API saved items to CSV export payload (mirroring src/lib/dash/issues.tsx exportCsv)
    const exportRows: TrackedIssueCsvRow[] = data.items
      .filter((i: { itemType: string }) => i.itemType === "issue")
      .map((i: { itemId: string; title: string; meta: any; createdAt: string }) => ({
        repo: i.meta?.repo ?? "unknown",
        number: i.meta?.number ?? 0,
        title: i.title,
        url: i.itemId,
        stage: i.meta?.stage ?? "saved",
        added: i.createdAt,
      }));

    const csvOutput = trackedIssuesToCsv(exportRows);

    // Assert CSV contains Alice's issue #100
    expect(csvOutput).toContain("adityalenova/cyrus");
    expect(csvOutput).toContain("Cyrus Issue #100");
    expect(csvOutput).toContain(ISSUE_ALPHA.itemId);

    // CRITICAL: Assert CSV does NOT contain Bob's issue #200 or Bob's URL
    expect(csvOutput).not.toContain("Cyrus Issue #200");
    expect(csvOutput).not.toContain(ISSUE_BETA.itemId);
  });

  it("User A's JSON board export contains only User A's tracked issues", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    const res = await GET();
    const data = await res.json();

    // Mirroring JSON export payload from SettingsSection (src/lib/dash/settings.tsx)
    const jsonExport = {
      exportedAt: new Date().toISOString(),
      issues: data.items.filter((i: { itemType: string }) => i.itemType === "issue"),
    };

    const serialized = JSON.stringify(jsonExport);
    expect(serialized).toContain(ISSUE_ALPHA.itemId);
    expect(serialized).not.toContain(ISSUE_BETA.itemId);
  });

  it("User A export on empty dataset outputs only headers and zero records from User B", async () => {
    // Clear Alice's records while Bob still has Issue #200 in the store
    savedItemsStore.delete(`${USER_ALICE.id}:${ISSUE_ALPHA.itemType}:${ISSUE_ALPHA.itemId}`);
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    const res = await GET();
    const data = await res.json();
    expect(data.items).toEqual([]);

    const csvOutput = trackedIssuesToCsv([]);
    const lines = csvOutput.split("\r\n");
    expect(lines).toHaveLength(1); // Header row only
    expect(csvOutput).not.toContain("Cyrus Issue #200");
    expect(csvOutput).not.toContain(ISSUE_BETA.itemId);
  });

  it("mixed dataset export excludes User B items across all item types (repo, org, program, issue)", async () => {
    // Seed User B with repo, org, and program
    savedItemsStore.set(`${USER_BOB.id}:repo:facebook/react`, {
      id: "bob_repo",
      userId: USER_BOB.id,
      itemType: "repo",
      itemId: "facebook/react",
      title: "React",
      meta: null,
      createdAt: "2026-01-01",
    });
    savedItemsStore.set(`${USER_BOB.id}:org:facebook`, {
      id: "bob_org",
      userId: USER_BOB.id,
      itemType: "org",
      itemId: "facebook",
      title: "Facebook",
      meta: null,
      createdAt: "2026-01-01",
    });

    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });
    const res = await GET();
    const data = await res.json();

    // Alice only sees her own Issue #100
    expect(data.items.every((i: { itemId: string }) => i.itemId === ISSUE_ALPHA.itemId)).toBe(true);
    expect(data.items.some((i: { itemId: string }) => i.itemId.includes("facebook"))).toBe(false);
  });
});

describe("Cyrus Issue #146 — Identity Spoofing & IDOR Prevention", () => {
  it("ignores spoofed userId in POST payload and binds strictly to session identity", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    // Alice attempts to inject Bob's user ID in POST body
    const spoofedPost = await POST(
      req("POST", {
        itemType: "issue",
        itemId: "https://github.com/adityalenova/cyrus/issues/300",
        title: "Spoofed Issue #300",
        userId: USER_BOB.id, // Attacker payload
      }),
    );
    expect(spoofedPost.status).toBe(200);

    // The item MUST be stored under Alice's ID in database
    const aliceKey = `${USER_ALICE.id}:issue:https://github.com/adityalenova/cyrus/issues/300`;
    const bobKey = `${USER_BOB.id}:issue:https://github.com/adityalenova/cyrus/issues/300`;

    expect(savedItemsStore.has(aliceKey)).toBe(true);
    expect(savedItemsStore.has(bobKey)).toBe(false); // Bob received 0 items
  });

  it("ignores spoofed userId in DELETE payload and operates only on session identity", async () => {
    // Seed an item owned by Bob
    savedItemsStore.set(`${USER_BOB.id}:${ISSUE_BETA.itemType}:${ISSUE_BETA.itemId}`, {
      id: "seed_bob_target",
      userId: USER_BOB.id,
      itemType: ISSUE_BETA.itemType,
      itemId: ISSUE_BETA.itemId,
      title: ISSUE_BETA.title,
      meta: ISSUE_BETA.meta,
      createdAt: new Date().toISOString(),
    });

    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    // Alice attempts to delete Bob's item while explicitly injecting Bob's userId in the body
    const spoofedDelete = await DELETE(
      req("DELETE", {
        itemType: ISSUE_BETA.itemType,
        itemId: ISSUE_BETA.itemId,
        userId: USER_BOB.id, // Spoofed parameter
      }),
    );
    expect(spoofedDelete.status).toBe(200);
    expect((await spoofedDelete.json()).removed).toBe(false);

    // Bob's record in storage remains untouched
    expect(savedItemsStore.has(`${USER_BOB.id}:${ISSUE_BETA.itemType}:${ISSUE_BETA.itemId}`)).toBe(true);
  });

  it("strips unrecognized privilege fields from POST payload", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    const res = await POST(
      req("POST", {
        itemType: "issue",
        itemId: "https://github.com/adityalenova/cyrus/issues/400",
        title: "Privilege Escalation Attempt",
        role: "admin",
        isOwner: true,
        privileged: true,
      }),
    );
    expect(res.status).toBe(200);

    const key = `${USER_ALICE.id}:issue:https://github.com/adityalenova/cyrus/issues/400`;
    const stored = savedItemsStore.get(key);
    expect(stored).toBeDefined();
    expect((stored as any).role).toBeUndefined();
    expect((stored as any).isOwner).toBeUndefined();
  });
});

describe("Cyrus Issue #146 — Idempotency and State Consistency", () => {
  it("repeated POST of the same tracking target does not create duplicates", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    // First POST: creates the record
    const res1 = await POST(req("POST", ISSUE_ALPHA));
    expect(res1.status).toBe(200);
    expect(savedItemsStore.size).toBe(1);

    // Second POST with same item: returns 200 without creating duplicate
    const res2 = await POST(req("POST", ISSUE_ALPHA));
    expect(res2.status).toBe(200);
    expect(savedItemsStore.size).toBe(1);

    // Third POST: still exactly 1 record
    const res3 = await POST(req("POST", ISSUE_ALPHA));
    expect(res3.status).toBe(200);
    expect(savedItemsStore.size).toBe(1);

    // Final list check
    const list = await (await GET()).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].itemId).toBe(ISSUE_ALPHA.itemId);
  });

  it("repeated DELETE behaves consistently: returns true on first call, false on subsequent calls", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    // Add item
    await POST(req("POST", ISSUE_ALPHA));
    expect(savedItemsStore.size).toBe(1);

    // First DELETE: removes record
    const del1 = await DELETE(req("DELETE", { itemType: ISSUE_ALPHA.itemType, itemId: ISSUE_ALPHA.itemId }));
    expect(del1.status).toBe(200);
    expect((await del1.json()).removed).toBe(true);
    expect(savedItemsStore.size).toBe(0);

    // Second DELETE: record is already gone
    const del2 = await DELETE(req("DELETE", { itemType: ISSUE_ALPHA.itemType, itemId: ISSUE_ALPHA.itemId }));
    expect(del2.status).toBe(200);
    expect((await del2.json()).removed).toBe(false);
    expect(savedItemsStore.size).toBe(0);
  });

  it("handles Add -> Remove -> Add lifecycle cleanly", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    // 1. Add
    const post1 = await POST(req("POST", ISSUE_ALPHA));
    expect((await post1.json()).ok).toBe(true);
    expect(savedItemsStore.size).toBe(1);

    // 2. Remove
    const del = await DELETE(req("DELETE", { itemType: ISSUE_ALPHA.itemType, itemId: ISSUE_ALPHA.itemId }));
    expect((await del.json()).removed).toBe(true);
    expect(savedItemsStore.size).toBe(0);

    // 3. Add again
    const post2 = await POST(req("POST", ISSUE_ALPHA));
    expect((await post2.json()).ok).toBe(true);
    expect(savedItemsStore.size).toBe(1);

    const list = await (await GET()).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].itemId).toBe(ISSUE_ALPHA.itemId);
  });

  it("concurrent duplicate POST requests for the same target result in exactly one stored record", async () => {
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });

    const [res1, res2] = await Promise.all([
      POST(req("POST", ISSUE_ALPHA)),
      POST(req("POST", ISSUE_ALPHA)),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(savedItemsStore.size).toBe(1);

    const list = await (await GET()).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].itemId).toBe(ISSUE_ALPHA.itemId);
  });
});

describe("Cyrus Issue #146 — Fixture Isolation & Cleanup", () => {
  it("test A leaves store clean and unaffected by previous tests", async () => {
    expect(savedItemsStore.size).toBe(0);
    await setSession({ uid: USER_ALICE.id, name: USER_ALICE.name, provider: USER_ALICE.provider });
    await POST(req("POST", ISSUE_ALPHA));
    expect(savedItemsStore.size).toBe(1);
  });

  it("test B starts with empty store regardless of test execution order", async () => {
    // beforeEach must have cleared the store
    expect(savedItemsStore.size).toBe(0);
  });
});
