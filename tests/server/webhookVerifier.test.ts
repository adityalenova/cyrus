import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyGitHubWebhook } from "../../src/lib/server/webhookVerifier";

describe("GitHub Webhook Verifier", () => {
  const secret = "super-secret-key";
  const payload = JSON.stringify({ action: "opened", issue: { number: 10 } });

  it("verifies valid HMAC-SHA256 signatures", () => {
    const hmac = createHmac("sha256", secret).update(payload).digest("hex");
    const header = `sha256=${hmac}`;

    expect(verifyGitHubWebhook(payload, header, secret)).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const hmac = createHmac("sha256", secret).update(payload).digest("hex");
    const header = `sha256=${hmac}`;

    expect(verifyGitHubWebhook("tampered payload", header, secret)).toBe(false);
  });

  it("rejects invalid or missing headers", () => {
    expect(verifyGitHubWebhook(payload, null, secret)).toBe(false);
    expect(verifyGitHubWebhook(payload, "invalid_header", secret)).toBe(false);
  });
});
