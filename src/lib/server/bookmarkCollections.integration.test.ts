import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import * as schema from "../db/schema";
import { setSession } from "./auth";
import { updateBookmarkCollection } from "@/app/bookmarks/actions";
import { GET as privateGET } from "@/app/api/me/bookmark-collections/route";
import { GET as publicGET } from "@/app/api/bookmark-collections/[token]/route";
import { POST as saveBookmark, DELETE as removeBookmark } from "@/app/api/me/saved/route";
import { listBookmarkCollections } from "./bookmarkCollections";
import * as collectionQueries from "./bookmarkCollections";

const state = vi.hoisted(() => ({ db: null as Db | null, cookie: "" }));
vi.mock("../db", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined, set: (_name: string, value: string) => { state.cookie = value; }, delete: () => { state.cookie = ""; } }) }));
let client: PGlite, database: ReturnType<typeof drizzle<typeof schema>>, owner: string, other: string;
beforeAll(async () => {
  // No URL or disk directory: this PostgreSQL instance is owned and in memory.
  client = new PGlite(); await client.waitReady;
  // Isolate the additive schema: main's journal currently references a missing
  // 0002 SQL file. The complete deployment chain remains blocked upstream.
  for (const file of ["0000_volatile_forge.sql", "0001_rare_reaper.sql", "0003_bookmark_collections.sql"]) {
    await client.exec(await readFile(new URL(`../../../drizzle/${file}`, import.meta.url), "utf8"));
  }
  database = drizzle(client, { schema }); state.db = database as unknown as Db;
  vi.stubEnv("SESSION_SECRET", "local-owned-database-test-secret-186");
});
afterAll(async () => { state.db = null; await client?.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  state.cookie = ""; await client.exec('TRUNCATE "users" CASCADE');
  const rows = await database.insert(schema.users).values([{ provider: "email", providerId: "one", name: "Owner", email: "private-owner@example.test" }, { provider: "email", providerId: "two", name: "Other", email: "private-other@example.test" }]).returning();
  owner = rows[0].id; other = rows[1].id;
});
const sign = (id = owner) => setSession({ uid: id, name: "Test user", provider: "email" });
const request = (body: unknown) => new Request("http://localhost/api/me/saved", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const shared = (token: string) => publicGET(new Request("http://localhost"), { params: Promise.resolve({ token }) });
async function create(name = "GSoC Ideas") {
  const result = await updateBookmarkCollection({ action: "create", name }); expect(result).not.toHaveProperty("error");
  return (await listBookmarkCollections(owner)).find(item => item.name === name)!;
}

describe("real PostgreSQL bookmark ownership and sharing", () => {
  it("acknowledges a committed change when the subsequent collection read fails", async () => {
    await sign();
    const read = vi.spyOn(collectionQueries, "listBookmarkCollections").mockRejectedValueOnce(new Error("read unavailable"));
    try {
      expect(await updateBookmarkCollection({ action: "create", name: "Persisted despite failed read" })).toMatchObject({ committed: true });
      expect(await database.select().from(schema.bookmarkCollections)).toHaveLength(1);
    } finally { read.mockRestore(); }
    expect((await listBookmarkCollections(owner))[0].name).toBe("Persisted despite failed read");
  });
  it("preserves empty collections and treats already-unsaved membership removal as complete", async () => {
    await sign(); const collection = await create();
    expect((await listBookmarkCollections(owner))[0].itemKeys).toEqual([]);
    const change = { action: "member", id: collection.id, itemType: "program", itemId: "not-saved", enabled: false };
    expect(await updateBookmarkCollection(change)).not.toHaveProperty("error");
    expect(await updateBookmarkCollection({ ...change, enabled: true })).toMatchObject({ status: 404 });
    expect(await database.select().from(schema.bookmarkCollectionItems)).toEqual([]);
  });
  it("reports owner-scoped updates that affect no row", async () => {
    await sign(); const collection = await create();
    await client.exec(`CREATE FUNCTION suppress_collection_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      CREATE TRIGGER suppress_update BEFORE UPDATE ON bookmark_collections FOR EACH ROW EXECUTE FUNCTION suppress_collection_update();`);
    try {
      expect(await updateBookmarkCollection({ action: "rename", id: collection.id, name: "Not applied" })).toMatchObject({ status: 404 });
      expect(await updateBookmarkCollection({ action: "share", id: collection.id, enabled: true })).toMatchObject({ status: 404 });
      expect((await listBookmarkCollections(owner))[0]).toMatchObject({ name: "GSoC Ideas", shareToken: null });
    } finally { await client.exec("DROP TRIGGER suppress_update ON bookmark_collections; DROP FUNCTION suppress_collection_update();"); }
  });
  it("reports unavailable storage without pretending that local bookmarks are synced", async () => {
    const previous = state.db; state.db = null;
    try {
      expect((await privateGET()).status).toBe(503);
      expect(await updateBookmarkCollection({ action: "create", name: "Offline" })).toMatchObject({ status: 503 });
    } finally { state.db = previous; }
  });
  it("rejects unsigned and tampered sessions at both private API and server action", async () => {
    expect((await privateGET()).status).toBe(401);
    expect(await updateBookmarkCollection({ action: "create", name: "Private" })).toMatchObject({ status: 401 });
    await sign(); const parts = state.cookie.split("."); parts[1] = "e30"; state.cookie = parts.join(".");
    expect((await privateGET()).status).toBe(401);
  });
  it("persists collections between independently authenticated requests without exposing another account", async () => {
    await sign(); const collection = await create();
    await sign(other); expect(await (await privateGET()).json()).toEqual({ collections: [] });
    for (const action of [{ action: "rename", name: "Stolen" }, { action: "delete" }, { action: "share", enabled: true }, { action: "member", itemType: "repo", itemId: "sample/repo", enabled: true }]) {
      expect(await updateBookmarkCollection({ ...action, id: collection.id })).toMatchObject({ status: 404 });
    }
    state.cookie = ""; await sign(owner);
    expect((await (await privateGET()).json()).collections).toEqual([collection]);
  });
  it("shares only opt-in public fields, revokes immediately and generates a different replacement token", async () => {
    await sign(); const collection = await create();
    await saveBookmark(request({ itemType: "repo", itemId: "owner/repo", title: "Project", meta: { privateNote: "SECRET-PRIVATE-NOTE", email: "never-public@example.test" } }));
    await updateBookmarkCollection({ action: "member", id: collection.id, itemType: "repo", itemId: "owner/repo", enabled: true });
    expect((await listBookmarkCollections(owner))[0].shareToken).toBeNull();
    await updateBookmarkCollection({ action: "share", id: collection.id, enabled: true });
    const token = (await listBookmarkCollections(owner))[0].shareToken!; state.cookie = "";
    const response = await shared(token), text = await response.text();
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(text)).toEqual({ name: "GSoC Ideas", items: [{ itemType: "repo", itemId: "owner/repo", title: "Project" }] });
    for (const secret of [owner, other, "privateNote", "SECRET-PRIVATE-NOTE", "email", "shareToken"]) expect(text).not.toContain(secret);
    await sign(); await updateBookmarkCollection({ action: "share", id: collection.id, enabled: false });
    expect((await shared(token)).status).toBe(404);
    await updateBookmarkCollection({ action: "share", id: collection.id, enabled: true });
    const replacement = (await listBookmarkCollections(owner))[0].shareToken!;
    expect(replacement).not.toBe(token); expect((await shared(replacement)).status).toBe(200); expect((await shared(token)).status).toBe(404);
  });
  it("makes membership idempotent and cascades unsaving without deleting the collection", async () => {
    await sign(); const collection = await create();
    await saveBookmark(request({ itemType: "program", itemId: "gsoc", title: "GSoC" }));
    const change = { action: "member", id: collection.id, itemType: "program", itemId: "gsoc", enabled: true };
    await collectionQueries.changeBookmarkCollection(owner, change); await updateBookmarkCollection(change);
    expect((await listBookmarkCollections(owner))[0].itemKeys).toEqual(['["program","gsoc"]']);
    expect((await database.select().from(schema.bookmarkCollectionItems))).toHaveLength(1);
    await removeBookmark(request({ itemType: "program", itemId: "gsoc" }));
    expect((await listBookmarkCollections(owner))[0].itemKeys).toEqual([]);
    expect((await database.select().from(schema.bookmarkCollectionItems))).toHaveLength(0);
  });
  it("rejects cross-account memberships at the database constraint, independently of route checks", async () => {
    await sign(); const collection = await create();
    const [saved] = await database.insert(schema.savedItems).values({ userId: other, itemType: "org", itemId: "example" }).returning();
    await expect(database.insert(schema.bookmarkCollectionItems).values({ userId: owner, collectionId: collection.id, savedItemId: saved.id })).rejects.toThrow();
    await expect(database.insert(schema.bookmarkCollectionItems).values({ userId: other, collectionId: collection.id, savedItemId: saved.id })).rejects.toThrow();
    expect(await database.select().from(schema.bookmarkCollectionItems)).toEqual([]);
  });
  it("enforces collection uniqueness per owner, validates payloads and ignores no spoofed owner field", async () => {
    await sign(); await create();
    expect(await updateBookmarkCollection({ action: "create", name: "GSoC Ideas" })).toMatchObject({ status: 409 });
    for (const value of [null, {}, { action: "create", name: " " }, { action: "create", name: "x".repeat(81) }, { action: "create", name: "Spoofed", userId: other }, { action: "share", id: "not-a-uuid", enabled: true }]) expect(await updateBookmarkCollection(value)).toMatchObject({ status: 400 });
    await sign(other); expect(await updateBookmarkCollection({ action: "create", name: "GSoC Ideas" })).not.toHaveProperty("error");
    expect(await database.select().from(schema.bookmarkCollections)).toHaveLength(2);
  });
  it("renames and deletes collections while preserving saved bookmarks", async () => {
    await sign(); const collection = await create();
    await saveBookmark(request({ itemType: "org", itemId: "example", title: "Example" }));
    await updateBookmarkCollection({ action: "member", id: collection.id, itemType: "org", itemId: "example", enabled: true });
    await updateBookmarkCollection({ action: "rename", id: collection.id, name: "To Apply" });
    expect((await listBookmarkCollections(owner))[0].name).toBe("To Apply");
    await updateBookmarkCollection({ action: "delete", id: collection.id });
    expect(await database.select().from(schema.bookmarkCollectionItems)).toEqual([]);
    expect(await database.select().from(schema.savedItems).where(eq(schema.savedItems.userId, owner))).toHaveLength(1);
  });
  it("never exposes private collections by their IDs and handles invalid/revoked links without a cache", async () => {
    await sign(); const collection = await create();
    for (const token of [collection.id, "not-a-uuid", "00000000-0000-4000-8000-000000000000"]) {
      const response = await shared(token); expect(response.status).toBe(404); expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});
