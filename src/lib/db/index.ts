/* ══ db connection ═══════════════════════════════════════════════════
   Neon serverless driver, created lazily. Without DATABASE_URL the app
   still works — every API route treats a null db as "backend offline"
   and the frontend falls back to localStorage. ═══════════════════════ */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Drizzle client type for this schema — what `getDb()` returns when it is not `null`. */
export type Db = NeonHttpDatabase<typeof schema>;

const cache = (globalThis as { __cyrusDb?: { url: string; db: Db | null } }).__cyrusDb ??= {
  url: "",
  db: null,
};

/**
 * The Drizzle client for the configured Neon database, or `null` when
 * `DATABASE_URL` is unset.
 *
 * A missing or changed connection string never throws here: `null` is the
 * "backend offline" signal every API route already handles by falling back to
 * the client-side path. The client is built once per connection string and
 * kept on `globalThis`, so a dev-server reload reuses it instead of opening a
 * new one, while a new `DATABASE_URL` in the same process replaces it.
 *
 * @returns a `Db` bound to `./schema`, or `null` without `DATABASE_URL`.
 * @example
 * const db = getDb();
 * if (!db) return NextResponse.json({ error: "backend offline" }, { status: 503 });
 * const rows = await db.select().from(repos).limit(10);
 */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (cache.db && cache.url === url) return cache.db;
  cache.url = url;
  cache.db = drizzle(neon(url), { schema });
  return cache.db;
}

/**
 * Whether this process has a database configured.
 *
 * Cheaper than `getDb()`: it only reads `process.env.DATABASE_URL` and never
 * constructs a client, so it is safe to call on a render path or in a health
 * check. `getDb() !== null` and `dbReady()` agree at any instant.
 *
 * @returns `true` when `DATABASE_URL` is set, `false` otherwise.
 * @example
 * dbReady(); // => false on a fresh clone with no .env
 */
export function dbReady(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
