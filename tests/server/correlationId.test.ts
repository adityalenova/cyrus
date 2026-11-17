import { describe, it, expect } from "vitest";
import {
  getOrCreateCorrelationId,
  applyCorrelationHeaders,
  withCorrelationResponse,
  CORRELATION_HEADER,
  REQUEST_ID_HEADER,
} from "../../src/lib/server/correlationId";

describe("Correlation ID Middleware", () => {
  it("reuses incoming correlation ID from headers", () => {
    const headers = new Headers();
    headers.set(CORRELATION_HEADER, "test-corr-123");

    const ctx = getOrCreateCorrelationId(headers);
    expect(ctx.correlationId).toBe("test-corr-123");
    expect(ctx.requestId).toBeDefined();
    expect(ctx.startTime).toBeGreaterThan(0);
  });

  it("generates a new correlation ID when none is provided", () => {
    const headers = new Headers();
    const ctx = getOrCreateCorrelationId(headers);
    expect(ctx.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("attaches correlation headers to outgoing response", () => {
    const ctx = {
      correlationId: "corr-xyz",
      requestId: "req-xyz",
      startTime: Date.now(),
    };
    const res = new Response("OK", { status: 200 });
    const decorated = withCorrelationResponse(res, ctx);

    expect(decorated.headers.get(CORRELATION_HEADER)).toBe("corr-xyz");
    expect(decorated.headers.get(REQUEST_ID_HEADER)).toBe("req-xyz");
  });
});
