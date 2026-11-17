import { describe, it, expect } from "vitest";
import { checkSystemHealth } from "../../src/lib/server/healthCheck";

describe("System Health Diagnostics", () => {
  it("reports UP when all subsystems are healthy", async () => {
    const report = await checkSystemHealth(async () => true);
    expect(report.status).toBe("UP");
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(report.subsystems.database.status).toBe("UP");
    expect(report.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it("reports DEGRADED when database ping fails", async () => {
    const report = await checkSystemHealth(async () => {
      throw new Error("DB timeout");
    });
    expect(report.status).toBe("DEGRADED");
    expect(report.subsystems.database.status).toBe("DOWN");
  });
});
