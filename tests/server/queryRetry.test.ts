import { describe, it, expect } from "vitest";
import { withQueryRetry, isRetryableError } from "../../src/lib/server/queryRetry";

describe("Database Query Retry", () => {
  it("detects retryable error codes", () => {
    expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryableError({ code: "40001" })).toBe(true);
    expect(isRetryableError({ code: "INVALID_SYNTAX" })).toBe(false);
  });

  it("retries transient failures until success", async () => {
    let attempts = 0;
    const query = async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error("Connection reset");
        (err as unknown as { code: string }).code = "ECONNRESET";
        throw err;
      }
      return "SUCCESS";
    };

    const res = await withQueryRetry(query, { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 20 });
    expect(res).toBe("SUCCESS");
    expect(attempts).toBe(3);
  });
});
