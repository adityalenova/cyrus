import { describe, it, expect } from "vitest";
import { GracefulShutdownCoordinator } from "../../src/lib/server/gracefulShutdown";

describe("Graceful Shutdown Coordinator", () => {
  it("executes all registered hooks upon trigger", async () => {
    const coordinator = new GracefulShutdownCoordinator();
    let hook1Called = false;
    let hook2Called = false;

    coordinator.registerHook("hook1", () => { hook1Called = true; });
    coordinator.registerHook("hook2", async () => { hook2Called = true; });

    await coordinator.triggerShutdown("SIGTERM", 1000);
    expect(hook1Called).toBe(true);
    expect(hook2Called).toBe(true);
  });
});
