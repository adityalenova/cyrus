import { describe, it, expect } from "vitest";
import { CircuitBreaker, CircuitBreakerOpenError } from "../../src/lib/server/circuitBreaker";

describe("CircuitBreaker", () => {
  it("executes successfully when CLOSED", async () => {
    const breaker = new CircuitBreaker();
    const result = await breaker.execute(async () => 42);
    expect(result).toBe(42);
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("trips to OPEN after consecutive failures", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 50 });

    const failing = async () => { throw new Error("API down"); };

    await expect(breaker.execute(failing)).rejects.toThrow("API down");
    await expect(breaker.execute(failing)).rejects.toThrow("API down");

    expect(breaker.getState()).toBe("OPEN");
    await expect(breaker.execute(failing)).rejects.toThrow(CircuitBreakerOpenError);
  });
});
