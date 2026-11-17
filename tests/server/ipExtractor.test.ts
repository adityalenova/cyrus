import { describe, it, expect } from "vitest";
import { extractClientIp, isValidIp } from "../../src/lib/server/ipExtractor";

describe("Client IP Extractor", () => {
  it("validates IPv4 and IPv6 strings accurately", () => {
    expect(isValidIp("192.168.1.1")).toBe(true);
    expect(isValidIp("999.999.999.999")).toBe(false);
  });

  it("prioritizes Cloudflare connecting IP header", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.195",
      "x-forwarded-for": "10.0.0.1",
    });

    expect(extractClientIp(headers)).toBe("203.0.113.195");
  });
});
