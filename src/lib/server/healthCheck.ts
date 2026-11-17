export interface SubsystemHealth {
  status: "UP" | "DOWN" | "DEGRADED";
  latencyMs?: number;
  message?: string;
}

export interface HealthReport {
  status: "UP" | "DEGRADED" | "DOWN";
  timestamp: string;
  uptimeSeconds: number;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  subsystems: Record<string, SubsystemHealth>;
}

export async function checkSystemHealth(
  dbPingFn?: () => Promise<boolean>
): Promise<HealthReport> {
  const mem = process.memoryUsage();
  const subsystems: Record<string, SubsystemHealth> = {};

  if (dbPingFn) {
    const start = Date.now();
    try {
      const ok = await dbPingFn();
      subsystems.database = {
        status: ok ? "UP" : "DOWN",
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      subsystems.database = {
        status: "DOWN",
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "DB ping failed",
      };
    }
  }

  const isDegraded = Object.values(subsystems).some((s) => s.status !== "UP");

  return {
    status: isDegraded ? "DEGRADED" : "UP",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    subsystems,
  };
}
