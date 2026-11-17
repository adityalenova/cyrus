import { describe, it, expect } from "vitest";
import { checkPayloadSize } from "../../src/lib/server/payloadLimiter";

describe("Payload Size Limiter", () => {
  it("rejects payloads exceeding size limit with 413", () => {
    const req = new Request("http://localhost/api", {
      headers: { "content-length": "2048" },
    });

    const res = checkPayloadSize(req, 1024);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(413);
  });

  it("permits payloads within limits", () => {
    const req = new Request("http://localhost/api", {
      headers: { "content-length": "500" },
    });

    const res = checkPayloadSize(req, 1024);
    expect(res).toBeNull();
  });
});
