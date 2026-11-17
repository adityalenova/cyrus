import { describe, it, expect } from "vitest";
import { IdempotencyStore } from "../../src/lib/server/idempotency";

describe("IdempotencyStore", () => {
  it("acquires lock and returns CACHED for existing response", () => {
    const store = new IdempotencyStore();
    const lock1 = store.acquireLock("key-1");
    expect(lock1.status).toBe("LOCKED");

    const lock2 = store.acquireLock("key-1");
    expect(lock2.status).toBe("CONFLICT");

    store.saveResponse("key-1", {
      status: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "item-1" }),
    });

    const lock3 = store.acquireLock("key-1");
    expect(lock3.status).toBe("CACHED");
    expect(lock3.cached?.status).toBe(201);
  });
});
