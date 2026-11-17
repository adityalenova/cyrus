import { describe, it, expect } from "vitest";
import { generateETag, isETagFresh, makeNotModifiedResponse } from "../../src/lib/server/etag";

describe("HTTP ETag & 304", () => {
  it("generates deterministic strong and weak ETags", () => {
    const data = "hello world payload";
    const strong = generateETag(data);
    const weak = generateETag(data, { weak: true });

    expect(strong.startsWith('"')).toBe(true);
    expect(weak.startsWith('W/"')).toBe(true);
  });

  it("identifies matching If-None-Match headers", () => {
    const etag = '"abc12345"';
    const headers = new Headers({ "if-none-match": '"abc12345", "xyz999"' });
    expect(isETagFresh(headers, etag)).toBe(true);

    const staleHeaders = new Headers({ "if-none-match": '"other"' });
    expect(isETagFresh(staleHeaders, etag)).toBe(false);
  });

  it("generates HTTP 304 response with headers", () => {
    const res = makeNotModifiedResponse('"abc12345"');
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe('"abc12345"');
  });
});
