import { describe, it, expect, vi } from "vitest";
import { createAuditEvent, dispatchAuditEvent } from "../../src/lib/server/auditLog";

describe("Security Audit Logger", () => {
  it("creates compliant audit event structure", () => {
    const event = createAuditEvent("user-1", "127.0.0.1", "AUTH_LOGIN", {
      details: { method: "oauth_github" },
    });

    expect(event.actorId).toBe("user-1");
    expect(event.action).toBe("AUTH_LOGIN");
    expect(event.timestamp).toBeDefined();
  });

  it("dispatches audit event cleanly", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = createAuditEvent("admin-1", "127.0.0.1", "ROLE_CHANGE");
    await dispatchAuditEvent(event);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
