import { describe, it, expect } from "vitest";
import { LruCache } from "../../src/lib/server/lruCache";

describe("In-Memory LRU Cache", () => {
  it("evicts least recently used item when capacity is exceeded", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // touch "a", making "b" the oldest
    cache.set("c", 3); // should evict "b"

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });
});
