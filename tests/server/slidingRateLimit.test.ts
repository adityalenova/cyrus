import { describe, it, expect } from "vitest";
import { SlidingWindowRateLimiter } from "../../src/lib/server/slidingRateLimit";

describe("Sliding Window Rate Limiter", () => {
  it("enforces request threshold within window", () => {
    const limiter = new SlidingWindowRateLimiter();
    const key = "user-123";

    expect(limiter.check(key, 2, 60000).allowed).toBe(true);
    expect(limiter.check(key, 2, 60000).allowed).toBe(true);
    expect(limiter.check(key, 2, 60000).allowed).toBe(false);
  });
});
