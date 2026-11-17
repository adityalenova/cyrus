import { describe, it, expect } from "vitest";
import { generateCsrfToken, verifyCsrfToken } from "../../src/lib/server/csrf";

describe("CSRF Protection", () => {
  const secret = "test-secret-key-456";

  it("generates and verifies valid CSRF token pair", () => {
    const { token, signedValue } = generateCsrfToken(secret);
    expect(verifyCsrfToken(signedValue, token, secret)).toBe(true);
  });

  it("rejects mismatched token or signature", () => {
    const { signedValue } = generateCsrfToken(secret);
    expect(verifyCsrfToken(signedValue, "wrong-token", secret)).toBe(false);
    expect(verifyCsrfToken("tampered.signature", "token", secret)).toBe(false);
  });
});
