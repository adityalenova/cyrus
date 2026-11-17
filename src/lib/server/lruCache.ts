interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly maxCapacity: number, private readonly defaultTtlMs = 60000) {}

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCapacity) {
      // Evict oldest item
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  getStats(): { size: number; hits: number; misses: number } {
    return { size: this.cache.size, hits: this.hits, misses: this.misses };
  }
}
