"use client";
/* ══ ApiUsageDashboard.tsx — API usage measured from real requests ═══════
   Level 3 #191. The contract that matters: never present generated or
   sample traffic as real API usage.

   This page has exactly one source of truth for "usage": the same-origin
   HTTP requests THIS browser makes when you press the probe control (or
   reload this page). Their status codes and wall-clock latency are real
   responses; they are kept in localStorage and bucketed by model.ts.

   The server-side primitives already in the repo (apiMetrics, the limiter
   singletons, apiKeyManager) are documented here honestly — what exists,
   whether any route actually records from them, and whether this browser
   can read them. They are NOT: apiMetrics.record is never called, the
   limiter is wired only to POST /api/reports, and no route emits
   x-ratelimit-* headers. So "server remaining now" is shown as unavailable,
   not charted. See README for the follow-up that would make it real.  ═ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { Card } from "@/lib/dash/shell";
import { btn, Chip, Word } from "@/components/ui";
import { useStored } from "@/lib/util";
import {
  API_KEY_LIFECYCLE_WIRED, ENDPOINT_LIMITS, PROBE_ENDPOINTS, SERVER_EMITS_RATELIMIT_HEADERS,
  SERVER_METRICS_WIRED, breakdownByEndpoint, bucketize, countInWindow, isProbeable, limitState,
  summarize, toCsv, type EndpointBreakdown, type Granularity, type LimitState, type RequestRecord,
} from "./model";
import { BarChart } from "./BarChart";

const W = "max-w-[1240px] mx-auto px-6";
const LOG_KEY = "cyrus.apiUsage.log.v1";
const LOG_CAP = 500;
const HEADER_ALLOWLIST = ["retry-after", "cache-control", "content-type", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"];

const GRANS: Granularity[] = ["hour", "day", "week"];
const asGranularity = (v: string | null): Granularity => (v === "day" || v === "week" ? v : "hour");

const micro = "font-mono text-[10.5px] uppercase tracking-[.14em] text-dim";
const stateTone: Record<LimitState, "green" | "stars" | "purple" | "blue" | ""> = {
  ok: "green", approaching: "stars", reached: "purple", unknown: "blue",
};
const stateLabel: Record<LimitState, string> = {
  ok: "within limit", approaching: "approaching", reached: "at limit", unknown: "not limited in code",
};

function pickHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of HEADER_ALLOWLIST) {
    const v = h.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* A request's own provenance tag, shown next to every live number. */
function ProvTag({ fromBrowser = true }: { fromBrowser?: boolean }) {
  return (
    <span className={micro + " before:content-['·'] before:text-rule before:mr-1.5"}>
      {fromBrowser ? "recorded in this browser" : "read from route source"}
    </span>
  );
}

