"use client";
/* ══ LeaderboardTable.tsx — sortable contributor leaderboard ═════════ */
import { useMemo, useState } from "react";

export interface Contributor {
  rank: number;
  username: string;
  avatarUrl: string;
  prs: number;
  issues: number;
  reviews: number;
  streak: number;
}

type SortKey = "prs" | "issues" | "reviews" | "streak";
type Period = "week" | "month" | "all";

interface LeaderboardTableProps {
  contributors: Contributor[];
  className?: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardTable({ contributors, className = "" }: LeaderboardTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("prs");
  const [period, setPeriod] = useState<Period>("all");

  const sorted = useMemo(
    () => [...contributors].sort((a, b) => b[sortBy] - a[sortBy]).map((c, i) => ({ ...c, rank: i + 1 })),
    [contributors, sortBy]
  );

  const headers: { key: SortKey; label: string }[] = [
    { key: "prs", label: "PRs" },
    { key: "issues", label: "Issues" },
    { key: "reviews", label: "Reviews" },
    { key: "streak", label: "Streak" },
  ];

  return (
    <div className={`bg-card rounded-2xl border border-line overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <h2 className="text-lg font-bold text-ink">Top Contributors</h2>
        <div className="flex gap-1">
          {(["week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                period === p ? "bg-coffee text-foam" : "text-cocoa hover:bg-line"
              }`}
            >
              {p === "all" ? "All time" : `This ${p}`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-5 py-2.5 text-cocoa/70 font-medium w-12">#</th>
              <th className="px-5 py-2.5 text-cocoa/70 font-medium">Contributor</th>
              {headers.map((h) => (
                <th key={h.key} className="px-5 py-2.5 text-right">
                  <button
                    onClick={() => setSortBy(h.key)}
                    className={`font-medium transition-colors ${
                      sortBy === h.key ? "text-coffee" : "text-cocoa/70 hover:text-ink"
                    }`}
                  >
                    {h.label} {sortBy === h.key && "↓"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.username} className="border-b border-line/50 hover:bg-line/30 transition-colors">
                <td className="px-5 py-3 text-center">
                  {c.rank <= 3 ? MEDALS[c.rank - 1] : <span className="text-cocoa/50">{c.rank}</span>}
                </td>
                <td className="px-5 py-3">
                  <a
                    href={`https://github.com/${c.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-ink hover:text-coffee transition-colors"
                  >
                    <img
                      src={c.avatarUrl}
                      alt={`${c.username}'s avatar`}
                      className="w-7 h-7 rounded-full"
                      loading="lazy"
                    />
                    <span className="font-medium">{c.username}</span>
                  </a>
                </td>
                {headers.map((h) => (
                  <td key={h.key} className="px-5 py-3 text-right tabular-nums text-cocoa">
                    {c[h.key].toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
