import { describe, it, expect, vi } from "vitest";
import { dispatchOutboundWebhook } from "../../src/lib/server/outboundWebhook";

describe("Outbound Webhook Dispatcher", () => {
  it("dispatches signed event to target endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    globalThis.fetch = fetchMock;

    const res = await dispatchOutboundWebhook(
      "https://example.com/webhook",
      "secret-key",
      "catalog.updated",
      { id: "100" },
      1
    );

    expect(res.success).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });
});
