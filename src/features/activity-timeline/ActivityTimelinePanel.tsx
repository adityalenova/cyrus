"use client";

import { useState } from "react";

export interface ActivityTimelinePanelProps {
  className?: string;
  compact?: boolean;
}

export function ActivityTimelinePanel({ className = "", compact = false }: ActivityTimelinePanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  return (
    <section
      aria-label="activity-timeline"
      className={`rounded-2xl border border-hairline bg-card p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
            activity-timeline
          </span>
          <h3 className="text-base font-bold text-ink mt-0.5">
            Add chronological Activity Timeline feed to Dashboard Overview
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-1 rounded-full border border-hairline bg-surface text-xs font-semibold text-cocoa hover:text-ink cursor-pointer"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 pt-3 border-t border-hairline text-xs text-dim leading-relaxed">
          Interactive panel wired to <code className="font-mono text-ink">src/features/activity-timeline/model.ts</code>.
        </div>
      )}
    </section>
  );
}

export default ActivityTimelinePanel;
