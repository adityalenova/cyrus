export interface CachedIdempotencyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type LockStatus = "LOCKED" | "CONFLICT" | "CACHED";

export class IdempotencyStore {
  private cache = new Map<string, { response: CachedIdempotencyResponse; expiresAt: number }>();
  private inFlight = new Map<string, number>();

  acquireLock(key: string, lockTtlMs = 15000): { status: LockStatus; cached?: CachedIdempotencyResponse } {
    const now = Date.now();
    this.cleanup(now);

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return { status: "CACHED", cached: cached.response };
    }

    const lockedUntil = this.inFlight.get(key);
    if (lockedUntil && lockedUntil > now) {
      return { status: "CONFLICT" };
    }

    this.inFlight.set(key, now + lockTtlMs);
    return { status: "LOCKED" };
  }

  saveResponse(key: string, response: CachedIdempotencyResponse, ttlMs = 86400000): void {
    const now = Date.now();
    this.inFlight.delete(key);
    this.cache.set(key, {
      response,
      expiresAt: now + ttlMs,
    });
  }

  releaseLock(key: string): void {
    this.inFlight.delete(key);
  }

  private cleanup(now: number): void {
    for (const [key, val] of this.cache.entries()) {
      if (val.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
    for (const [key, until] of this.inFlight.entries()) {
      if (until <= now) {
        this.inFlight.delete(key);
      }
    }
  }
}

export const idempotencyStore = new IdempotencyStore();
