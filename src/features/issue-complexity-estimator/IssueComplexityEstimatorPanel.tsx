"use client";

import { useState } from "react";

export interface IssueComplexityEstimatorPanelProps {
  className?: string;
  compact?: boolean;
}

export function IssueComplexityEstimatorPanel({ className = "", compact = false }: IssueComplexityEstimatorPanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  return (
    <section
      aria-label="issue-complexity-estimator"
      className={`rounded-2xl border border-hairline bg-card p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
            issue-complexity-estimator
          </span>
          <h3 className="text-base font-bold text-ink mt-0.5">
            Show Issue Complexity Estimator badges on Issue Finder cards
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
          Interactive panel wired to <code className="font-mono text-ink">src/features/issue-complexity-estimator/model.ts</code>.
        </div>
      )}
    </section>
  );
}

export default IssueComplexityEstimatorPanel;
