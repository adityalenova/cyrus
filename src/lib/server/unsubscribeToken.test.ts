/* unsubscribeToken.test.ts - the signed link in every notification email (#196) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribeToken";

const ID = "3f2b8a40-1c5d-4e6f-9a7b-0d1e2f3a4b5c";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

beforeEach(() => vi.stubEnv("SESSION_SECRET", "a-secret-that-is-long-enough-1234"));
afterEach(() => vi.unstubAllEnvs());

describe("unsubscribe token", () => {
  it("round-trips the user id it was made for", () => {
    const t = signUnsubscribeToken(ID)!;
    expect(t).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(verifyUnsubscribeToken(t)).toBe(ID);
  });

  it("rejects a token whose id was swapped, whose signature was changed, or that is cut short", () => {
    const [id, sig] = signUnsubscribeToken(ID)!.split(".");
    const otherId = Buffer.from(OTHER).toString("base64url");
    expect(verifyUnsubscribeToken(`${otherId}.${sig}`)).toBeNull();
    expect(verifyUnsubscribeToken(`${id}.${sig.slice(0, -2)}AA`)).toBeNull();
    expect(verifyUnsubscribeToken(`${id}.`)).toBeNull();
    expect(verifyUnsubscribeToken(id)).toBeNull();
    expect(verifyUnsubscribeToken(`${id}.${sig}.extra`)).toBeNull();
  });

  it("rejects anything that is not a string token", () => {
    for (const bad of [undefined, null, 5, {}, "", "x".repeat(300)]) expect(verifyUnsubscribeToken(bad)).toBeNull();
  });

  it("a token minted under another secret does not verify", () => {
    const t = signUnsubscribeToken(ID)!;
    vi.stubEnv("SESSION_SECRET", "a-different-secret-entirely-5678");
    expect(verifyUnsubscribeToken(t)).toBeNull();
  });

  it("makes and accepts nothing without a usable secret, or for a non-uuid id", () => {
    const t = signUnsubscribeToken(ID)!;
    vi.stubEnv("SESSION_SECRET", "short");
    expect(signUnsubscribeToken(ID)).toBeNull();
    expect(verifyUnsubscribeToken(t)).toBeNull();
    vi.stubEnv("SESSION_SECRET", "a-secret-that-is-long-enough-1234");
    expect(signUnsubscribeToken("not-a-uuid")).toBeNull();
  });
});
