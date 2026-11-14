/* ══ scripts/lib/crawl-request.mjs — the crawl's rate limiting, with receipts ══
   scripts/crawl-github.mjs already respected the two GitHub budgets and already
   backed off on a 403 or a 429. What it could not tell you afterwards was
   whether a phase finished or quietly gave up: every failure path returned the
   same `null`, so a snapshot with three sources skipped read exactly like a
   snapshot that had crawled everything.

   This module keeps the same discipline and records what it did while doing it.

     createCrawler({ fetchImpl, sleep, now, headers })
       .request(path, { bucket, source })   ->  parsed body | null
       .countRecords(source, n)             ->  records written for that source
       .finish(source, { target, got })     ->  marks the source's outcome
       .summarize()                         ->  per-source receipt
       .formatSummary()                     ->  the same receipt as text

   What is counted, per `source` label:

     requests        attempts actually sent
     ok              responses that carried a body forward
     retries         attempts after the first that were caused by a failure
     retryStatus     which statuses caused them, so a 502 streak is visible
     rateLimitWaits  how often the crawler slept because GitHub said to
     rateLimitMs     total milliseconds slept, from headers when present
     failures        last status and attempt count of everything it gave up on
     records         rows the caller stored for that source

   Two knobs bound the waits so a bad header cannot park a scheduled job
   overnight: `waitCap` for a single rate-limit sleep and `attemptCap` for how
   many tries a request gets. `backoff(attempt)` is exponential and capped, used
   for transient failures where GitHub gave no reset to wait for.
                                                              ═ */

const GITHUB_DATE = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
};

