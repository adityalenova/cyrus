import { describe, expect, it } from "vitest";
import { createCrawler } from "../../scripts/lib/crawl-request.mjs";

/* A hand-built stand-in for api.github.com: statuses, headers and bodies come
   from a script, and nothing sleeps for real. `slept` is what the crawler asked
   to wait for, which is the whole point of the receipt.             ═ */
const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
  json: async () => body,
});

type Step = number | "network-error" | { status: number; body?: unknown; headers?: Record<string, string> };

function harness(steps: Step | Step[], opts = {}) {
  const script: Step[] = Array.isArray(steps) ? steps : [steps];
  const slept: number[] = [];
  const calls: string[] = [];
  let t = 1_760_000_000_000; // a fixed ms clock so reset maths is exact
  let i = 0;
  const crawler = createCrawler({
    fetchImpl: async (url: string) => {
      calls.push(url);
      const step = script[Math.min(i, script.length - 1)];
      i += 1;
      if (step === "network-error") throw new TypeError("fetch failed");
      const r = typeof step === "number" ? reply(step) : reply(step.status, step.body ?? {}, step.headers ?? {});
      return r;
    },
    sleep: async (ms: number) => { slept.push(ms); t += ms; },
    now: () => t,
    ...opts,
  });
  return { crawler, slept, calls, advance: (ms: number) => { t += ms; } };
}

describe("transient failures", () => {
  it("retries a 502 and succeeds within the attempt budget", async () => {
    const c = harness([502, 502, { status: 200, body: { items: [1, 2] } }]);
    const body = await c.crawler.request("/search/repositories?q=x", { bucket: "search", source: "repos:x" });

    expect(body).toEqual({ items: [1, 2] });
    const s = c.crawler.summarize().sources[0];
    expect(s).toMatchObject({ source: "repos:x", requests: 3, ok: 1, retries: 2 });
    expect(s.retryStatus["502"]).toBe(2);
    expect(s.failures).toEqual([]);
    // a transient 502 backs off; the waits are real, just not for long
    expect(c.slept).toEqual([5000, 10000]);
  });

  it("backoff grows and stops at the cap rather than running away", async () => {
    const c = harness([500, 500, 500, { status: 200, body: {} }], { backoffBase: 1000, backoffCap: 4000 });
    await c.crawler.request("/x", { source: "s" });
    expect(c.slept).toEqual([1000, 2000, 4000]);
  });

  it("gives up after the attempt budget and says so", async () => {
    const c = harness(502, { attemptCap: 3 });
    const out = await c.crawler.request("/repos/a/b/issues", { source: "issues" });

    expect(out).toBeNull();
    const s = c.crawler.summarize().sources[0];
    expect(s.requests).toBe(3);
    expect(s.retries).toBe(2);
    expect(s.failures).toEqual([{ path: "/repos/a/b/issues", status: 502, attempts: 3 }]);
    expect(c.slept).toHaveLength(2);
  });

  it("treats a network throw as transient and retries it too", async () => {
    const c = harness(["network-error", { status: 200, body: { ok: true } }], { attemptCap: 4 });
    expect(await c.crawler.request("/x", { source: "s" })).toEqual({ ok: true });
    expect(c.crawler.summarize().sources[0].retryStatus["network"]).toBe(1);
  });

  it("gives up on a source that never answers", async () => {
    const c = harness(["network-error"], { attemptCap: 2 });
    expect(await c.crawler.request("/x", { source: "s" })).toBeNull();
    expect(c.crawler.summarize().sources[0].failures[0].status).toBe("network");
  });
});

