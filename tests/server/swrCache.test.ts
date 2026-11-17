import { describe, it, expect } from "vitest";
import { SwrCache } from "../../src/lib/server/swrCache";

describe("SWR Server Cache", () => {
  it("serves cached value and triggers revalidation", async () => {
    const cache = new SwrCache();
    let counter = 0;
    const fetcher = async () => ++counter;

    const v1 = await cache.getOrRevalidate("k1", fetcher, 50, 100);
    expect(v1).toBe(1);

    const v2 = await cache.getOrRevalidate("k1", fetcher, 50, 100);
    expect(v2).toBe(1);
    expect(counter).toBe(1);
  });
});
