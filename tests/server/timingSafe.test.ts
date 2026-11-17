import { describe, it, expect } from "vitest";
import { timingSafeCompare, timingSafeBufferCompare } from "../../src/lib/server/timingSafe";

describe("Timing-Safe Comparison", () => {
  it("returns true for matching strings", () => {
    expect(timingSafeCompare("secret_token_123", "secret_token_123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(timingSafeCompare("secret_token_123", "secret_token_999")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeCompare("short", "much_longer_secret")).toBe(false);
  });

  it("compares Buffers accurately", () => {
    const b1 = Buffer.from("abc");
    const b2 = Buffer.from("abc");
    const b3 = Buffer.from("xyz");
    expect(timingSafeBufferCompare(b1, b2)).toBe(true);
    expect(timingSafeBufferCompare(b1, b3)).toBe(false);
  });
});
