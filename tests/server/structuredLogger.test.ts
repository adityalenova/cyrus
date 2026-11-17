import { describe, it, expect, vi } from "vitest";
import { StructuredLogger } from "../../src/lib/server/structuredLogger";

describe("StructuredLogger", () => {
  it("redacts sensitive fields in logged context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new StructuredLogger("corr-test");

    logger.info("User login attempt", {
      username: "alex",
      password: "SuperSecretPassword123",
      token: "jwt-token-value",
      role: "admin",
    });

    expect(spy).toHaveBeenCalled();
    const loggedJson = JSON.parse(spy.mock.calls[0][0]);
    expect(loggedJson.level).toBe("INFO");
    expect(loggedJson.correlationId).toBe("corr-test");
    expect(loggedJson.context.password).toBe("[REDACTED]");
    expect(loggedJson.context.token).toBe("[REDACTED]");
    expect(loggedJson.context.username).toBe("alex");
    expect(loggedJson.context.role).toBe("admin");

    spy.mockRestore();
  });
});
