export interface RouteMetric {
  count: number;
  errors: number;
  latencies: number[];
}

export class ApiMetricsCollector {
  private metrics = new Map<string, RouteMetric>();
  private readonly maxSamplesPerRoute: number;

  constructor(maxSamples = 1000) {
    this.maxSamplesPerRoute = maxSamples;
  }

  record(route: string, statusCode: number, durationMs: number): void {
    let metric = this.metrics.get(route);
    if (!metric) {
      metric = { count: 0, errors: 0, latencies: [] };
      this.metrics.set(route, metric);
    }

    metric.count++;
    if (statusCode >= 400) {
      metric.errors++;
    }

    if (metric.latencies.length >= this.maxSamplesPerRoute) {
      metric.latencies.shift();
    }
    metric.latencies.push(durationMs);
  }

  getSummary(): Record<string, { total: number; errorRate: number; p50: number; p95: number; p99: number }> {
    const summary: Record<string, { total: number; errorRate: number; p50: number; p95: number; p99: number }> = {};

    for (const [route, m] of this.metrics.entries()) {
      const sorted = [...m.latencies].sort((a, b) => a - b);
      const len = sorted.length;

      summary[route] = {
        total: m.count,
        errorRate: m.count > 0 ? +(m.errors / m.count).toFixed(4) : 0,
        p50: len > 0 ? sorted[Math.floor(len * 0.5)] : 0,
        p95: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
        p99: len > 0 ? sorted[Math.floor(len * 0.99)] : 0,
      };
    }

    return summary;
  }
}

export const apiMetrics = new ApiMetricsCollector();