export default function ApiUsageDashboard() {
  const [log, setLog, ready] = useStored<RequestRecord[]>(LOG_KEY, []);
  const [params, setParams] = useSearchParams();
  const g = asGranularity(params.get("bucket"));
  const [probePath, setProbePath] = useState<string>(PROBE_ENDPOINTS[0].path);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RequestRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // a single snapshot "now" for the trailing-window maths, refreshed whenever
  // the log changes or the reader re-measures.
  const [nonce, setNonce] = useState(0);
  const now = useMemo(() => Date.now(), [log, nonce]);
  const nowLabel = useMemo(() => new Date(now).toISOString().slice(0, 19).replace("T", " ") + " UTC", [now]);

  useEffect(() => { if (confirmClear) { const t = setTimeout(() => setConfirmClear(false), 5000); return () => clearTimeout(t); } }, [confirmClear]);

  const canProbe = isProbeable(probePath);

  async function runProbe() {
    if (!canProbe || busy) return;
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await fetch(probePath, { method: "GET", credentials: "same-origin", cache: "no-store" });
      const record: RequestRecord = {
        id: newId(), endpoint: probePath, method: "GET", status: res.status, ok: res.ok,
        durationMs: Math.max(0, Math.round(performance.now() - t0)), ts: Date.now(), headers: pickHeaders(res.headers),
      };
      setLog((cur) => [...cur, record].slice(-LOG_CAP));
      setLast(record);
    } catch {
      const record: RequestRecord = {
        id: newId(), endpoint: probePath, method: "GET", status: 0, ok: false,
        durationMs: Math.max(0, Math.round(performance.now() - t0)), ts: Date.now(), headers: {},
      };
      setLog((cur) => [...cur, record].slice(-LOG_CAP));
      setLast(record);
    } finally {
      setBusy(false);
    }
  }

  function setGranularity(next: Granularity) {
    const p = new URLSearchParams(params);
    p.set("bucket", next);
    setParams(p);
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(log)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cyrus-api-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const summary = summarize(log);
  const buckets = bucketize(log, g);
  const rows: EndpointBreakdown[] = breakdownByEndpoint(log);

  // alert lines: real 4xx/5xx the browser just saw + this-browser window state
  const alerts = ENDPOINT_LIMITS.map((l) => {
    const c = countInWindow(log, l.endpoint, l.method, l.windowMs, now);
    return { l, c, state: limitState(c, l.limit) };
  }).filter((a) => a.state === "approaching" || a.state === "reached");

  const observedKeys = new Set(log.map((r) => `${r.method} ${r.endpoint}`));
  const statusLine = last
    ? last.status === 0
      ? `${last.method} ${last.endpoint} did not complete (network error) after ${last.durationMs} ms.`
      : `${last.method} ${last.endpoint} returned HTTP ${last.status} in ${last.durationMs} ms.`
    : "No request sent from this page yet.";

  return (
    <div className={`${W} pt-14 pb-16`}>
      <p className={micro}>
        <Link to="/platform/features" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span> <span className="text-cocoa">API usage</span>
      </p>

      <header className="reveal mt-3 mb-8">
        <h1 className="font-display font-extrabold text-[clamp(30px,4.2vw,48px)] leading-[1.05] tracking-[-.03em] max-w-[820px]">
          API usage, <Word>measured</Word> from real requests.
        </h1>
        <p className="card-desc mt-3 max-w-[680px] text-[15px]">
          This dashboard only shows what this browser can genuinely observe. Every number names its
          source: requests you send from this page, limits transcribed from the route source, or an
          explicit "not observable" where the server cannot be read. Nothing here is simulated traffic.
        </p>
      </header>

      {/* ── probe + provenance ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6">
        <Card className="reveal" style={{ animationDelay: "40ms" }}>
          <p className="eyebrow">Measure a real request</p>
          <h2 className="panel-h-lg">Send a same-origin probe</h2>
          <p className="card-desc mt-1">
            Picks a cheap, public, read-only GET endpoint, issues one real request, and records the
            actual HTTP status and latency in this browser.
          </p>

          <div className="mt-4 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
            <div>
              <label htmlFor="probe-endpoint" className={micro + " block mb-1.5"}>Endpoint (read-only GET)</label>
              <select
                id="probe-endpoint"
                value={probePath}
                onChange={(e) => setProbePath(e.target.value)}
                className="w-full bg-card border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-accent"
              >
                {PROBE_ENDPOINTS.map((p) => (
                  <option key={p.path} value={p.path}>{p.label}</option>
                ))}
              </select>
              <p className="text-cocoa text-[12px] mt-1.5">
                {PROBE_ENDPOINTS.find((p) => p.path === probePath)?.note}
              </p>
            </div>
            <button className={btn("primary", "md")} onClick={runProbe} disabled={busy || !canProbe} aria-busy={busy}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-dashed border-line" role="status" aria-live="polite">
            <span className={micro + " mr-2"}>Last request</span>
            <span className="text-[13px] text-ink">{ready ? statusLine : "Reading this browser’s history…"}</span>
            {last && last.headers["retry-after"] && (
              <span className="text-cocoa text-[12px] ml-2">Retry-After: {last.headers["retry-after"]}s (response header)</span>
            )}
          </div>

          {last && last.status >= 400 && (
            <div role="alert" className="mt-3 rounded-[10px] border border-brick/40 bg-brick/8 px-3.5 py-2.5">
              <p className="text-brick text-[13px] font-semibold">HTTP {last.status === 0 ? "request failed" : last.status} on {last.endpoint}</p>
              <p className="card-desc mt-0.5">This is a real response for that request, recorded in this browser. It is not a rate-limit reading of the server unless the body says so.</p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button className={btn(confirmClear ? "primary" : "ghost", "sm")} onClick={() => (confirmClear ? (setLog([]), setLast(null), setConfirmClear(false)) : setConfirmClear(true))}>
              {confirmClear ? "Confirm clear this browser’s log" : "Clear recorded requests"}
            </button>
            <button className={btn("ghost", "sm")} onClick={() => setNonce((n) => n + 1)}>Re-measure window</button>
            <span className={micro + " ml-auto"}>as of {nowLabel}</span>
          </div>
        </Card>

        <Card className="reveal" style={{ animationDelay: "90ms" }}>
          <p className="eyebrow">Provenance of every figure</p>
          <ul className="mt-2 grid gap-3 text-[13px]">
            <li className="flex gap-2.5"><span className="mt-1 w-[7px] h-[7px] rounded-full bg-accent shrink-0" aria-hidden /><span><b>Recorded in this browser.</b> <span className="text-cocoa">Real status + latency from requests this page issued. Survives reloads, but only your own traffic and only on this device.</span></span></li>
            <li className="flex gap-2.5"><span className="mt-1 w-[7px] h-[7px] rounded-full bg-denim shrink-0" aria-hidden /><span><b>Read from route source.</b> <span className="text-cocoa">The configured per-endpoint limits are transcribed from the route files in this build — static facts, not live counts.</span></span></li>
            <li className="flex gap-2.5"><span className="mt-1 w-[7px] h-[7px] rounded-full bg-brick shrink-0" aria-hidden /><span><b>Not observable.</b> <span className="text-cocoa">Server "remaining now", cross-user totals and API-key state. Shown as unavailable, never guessed.</span></span></li>
          </ul>
          <p className="mt-4 pt-3 border-t border-dashed border-line text-cocoa text-[12.5px]">
            Totals below come only from <b>{summary.total}</b> request{summary.total === 1 ? "" : "s"} this browser recorded
            {summary.from !== null && summary.to !== null
              ? <> between {new Date(summary.from).toISOString().slice(0, 10)} and {new Date(summary.to).toISOString().slice(0, 10)}</>
              : " yet"}.
          </p>
        </Card>
      </div>

      {/* ── server primitives: what is wired ───────────────────────── */}
      <Card className="reveal mt-6" style={{ animationDelay: "120ms" }}>
        <p className="eyebrow">Reuse, not reinvent</p>
        <h2 className="panel-h-lg">What the server already ships — and whether it is wired</h2>
        <p className="card-desc mt-1">Found in the existing source and reused here. The honest column is whether a real request feeds it.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="text-left card-desc pb-2">Existing rate-limit, metrics and key primitives in this repo.</caption>
            <thead>
              <tr className="border-b border-line text-dim">
                <th scope="col" className="text-left py-2 pr-3 font-mono text-[10.5px] uppercase tracking-[.1em]">Primitive</th>
                <th scope="col" className="text-left py-2 px-3 font-mono text-[10.5px] uppercase tracking-[.1em]">In code</th>
                <th scope="col" className="text-left py-2 px-3 font-mono text-[10.5px] uppercase tracking-[.1em]">Wired to live requests?</th>
                <th scope="col" className="text-left py-2 pl-3 font-mono text-[10.5px] uppercase tracking-[.1em]">Readable from here?</th>
              </tr>
            </thead>
            <tbody>
              <PrimRow name="rateLimit() — src/lib/rateLimit.ts" exists="Yes" wired="No — imported by no route" readable="No" note="In-memory sliding window; currently dead code." />
              <PrimRow name="slidingRateLimiter — src/lib/server/slidingRateLimit.ts" exists="Yes" wired="Partly — only POST /api/reports" readable="No" note="Shared key “pdf-reports”; no route exposes its counters." />
              <PrimRow name="apiMetrics.record/getSummary — src/lib/server/apiMetrics.ts" exists="Yes" wired="No — record() is never called" readable="No" note="Per-instance, would reset on cold start even if wired." />
              <PrimRow name="apiKeyManager generate/hash/verify — src/lib/server/apiKeyManager.ts" exists="Crypto only" wired="No — no store, route, or auth path" readable="n/a" note="Sessions use httpOnly JWT cookies, not API keys." />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-cocoa text-[12.5px]">
          Live server metrics exposed to the browser: <Chip tone={SERVER_METRICS_WIRED ? "green" : "purple"}>{SERVER_METRICS_WIRED ? "available" : "not wired"}</Chip> ·{" "}
          x-ratelimit-* response headers: <Chip tone={SERVER_EMITS_RATELIMIT_HEADERS ? "green" : "purple"}>{SERVER_EMITS_RATELIMIT_HEADERS ? "emitted" : "not emitted by any route"}</Chip>
        </p>
      </Card>

      {/* ── alerts approaching limits ──────────────────────────────── */}
      <section className="reveal mt-6" aria-label="Threshold alerts" style={{ animationDelay: "150ms" }}>
        {alerts.length === 0 ? (
          <div role="status" className="rounded-[14px] border border-line bg-card px-5 py-4">
            <p className="text-[13px] text-ink">No threshold alerts.</p>
            <p className="card-desc mt-0.5">No endpoint’s this-browser request count has reached 75% of its configured window limit.</p>
          </div>
        ) : (
          <div role="alert" className="rounded-[14px] border border-honey/40 bg-honey/8 px-5 py-4">
            <p className="text-[13px] font-semibold text-ink">Approaching a configured limit (this browser only)</p>
            <ul className="mt-2 grid gap-1.5 text-[12.5px] text-cocoa">
              {alerts.map((a) => (
                <li key={`${a.l.method} ${a.l.endpoint}`}>
                  <b>{a.l.method} {a.l.endpoint}</b>: {a.c} of {a.l.limit} requests by this browser in the {Math.round(a.l.windowMs / 1000)}s window — {stateLabel[a.state]}.
                  {a.l.scope === "shared-key" && " This endpoint’s real limiter is shared across the whole server instance, so total usage is higher than what this browser can see."}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── rate-limit status per endpoint ─────────────────────────── */}
      <Card className="reveal mt-6" style={{ animationDelay: "170ms" }}>
        <p className="eyebrow">Rate-limit status</p>
        <h2 className="panel-h-lg">Per endpoint — configured vs this-browser</h2>
        <p className="card-desc mt-1">
          The server’s live "remaining now" cannot be read: no route emits x-ratelimit-* headers and the limiter store is not exposed.
          So the columns are the configured limit (from source) and how many times <em>this browser</em> requested it in the window.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="text-left card-desc pb-2">Window as of {nowLabel}. "This-browser" counts are a lower bound on true load.</caption>
            <thead>
              <tr className="border-b border-line text-dim">
                <th scope="col" className="text-left py-2 pr-3 font-mono text-[10.5px] uppercase tracking-[.1em]">Endpoint</th>
                <th scope="col" className="text-left py-2 px-3 font-mono text-[10.5px] uppercase tracking-[.1em]">Configured limit (source)</th>
                <th scope="col" className="text-right py-2 px-3 font-mono text-[10.5px] uppercase tracking-[.1em]">This browser / window</th>
                <th scope="col" className="text-left py-2 px-3 font-mono text-[10.5px] uppercase tracking-[.1em]">Server remaining now</th>
                <th scope="col" className="text-left py-2 pl-3 font-mono text-[10.5px] uppercase tracking-[.1em]">This-browser state</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINT_LIMITS.map((l) => {
                const c = countInWindow(log, l.endpoint, l.method, l.windowMs, now);
                const st = limitState(c, l.limit);
                return (
                  <tr key={`${l.method} ${l.endpoint}`} className="border-b border-line/60 last:border-0 align-top">
                    <th scope="row" className="text-left py-2 pr-3 font-mono text-[11.5px] text-ink font-normal">
                      {l.method} {l.endpoint}
                      <span className={micro + " block font-normal"}>scope: {l.scope.replace("-", " ")}</span>
                    </th>
                    <td className="py-2 px-3">
                      <span className="font-mono text-ink">{l.limit}</span> / {Math.round(l.windowMs / 1000)}s
                      <span className={micro + " block"} title={l.source}>read from route source</span>
                    </td>
                    <td className="text-right py-2 px-3 font-mono">{c}<span className={micro + " block font-normal"}>this browser</span></td>
                    <td className="py-2 px-3"><Chip tone="purple">not observable</Chip></td>
                    <td className="py-2 pl-3"><Chip tone={stateTone[st]}>{stateLabel[st]}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-cocoa text-[12.5px]">
          Endpoints with no limiter in the current source (e.g. GET /api/health, GET /api/me) are genuinely <em>not limited in code</em> — that state is a fact about this build, not a measurement.
        </p>
      </Card>

      {/* ── usage over time ────────────────────────────────────────── */}
      <Card className="reveal mt-6" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">Usage over time</p>
            <h2 className="panel-h-lg">Requests by {g === "hour" ? "hour" : g === "day" ? "day" : "week"} (UTC)</h2>
          </div>
          <div role="group" aria-label="Bucket size" className="flex gap-1.5">
            {GRANS.map((option) => (
              <button key={option} onClick={() => setGranularity(option)} aria-pressed={g === option}
                className={btn(g === option ? "primary" : "ghost", "sm")}>
                {option}
              </button>
            ))}
          </div>
        </div>
        <p className="card-desc mt-1">
          Counts are requests this browser recorded; interior empty {g === "hour" ? "hours" : g === "day" ? "days" : "weeks"} are shown as real zeros, not hidden.
          {buckets.length > 0 && <> Span: {buckets[0].label} → {buckets[buckets.length - 1].label}.</>}
        </p>
        <div className="mt-4">
          {ready && log.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-line px-5 py-10 text-center">
              <p className="card-title mb-1">No requests recorded in this browser yet</p>
              <p className="card-desc max-w-[460px] mx-auto">
                Send a probe above, or browse the app — this chart fills only with real requests <em>this browser</em> made. It never shows sample traffic.
              </p>
            </div>
          ) : (
            <BarChart buckets={buckets} summary={`${g}ly, recorded in this browser`} />
          )}
        </div>
      </Card>

      {/* ── breakdown by endpoint ──────────────────────────────────── */}
      <Card className="reveal mt-6" style={{ animationDelay: "230ms" }}>
        <p className="eyebrow">Breakdown by endpoint</p>
        <h2 className="panel-h-lg">What this browser actually called</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="text-left card-desc pb-2">
              <ProvTag /> — latencies are wall-clock ms measured around each fetch in this browser (p50/p95 nearest-rank).
            </caption>
            <thead>
              <tr className="border-b border-line text-dim">
                {["Endpoint", "Requests", "Errors", "Error rate", "p50 ms", "p95 ms", "Last status"].map((h) => (
                  <th key={h} scope="col" className={`py-2 px-3 font-mono text-[10.5px] uppercase tracking-[.1em] ${h === "Endpoint" ? "text-left" : "text-right"} first:pl-0`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-dim">No endpoint activity recorded in this browser yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={`${r.method} ${r.endpoint}`} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="text-left py-2 pl-0 pr-3 font-mono text-[11.5px] text-ink font-normal">
                    {r.method} {r.endpoint}
                    {observedKeys.has(`${r.method} ${r.endpoint}`) && r.configuredLimit && <span className={micro + " block font-normal"}>limited in code</span>}
                  </th>
                  <td className="text-right font-mono py-2 px-3">{r.count}</td>
                  <td className={`text-right font-mono py-2 px-3 ${r.errors ? "text-brick" : "text-dim"}`}>{r.errors}</td>
                  <td className="text-right font-mono py-2 px-3">{Math.round(r.errorRate * 100)}%</td>
                  <td className="text-right font-mono py-2 px-3">{r.p50Ms}</td>
                  <td className="text-right font-mono py-2 px-3">{r.p95Ms}</td>
                  <td className="text-right font-mono py-2 pl-3">
                    <Chip tone={r.lastStatus >= 400 ? "purple" : r.lastStatus === 0 ? "stars" : "green"}>{r.lastStatus === 0 ? "failed" : r.lastStatus}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-cocoa text-[12.5px]">
          Error rate {Math.round(summary.errorRate * 100)}% · {summary.errors} of {summary.total} request{summary.total === 1 ? "" : "s"} returned HTTP 4xx/5xx · avg {summary.avgMs} ms. All recorded in this browser.
        </p>
      </Card>

      {/* ── API key management ─────────────────────────────────────── */}
      <Card className="reveal mt-6" style={{ animationDelay: "260ms" }}>
        <p className="eyebrow">API keys</p>
        <h2 className="panel-h-lg">Key management is not wired — so this page does not fake it</h2>
        <div role="status" className="mt-2 rounded-[12px] border border-line bg-cream/40 px-4 py-3.5 text-[13px] text-cocoa">
          <p>
            <b>Generate / revoke / rotate are unavailable.</b> The repo has hashing helpers in{" "}
            <code className="font-mono text-[12px]">src/lib/server/apiKeyManager.ts</code> (generate, hash, verify), but there is{" "}
            <b>no key store, no key table, no route, and no request path that reads an API key.</b> Authentication here is a
            stateless httpOnly JWT session cookie (<code className="font-mono text-[12px]">src/lib/server/auth.ts</code>), which
            this dashboard deliberately does not touch.
          </p>
          <p className="mt-2">
            Because the lifecycle is not end-to-end, there is nothing real to surface, so no key panel is offered — building one
            would present fake API usage. {API_KEY_LIFECYCLE_WIRED ? "Keys are wired." : "Flagged: API_KEY_LIFECYCLE_WIRED = false."}
          </p>
        </div>
      </Card>

      {/* ── downloadable report ────────────────────────────────────── */}
      <Card className="reveal mt-6" style={{ animationDelay: "290ms" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">Download</p>
            <h2 className="panel-h-lg">Usage report (CSV)</h2>
            <p className="card-desc mt-1">
              Exports only the requests this browser recorded, one row per real request, each carrying its own
              "recorded in this browser" provenance column. It is not a server-side usage statement.
            </p>
          </div>
          <button className={btn("outline", "md")} onClick={downloadCsv} disabled={log.length === 0}>
            Download {log.length ? `${log.length} record${log.length === 1 ? "" : "s"}` : "CSV"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function PrimRow({ name, exists, wired, readable, note }: { name: string; exists: string; wired: string; readable: string; note: string }) {
  const wiredNo = wired.toLowerCase().startsWith("no");
  return (
    <tr className="border-b border-line/60 last:border-0 align-top">
      <th scope="row" className="text-left py-2 pr-3 font-mono text-[11.5px] text-ink font-normal">{name}</th>
      <td className="py-2 px-3"><Chip tone={exists.startsWith("Yes") ? "green" : "blue"}>{exists}</Chip></td>
      <td className="py-2 px-3"><Chip tone={wiredNo ? "purple" : "stars"}>{wired}</Chip></td>
      <td className="py-2 pl-3 text-cocoa">{readable}<span className={micro + " block"}>{note}</span></td>
    </tr>
  );
}
