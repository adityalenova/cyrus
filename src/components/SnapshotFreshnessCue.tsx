"use client"
/* ══ SnapshotFreshnessCue.tsx — visible freshness indicator for index snapshots ══ */
import { getSnapshotFreshness } from "@/lib/snapshotFreshness";

export function SnapshotFreshnessCue({
  generated,
  serverTime,
  compact = false,
  className = "",
}: {
  generated?: unknown;
  serverTime?: unknown;
  compact?: boolean;
  className?: string;
}) {
  const f = getSnapshotFreshness(generated, serverTime);

  const dotColor =
    f.status === "stale"
      ? "bg-honey"
      : f.status === "recent"
        ? "bg-leaf"
        : "bg-dim/50";

  const badgeColor =
    f.status === "stale"
      ? "bg-honey/10 border-honey/35 text-honey"
      : f.status === "recent"
        ? "bg-card border-line text-cocoa"
        : "bg-cream border-line text-dim";

  if (compact) {
    return (
      <span
        title={f.clarificationText}
        className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-0.5 border ${badgeColor} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden />
        {f.badgeText}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 flex-wrap text-[12px] ${className}`}>
      <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold rounded-full px-2.5 py-1 border ${badgeColor} shrink-0`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden />
        {f.badgeText}
      </span>
      <span className="text-dim text-[11.5px] leading-tight">
        {f.clarificationText}
      </span>
    </div>
  );
}