export function createCrawler(options = {}) {
  const {
    fetchImpl = (url, init) => globalThis.fetch(url, init),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
    baseUrl = "https://api.github.com",
    headers = () => ({}),
    attemptCap = 6,
    backoffBase = 5_000,
    backoffCap = 60_000,
    waitCap = 10 * 60_000,
    searchPerMinute = 28,
    coreFloor = 50,
    minute = 60_000,
  } = options;

  /** @type {Map<string, any>} */
  const sources = new Map();
  const searchWindow = [];
  const state = { coreRemaining: null, coreResetAt: 0 };

  const row = (label) => {
    let r = sources.get(label);
    if (!r) {
      r = {
        source: label, requests: 0, ok: 0, retries: 0, retryStatus: {},
        rateLimitWaits: 0, rateLimitMs: 0, failures: [], records: 0,
        target: null, complete: null, gaveUpAt: null,
      };
      sources.set(label, r);
    }
    return r;
  };

  const noteRetry = (r, status) => {
    r.retries += 1;
    const key = String(status);
    r.retryStatus[key] = (r.retryStatus[key] ?? 0) + 1;
  };

  const backoff = (attempt) => Math.min(backoffCap, backoffBase * 2 ** (attempt - 1));

  /** how long GitHub said to wait, from its headers, capped, or null */
  const headerWait = (res) => {
    const retryAfter = quotaNumber(res, "retry-after");
    if (retryAfter !== null && retryAfter > 0) return Math.min(waitCap, retryAfter * 1000);
    const reset = GITHUB_DATE(quotaNumber(res, "x-ratelimit-reset"));
    if (reset !== null) {
      const wait = reset - now() + 2_000;
      if (wait > 0) return Math.min(waitCap, wait);
    }
    return null;
  };

  /** wait for budget before a request; counted against the source that waited */
  async function gate(bucket, r) {
    if (bucket === "search") {
      const cutoff = now() - minute;
      while (searchWindow.length && searchWindow[0] <= cutoff) searchWindow.shift();
      if (searchWindow.length >= searchPerMinute) {
        const wait = Math.min(waitCap, minute - (now() - searchWindow[0]) + 500);
        r.rateLimitWaits += 1; r.rateLimitMs += wait;
        await sleep(wait);
        return gate(bucket, r);
      }
      searchWindow.push(now());
      return;
    }
    if (state.coreRemaining !== null && state.coreRemaining < coreFloor && now() < state.coreResetAt) {
      const wait = Math.min(waitCap, state.coreResetAt - now() + 2_000);
      r.rateLimitWaits += 1; r.rateLimitMs += wait;
      await sleep(wait);
    }
  }

  /* GitHub sends the quota headers on the core API but not on every response,
     and a missing one is silence, not zero: Number(null) is 0, which would read
     as "no budget left" and park the crawl in a wait for a reset that already
     passed. Absent or unparsable values leave the last known number in place. */
  const quotaNumber = (res, name) => {
    const raw = res.headers?.get?.(name);
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  function readQuota(res) {
    const remaining = quotaNumber(res, "x-ratelimit-remaining");
    if (remaining !== null) state.coreRemaining = remaining;
    const reset = GITHUB_DATE(quotaNumber(res, "x-ratelimit-reset"));
    if (reset !== null) state.coreResetAt = reset;
  }

  /**
   * @param {string} path
   * @param {{ bucket?: "core"|"search", source?: string }} [meta]
   * @returns {Promise<any|null>} the decoded body, or null when this call gave up
   */
  async function request(path, meta = {}) {
    const { bucket = "core" } = meta;
    const r = row(meta.source ?? bucket);
    let lastStatus = "network";

    for (let attempt = 1; attempt <= attemptCap; attempt++) {
      await gate(bucket, r);
      let res;
      r.requests += 1;
      try {
        res = await fetchImpl(`${baseUrl}${path}`, { headers: headers() });
      } catch {
        if (attempt === attemptCap) return giveUp(r, path, "network", attempt);
        noteRetry(r, "network");
        await sleep(backoff(attempt));
        continue;
      }

      readQuota(res);
      lastStatus = res.status;

      if (res.ok) {
        try {
          const body = await res.json();
          r.ok += 1;
          return body;
        } catch {
          if (attempt === attemptCap) return giveUp(r, path, "bad-body", attempt);
          noteRetry(r, "bad-body");
          await sleep(backoff(attempt));
          continue;
        }
      }

      // gone, private or legally blocked: a permanent answer, not a failure
      if (res.status === 404 || res.status === 451) return null;

      const rateLimited = res.status === 403 || res.status === 429;
      const transient = res.status >= 500;
      if (!rateLimited && !transient) return giveUp(r, path, res.status, attempt);

      if (attempt === attemptCap) return giveUp(r, path, res.status, attempt);

      noteRetry(r, res.status);
      if (rateLimited) {
        const wait = headerWait(res) ?? backoff(attempt);
        r.rateLimitWaits += 1; r.rateLimitMs += wait;
        await sleep(wait);
      } else {
        await sleep(backoff(attempt));
      }
    }

    return giveUp(r, path, lastStatus, attemptCap);
  }

  function giveUp(r, path, status, attempts) {
    r.failures.push({ path, status, attempts });
    r.gaveUpAt = path;
    return null;
  }

  /**
   * What the caller stored, and whether the source reached the number it set
   * out to collect. A source that finished short of its target is incomplete
   * even when nothing failed, because that is how a partial snapshot hides.
   *
   * @param {string} label
   * @param {{ target?: number | null, got?: number | null }} [outcome]
   */
  function finish(label, outcome = {}) {
    const { target = null, got = null } = outcome;
    const r = row(label);
    if (target !== null) r.target = target;
    if (got !== null) r.complete = got >= (target ?? got) && r.failures.length === 0;
    else r.complete = r.failures.length === 0;
    return r;
  }

  /** @param {string} label @param {number} n */
  function countRecords(label, n) {
    row(label).records += n;
  }

  function summarize() {
    const list = [...sources.values()].sort((a, b) => a.source.localeCompare(b.source));
    return {
      generatedAt: new Date(now()).toISOString(),
      coreRemaining: state.coreRemaining,
      totals: list.reduce(
        (t, s) => ({
          requests: t.requests + s.requests,
          ok: t.ok + s.ok,
          retries: t.retries + s.retries,
          rateLimitWaits: t.rateLimitWaits + s.rateLimitWaits,
          rateLimitSeconds: t.rateLimitSeconds + Math.round(s.rateLimitMs / 1000),
          failures: t.failures + s.failures.length,
          records: t.records + s.records,
        }),
        { requests: 0, ok: 0, retries: 0, rateLimitWaits: 0, rateLimitSeconds: 0, failures: 0, records: 0 },
      ),
      incomplete: list.filter((s) => s.complete === false).map((s) => s.source),
      sources: list,
    };
  }

  /** the receipt as text, for the end of a run's stdout */
  function formatSummary(summary = summarize()) {
    const lines = ["crawl report, per source:"];
    const pad = (s, n) => String(s).padEnd(n);
    lines.push(`  ${pad("source", 18)}${pad("req", 7)}${pad("ok", 7)}${pad("retry", 7)}${pad("waits", 7)}${pad("slept", 8)}${pad("records", 9)}outcome`);
    for (const s of summary.sources) {
      const outcome = s.complete === null
        ? "unfinished"
        : s.complete ? "complete" : `incomplete (${s.failures.length} failed)${s.gaveUpAt ? ` last at ${s.gaveUpAt}` : ""}`;
      lines.push(
        `  ${pad(s.source, 18)}${pad(s.requests, 7)}${pad(s.ok, 7)}${pad(s.retries, 7)}` +
        `${pad(s.rateLimitWaits, 7)}${pad(`${(s.rateLimitMs / 1000).toFixed(0)}s`, 8)}` +
        `${pad(s.records, 9)}${outcome}`,
      );
    }
    const t = summary.totals;
    lines.push(`  total ${t.requests} requests, ${t.retries} retries, ${t.rateLimitWaits} rate-limit waits (${t.rateLimitSeconds}s slept), ${t.failures} failures, ${t.records} records`);
    if (summary.incomplete.length) lines.push(`  INCOMPLETE sources: ${summary.incomplete.join(", ")}`);
    return lines.join("\n");
  }

  return { request, finish, countRecords, summarize, formatSummary, state, sources };
}
