"use client";
/* ══ BarChart.tsx — a hand-rolled SVG column chart + its table twin ════
   No chart library. Every bar gets a <title>, the SVG is labelled with a
   one-line summary, and the same numbers are always rendered as a real
   <table> below it — that table is the required text alternative, so the
   chart never holds information that a screen reader or a plain-text reader
   cannot reach. Counts and errors are the browser's own recorded requests. */
import type { Bucket } from "./model";

const H = 150;
const TOP = 12;
const BASE = H - 22; // leave room for the axis + labels
const PLOT = BASE - TOP;

const rise = (i: number) => ({ animationDelay: `${Math.min(i, 12) * 40}ms` });

export function BarChart({ buckets, summary }: { buckets: Bucket[]; summary: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const step = 100 / Math.max(1, buckets.length);
  const barW = step * 0.62;

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          role="img"
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="w-full min-w-[520px] h-[150px] reveal"
          style={{ height: H }}
          aria-label={`Requests recorded in this browser, ${summary}. A full table of these values follows.`}
        >
          {/* baseline */}
          <line x1="0" y1={BASE} x2="100" y2={BASE} stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          {buckets.map((b, i) => {
            const x = i * step + (step - barW) / 2;
            const totalH = (b.count / max) * PLOT;
            const errH = b.count ? (b.errors / b.count) * totalH : 0;
            const okH = totalH - errH;
            return (
              <g key={b.start} className="reveal" style={rise(i)}>
                {okH > 0 && (
                  <rect x={x} y={BASE - totalH} width={barW} height={okH} rx="0.6" fill="var(--color-accent, #22c55e)" className="grow-bar" style={{ transformOrigin: `${x}px ${BASE}px` }}>
                    <title>{`${b.label}: ${b.count} request${b.count === 1 ? "" : "s"}, ${b.errors} error${b.errors === 1 ? "" : "s"}, avg ${b.avgMs} ms`}</title>
                  </rect>
                )}
                {errH > 0 && (
                  <rect x={x} y={BASE - totalH} width={barW} height={errH} rx="0.6" fill="var(--color-brick, #ef4444)">
                    <title>{`${b.label}: ${b.errors} error response${b.errors === 1 ? "" : "s"}`}</title>
                  </rect>
                )}
                {b.count === 0 && (
                  <rect x={x} y={BASE - 1} width={barW} height="1" fill="currentColor" fillOpacity="0.15">
                    <title>{`${b.label}: no requests recorded`}</title>
                  </rect>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[.14em] text-dim mt-1 mb-2">Table alternative</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <caption className="text-left text-dim card-desc pb-2">
            Requests this browser recorded per {buckets.length ? "" : ""}period, with errors and average latency.
          </caption>
          <thead>
            <tr className="border-b border-line text-dim">
              <th scope="col" className="text-left font-mono text-[10.5px] uppercase tracking-[.1em] py-1.5 pr-3">Period</th>
              <th scope="col" className="text-right font-mono text-[10.5px] uppercase tracking-[.1em] py-1.5 px-3">Requests</th>
              <th scope="col" className="text-right font-mono text-[10.5px] uppercase tracking-[.1em] py-1.5 px-3">Errors</th>
              <th scope="col" className="text-right font-mono text-[10.5px] uppercase tracking-[.1em] py-1.5 pl-3">Avg ms</th>
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-dim">No requests recorded yet.</td></tr>
            ) : (
              buckets.map((b) => (
                <tr key={b.start} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="text-left font-mono text-[11.5px] text-cocoa font-normal py-1.5 pr-3">{b.label}</th>
                  <td className="text-right font-mono py-1.5 px-3">{b.count}</td>
                  <td className={`text-right font-mono py-1.5 px-3 ${b.errors ? "text-brick" : "text-dim"}`}>{b.errors}</td>
                  <td className="text-right font-mono py-1.5 pl-3">{b.avgMs}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
