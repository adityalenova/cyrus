export interface SlidingRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();

  check(key: string, limit: number, windowMs: number): SlidingRateLimitResult {
    const now = Date.now();
    const threshold = now - windowMs;

    let timestamps = this.windows.get(key) || [];
    timestamps = timestamps.filter((t) => t > threshold);

    const allowed = timestamps.length < limit;

    if (allowed) {
      timestamps.push(now);
    }
    this.windows.set(key, timestamps);

    const remaining = Math.max(0, limit - timestamps.length);
    const oldest = timestamps[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

    return { allowed, limit, remaining, resetSeconds };
  }
}

export const slidingRateLimiter = new SlidingWindowRateLimiter();
