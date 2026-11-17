import { describe, it, expect } from "vitest";
import { buildSecurityHeaders } from "../../src/lib/server/securityHeaders";

describe("Security Headers Builder", () => {
  it("builds strict default headers", () => {
    const headers = buildSecurityHeaders();
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Strict-Transport-Security"]).toBeDefined();
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
  });

  it("injects nonce into Content-Security-Policy", () => {
    const headers = buildSecurityHeaders({ nonce: "test-nonce-123" });
    expect(headers["Content-Security-Policy"]).toContain("'nonce-test-nonce-123'");
  });
});
