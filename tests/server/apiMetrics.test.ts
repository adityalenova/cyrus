import { describe, it, expect } from "vitest";
import { ApiMetricsCollector } from "../../src/lib/server/apiMetrics";

describe("API Metrics Collector", () => {
  it("computes accurate error rates and latency percentiles", () => {
    const collector = new ApiMetricsCollector();
    collector.record("/api/issues", 200, 10);
    collector.record("/api/issues", 200, 20);
    collector.record("/api/issues", 500, 100);

    const summary = collector.getSummary();
    const metric = summary["/api/issues"];

    expect(metric.total).toBe(3);
    expect(metric.errorRate).toBeCloseTo(0.3333, 2);
    expect(metric.p50).toBe(20);
    expect(metric.p99).toBe(100);
  });
});
