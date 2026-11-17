interface SwrEntry<T> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

export class SwrCache {
  private cache = new Map<string, SwrEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  async getOrRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = 30000,
    swrGraceMs = 60000
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key) as SwrEntry<T> | undefined;

    if (entry && now < entry.freshUntil) {
      return entry.data;
    }

    if (entry && now < entry.staleUntil) {
      // Trigger background revalidation if not already in flight
      if (!this.inflight.has(key)) {
        const promise = fetcher()
          .then((data) => {
            this.cache.set(key, {
              data,
              freshUntil: Date.now() + ttlMs,
              staleUntil: Date.now() + ttlMs + swrGraceMs,
            });
          })
          .catch((err) => console.error("Background SWR refresh failed:", err))
          .finally(() => this.inflight.delete(key));

        this.inflight.set(key, promise);
      }
      return entry.data;
    }

    // Cache miss or expired: fetch synchronously
    const data = await fetcher();
    this.cache.set(key, {
      data,
      freshUntil: Date.now() + ttlMs,
      staleUntil: Date.now() + ttlMs + swrGraceMs,
    });
    return data;
  }
}

export const swrCache = new SwrCache();
