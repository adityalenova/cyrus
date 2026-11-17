import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubWebhook(
  rawPayload: string | Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    return false;
  }

  const sigHex = signatureHeader.slice(prefix.length).trim();
  const expectedHmac = createHmac("sha256", secret).update(rawPayload).digest("hex");

  const sigBuf = Buffer.from(sigHex, "utf-8");
  const expectedBuf = Buffer.from(expectedHmac, "utf-8");

  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(sigBuf, expectedBuf);
}