describe("rate limits", () => {
  it("waits for retry-after when GitHub sends it", async () => {
    const c = harness([
      { status: 429, headers: { "retry-after": "30" } },
      { status: 200, body: { done: true } },
    ]);
    expect(await c.crawler.request("/search", { bucket: "search", source: "s" })).toEqual({ done: true });
    const s = c.crawler.summarize().sources[0];
    expect(s.rateLimitWaits).toBe(1);
    expect(s.rateLimitMs).toBe(30_000);
    expect(c.slept).toEqual([30_000]);
  });

  it("falls back to x-ratelimit-reset when there is no retry-after", async () => {
    const resetEpochS = Math.floor(1_760_000_000_000 / 1000) + 120; // resets in 120s
    const c = harness([
      { status: 403, headers: { "x-ratelimit-reset": String(resetEpochS) } },
      { status: 200, body: {} },
    ]);
    await c.crawler.request("/x", { source: "s" });
    // 120s plus the 2s safety margin
    expect(c.slept).toEqual([122_000]);
    expect(c.crawler.summarize().sources[0].rateLimitWaits).toBe(1);
  });

  it("caps a wait a header asks for so a scheduled run cannot park all day", async () => {
    const far = Math.floor(1_760_000_000_000 / 1000) + 6 * 3600;
    const c = harness([{ status: 403, headers: { "x-ratelimit-reset": String(far) } }, { status: 200, body: {} }], { waitCap: 60_000 });
    await c.crawler.request("/x", { source: "s" });
    expect(c.slept).toEqual([60_000]);
  });

  it("keeps the last known quota when a response carries no quota headers", async () => {
    const c = harness([
      { status: 403, headers: { "retry-after": "5" } },
      { status: 200, body: {} },
    ]);
    await c.crawler.request("/x", { source: "s" });
    await c.crawler.request("/y", { source: "s" });
    // a headerless response must not read as "zero requests left"
    expect(c.crawler.state.coreRemaining).toBeNull();
    expect(c.slept).toEqual([5_000]);
  });

  it("counts a wait even when the source then fails for good", async () => {
    const c = harness([{ status: 403, headers: { "retry-after": "5" } }], { attemptCap: 2 });
    expect(await c.crawler.request("/x", { source: "s" })).toBeNull();
    const s = c.crawler.summarize().sources[0];
    expect(s.rateLimitWaits).toBe(1);
    expect(s.failures).toHaveLength(1);
  });

  it("defers the next request when the core quota header says it is nearly out", async () => {
    const resetEpochS = Math.floor(1_760_000_000_000 / 1000) + 90;
    const c = harness([
      { status: 200, body: { a: 1 }, headers: { "x-ratelimit-remaining": "10", "x-ratelimit-reset": String(resetEpochS) } },
      { status: 200, body: { a: 2 } },
    ]);
    await c.crawler.request("/x", { source: "s" });
    await c.crawler.request("/y", { source: "s" });
    expect(c.slept).toEqual([92_000]);
    expect(c.crawler.state.coreRemaining).toBe(10);
    expect(c.calls[1]).toContain("/y");
  });

  it("holds the search bucket to its per-minute window and reports the pause", async () => {
    const c = harness(200, { searchPerMinute: 3 });
    for (let i = 0; i < 4; i++) await c.crawler.request(`/search?q=${i}`, { bucket: "search", source: "search" });
    const s = c.crawler.summarize().sources[0];
    expect(s.requests).toBe(4);
    expect(s.rateLimitWaits).toBe(1);
    expect(c.slept[0]).toBeGreaterThan(55_000);
  });
});

describe("permanent answers are not failures", () => {
  it("returns null for 404 and 451 without recording a failure", async () => {
    for (const status of [404, 451]) {
      const c = harness(status);
      expect(await c.crawler.request("/x", { source: "s" })).toBeNull();
      const s = c.crawler.summarize().sources[0];
      expect(s.failures).toEqual([]);
      expect(s.requests).toBe(1);
      expect(s.ok).toBe(0);
    }
  });

  it("records a 422 as a failure the maintainer has to see", async () => {
    const c = harness(422);
    expect(await c.crawler.request("/x?a=1", { source: "s" })).toBeNull();
    expect(c.crawler.summarize().sources[0].failures[0]).toMatchObject({ status: 422, attempts: 1 });
  });
});

describe("the summary", () => {
  it("names incomplete sources and the records they affected", async () => {
    const c = harness([
      { status: 200, body: { items: [] } },
      500,
    ], { attemptCap: 1 });
    await c.crawler.request("/ok", { source: "repos:go" });
    c.crawler.countRecords("repos:go", 120);
    c.crawler.finish("repos:go", { got: 120 });
    await c.crawler.request("/bad", { source: "issues" });
    c.crawler.countRecords("issues", 40);
    c.crawler.finish("issues", { target: 100, got: 40 });

    const summary = c.crawler.summarize();
    expect(summary.totals).toMatchObject({ requests: 2, ok: 1, records: 160, failures: 1 });
    expect(summary.incomplete).toEqual(["issues"]);
    const issues = summary.sources.find((s: any) => s.source === "issues");
    expect(issues).toMatchObject({ records: 40, target: 100, complete: false });
    expect(issues.failures[0].path).toBe("/bad");
  });

  it("flags a source that finished short of its target with no failure at all", () => {
    const { crawler } = harness(200);
    crawler.finish("issues", { target: 40000, got: 12000 });
    expect(crawler.summarize().incomplete).toEqual(["issues"]);
  });

  it("marks a source complete when it hit its target", () => {
    const { crawler } = harness(200);
    crawler.finish("issues", { target: 40000, got: 40000 });
    expect(crawler.summarize().incomplete).toEqual([]);
  });

  it("prints the receipt as text, incomplete sources included", async () => {
    const c = harness(500, { attemptCap: 3 });
    await c.crawler.request("/repos/a/b/issues", { source: "issues" });
    c.crawler.countRecords("issues", 3);
    c.crawler.finish("issues", { target: 10, got: 3 });
    const text = c.crawler.formatSummary();
    expect(text).toContain("crawl report, per source");
    expect(text).toContain("issues");
    expect(text).toContain("INCOMPLETE sources: issues");
    expect(text).toMatch(/total 3 requests/);
    expect(text).toContain("2 retries");
  });

  it("splits sources by label rather than merging them into one bucket", async () => {
    const c = harness([{ status: 200, body: {} }]);
    await c.crawler.request("/a", { source: "repos:go" });
    await c.crawler.request("/b", { bucket: "search", source: "authors:rust" });
    expect(c.crawler.summarize().sources.map((s: any) => s.source)).toEqual(["authors:rust", "repos:go"]);
  });
});
