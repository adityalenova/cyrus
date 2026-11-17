import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export interface GeneratedApiKey {
  rawKey: string;
  prefix: string;
  hashedKey: string;
}

export function generateApiKey(environment: "live" | "test" = "live"): GeneratedApiKey {
  const entropy = randomBytes(24).toString("base64url");
  const prefix = `cyrus_${environment}_${entropy.slice(0, 8)}`;
  const rawKey = `cyrus_${environment}_${entropy}`;
  const hashedKey = hashApiKey(rawKey);

  return { rawKey, prefix, hashedKey };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function verifyApiKey(rawKey: string, expectedHash: string): boolean {
  const computedHash = hashApiKey(rawKey);
  const bufA = Buffer.from(computedHash, "utf-8");
  const bufB = Buffer.from(expectedHash, "utf-8");

  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
