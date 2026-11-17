import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey } from "../../src/lib/server/apiKeyManager";

describe("API Key Manager", () => {
  it("generates structured API key with valid hash", () => {
    const key = generateApiKey("live");
    expect(key.rawKey.startsWith("cyrus_live_")).toBe(true);
    expect(key.hashedKey).toBe(hashApiKey(key.rawKey));
    expect(verifyApiKey(key.rawKey, key.hashedKey)).toBe(true);
  });

  it("fails verification on invalid raw key", () => {
    const key = generateApiKey("test");
    expect(verifyApiKey("cyrus_test_wrongkey", key.hashedKey)).toBe(false);
  });
});
