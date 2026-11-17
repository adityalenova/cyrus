/* ══ rateLimit.ts — in-memory sliding window rate limiter ════════════ */
interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const maxRequests = options.maxRequests || 60; // 60 req/window
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = store.get(identifier) || { timestamps: [] };
  // Filter out timestamps outside the active window
  const activeTimestamps = record.timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= maxRequests) {
    const oldest = activeTimestamps[0];
    const reset = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: Math.max(1, reset),
    };
  }

  activeTimestamps.push(now);
  store.set(identifier, { timestamps: activeTimestamps });

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - activeTimestamps.length,
    reset: Math.ceil(windowMs / 1000),
  };
}
