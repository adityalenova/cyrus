/* ══ cacheManager.ts — tiny in-process TTL cache ══════════════════════
   A module-scoped Map, nothing more: entries live in the memory of one
   process and are dropped when it exits. That makes it useful for taking
   repeated work off a request path (the same catalog counts asked for twice
   inside one render), and it is deliberately not a shared cache — two
   serverless instances do not see each other's entries, so nothing may treat
   a hit as proof that some other instance already did the work. ══ */

/**
 * Namespaced key/value cache with a per-entry expiry.
 *
 * The store is static and the class is never instantiated; call
 * `DataCache.set(...)` / `DataCache.get(...)` directly. Keys are plain strings
 * in one flat namespace, so prefix them by feature (`"catalog:counts"`)
 * to keep unrelated callers from overwriting each other.
 *
 * Expired entries are not removed on a timer — `get` returns `null` for them
 * and leaves them in the Map until the same key is set again.
 */
export class DataCache {
  private static store = new Map<string, { data: any; expiry: number }>();

  /**
   * Store `data` under `key`, replacing any previous value and expiry.
   *
   * @param key - flat cache key, e.g. `"catalog:counts"`.
   * @param data - value to keep; returned as-is, so keep a reference rather
   *   than a copy if it is large.
   * @param ttl - lifetime in milliseconds, counted from this call. Defaults to
   *   300000 (five minutes).
   * @returns nothing.
   * @example
   * DataCache.set("catalog:counts", { repos: 42 }, 60_000);
   */
  static set(key: string, data: any, ttl = 300000) { this.store.set(key, { data, expiry: Date.now() + ttl }); }

  /**
   * Read `key` if it is still inside its TTL.
   *
   * @param key - the key passed to `set`.
   * @returns the stored value, or `null` when the key is absent or expired.
   *   A cached `null`/`undefined` is therefore indistinguishable from a miss —
   *   cache a wrapper object if "nothing found" has to be memoised.
   * @example
   * const counts = DataCache.get("catalog:counts") ?? computeCounts();
   */
  static get(key: string) {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiry) return null;
    return entry.data;
  }
}
