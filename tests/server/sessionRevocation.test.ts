import { describe, it, expect } from "vitest";
import { SessionRevocationStore } from "../../src/lib/server/sessionRevocation";

describe("Session Revocation Store", () => {
  it("records and verifies revoked token IDs", () => {
    const store = new SessionRevocationStore();
    const jti = "jti-12345";
    const expiresAt = Date.now() + 10000;

    store.revoke(jti, expiresAt);
    expect(store.isRevoked(jti)).toBe(true);
    expect(store.isRevoked("other-jti")).toBe(false);
  });
});
