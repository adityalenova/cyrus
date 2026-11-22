"use client";

import { useState } from "react";
import { Link } from "@/lib/router";

export interface AchievementBadge {
  id: string;
  title: string;
  subtitle: string;
  category: "contribution" | "code" | "community" | "speed" | "special";
  iconType: string;
  unlocked: boolean;
  unlockedDate?: string;
  progress?: { current: number; total: number };
  theme: "blue" | "emerald" | "amber" | "purple" | "rose" | "cyan" | "gold";
}

export const TWENTY_BADGES: AchievementBadge[] = [
  {
    id: "gremlin",
    title: "Gremlin",
    subtitle: "Do commits this late even count?",
    category: "special",
    iconType: "owl",
    unlocked: true,
    unlockedDate: "Nov 21, 2026",
    theme: "blue",
  },
  {
    id: "first-blood",
    title: "First Blood",
    subtitle: "Merged your very first upstream pull request.",
    category: "contribution",
    iconType: "sword",
    unlocked: true,
    unlockedDate: "Oct 12, 2026",
    theme: "rose",
  },
  {
    id: "bug-hunter",
    title: "Bug Stalker",
    subtitle: "Found and documented 5 confirmed issues.",
    category: "contribution",
    iconType: "bug",
    unlocked: true,
    unlockedDate: "Nov 02, 2026",
    theme: "emerald",
  },
  {
    id: "pr-machine",
    title: "PR Machine",
    subtitle: "10 pull requests merged in a single calendar month.",
    category: "code",
    iconType: "gear",
    unlocked: true,
    unlockedDate: "Nov 19, 2026",
    theme: "cyan",
  },
  {
    id: "review-maestro",
    title: "Review Maestro",
    subtitle: "Conducted 20 thoughtful, constructive PR reviews.",
    category: "community",
    iconType: "glasses",
    unlocked: false,
    progress: { current: 14, total: 20 },
    theme: "purple",
  },
  {
    id: "speed-demon",
    title: "Speed Demon",
    subtitle: "Claimed, coded, and landed an issue in under 90 minutes.",
    category: "speed",
    iconType: "bolt",
    unlocked: true,
    unlockedDate: "Nov 15, 2026",
    theme: "amber",
  },
  {
    id: "polyglot",
    title: "Polyglot",
    subtitle: "Landed merged PRs across 4 distinct programming languages.",
    category: "code",
    iconType: "globe",
    unlocked: true,
    unlockedDate: "Nov 08, 2026",
    theme: "purple",
  },
  {
    id: "docs-champion",
    title: "Docs Champion",
    subtitle: "Rewrote and refined messy developer onboarding guides.",
    category: "community",
    iconType: "book",
    unlocked: true,
    unlockedDate: "Oct 28, 2026",
    theme: "emerald",
  },
  {
    id: "lighthouse-keeper",
    title: "Lighthouse Keeper",
    subtitle: "Scored perfect 100 on Performance and Accessibility audit.",
    category: "code",
    iconType: "lighthouse",
    unlocked: false,
    progress: { current: 3, total: 5 },
    theme: "amber",
  },
  {
    id: "community-mentor",
    title: "Guiding Light",
    subtitle: "Mentored 3 newcomer contributors to their first merged commit.",
    category: "community",
    iconType: "handshake",
    unlocked: true,
    unlockedDate: "Nov 17, 2026",
    theme: "cyan",
  },
  {
    id: "gsoc-contender",
    title: "Fellowship Architect",
    subtitle: "Drafted and completed a scored 90%+ GSoC/LFX proposal.",
    category: "special",
    iconType: "scroll",
    unlocked: true,
    unlockedDate: "Nov 22, 2026",
    theme: "gold",
  },
  {
    id: "security-sentinel",
    title: "Security Sentinel",
    subtitle: "Identified and responsibly disclosed a security vulnerability.",
    category: "code",
    iconType: "shield",
    unlocked: false,
    progress: { current: 1, total: 2 },
    theme: "rose",
  },
  {
    id: "refactor-ranger",
    title: "Negative Lines King",
    subtitle: "Deleted 500+ lines of redundant legacy code with tests green.",
    category: "code",
    iconType: "broom",
    unlocked: true,
    unlockedDate: "Nov 14, 2026",
    theme: "emerald",
  },
  {
    id: "weekend-warrior",
    title: "Weekend Warrior",
    subtitle: "Landed significant upstream PRs across 4 straight weekends.",
    category: "special",
    iconType: "coffee",
    unlocked: false,
    progress: { current: 3, total: 4 },
    theme: "amber",
  },
  {
    id: "pipeline-whisperer",
    title: "CI Speed Demon",
    subtitle: "Optimized a GitHub Actions matrix workflow by 40% speedup.",
    category: "code",
    iconType: "zap",
    unlocked: true,
    unlockedDate: "Nov 10, 2026",
    theme: "cyan",
  },
  {
    id: "curator-supreme",
    title: "Curator Supreme",
    subtitle: "Curated 50 beginner-verified good first issues on Cyrus.",
    category: "community",
    iconType: "gem",
    unlocked: false,
    progress: { current: 38, total: 50 },
    theme: "purple",
  },
  {
    id: "ecosystem-pioneer",
    title: "Ecosystem Pioneer",
    subtitle: "Built and contributed an official plugin or third-party connector.",
    category: "special",
    iconType: "rocket",
    unlocked: true,
    unlockedDate: "Nov 20, 2026",
    theme: "blue",
  },
  {
    id: "issue-tamer",
    title: "Issue Tamer",
    subtitle: "Closed or resolved 25 stale issue backlogs in active repos.",
    category: "contribution",
    iconType: "lasso",
    unlocked: true,
    unlockedDate: "Nov 05, 2026",
    theme: "emerald",
  },
  {
    id: "zero-breakage",
    title: "Zero Breakage",
    subtitle: "Merged 15 consecutive PRs with zero CI failures or rollbacks.",
    category: "code",
    iconType: "medal",
    unlocked: true,
    unlockedDate: "Nov 16, 2026",
    theme: "gold",
  },
  {
    id: "titan-contributor",
    title: "Titan Ascendant",
    subtitle: "Ranked in the top 1% global contributor tier on Cyrus.",
    category: "special",
    iconType: "crown",
    unlocked: false,
    progress: { current: 820, total: 1000 },
    theme: "gold",
  },
];

function BadgeHexagonIcon({ iconType, theme }: { iconType: string; theme: string }) {
  const getThemeGrad = () => {
    switch (theme) {
      case "emerald":
        return "from-emerald-400 via-emerald-600 to-teal-800";
      case "amber":
        return "from-amber-400 via-orange-500 to-amber-700";
      case "rose":
        return "from-rose-400 via-pink-600 to-rose-800";
      case "purple":
        return "from-purple-400 via-violet-600 to-purple-800";
      case "cyan":
        return "from-cyan-400 via-teal-500 to-blue-700";
      case "gold":
        return "from-yellow-300 via-amber-500 to-yellow-700";
      case "blue":
      default:
        return "from-blue-400 via-indigo-600 to-blue-900";
    }
  };

  const renderIconEmoji = () => {
    switch (iconType) {
      case "owl":
        return "🦉";
      case "sword":
        return "⚔️";
      case "bug":
        return "🐛";
      case "gear":
        return "⚙️";
      case "glasses":
        return "🧐";
      case "bolt":
        return "⚡";
      case "globe":
        return "🌐";
      case "book":
        return "📖";
      case "lighthouse":
        return "🗼";
      case "handshake":
        return "🤝";
      case "scroll":
        return "📜";
      case "shield":
        return "🛡️";
      case "broom":
        return "🧹";
      case "coffee":
        return "☕";
      case "zap":
        return "🚀";
      case "gem":
        return "💎";
      case "rocket":
        return "🛰️";
      case "lasso":
        return "🎯";
      case "medal":
        return "🥇";
      case "crown":
      default:
        return "👑";
    }
  };

  return (
    <div className="relative w-28 h-32 grid place-items-center my-3 shrink-0">
      {/* Outer Hexagon Shell */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${getThemeGrad()} rounded-3xl shadow-xl transform scale-95 transition-transform group-hover:scale-100`}
        style={{
          clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
          boxShadow: "0 8px 25px rgba(0,0,0,0.35)",
        }}
      />
      {/* Inner Hexagon Core */}
      <div
        className="absolute inset-1.5 bg-card/90 dark:bg-slate-900/90 backdrop-blur-md grid place-items-center"
        style={{
          clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        }}
      >
        <div className="flex flex-col items-center justify-center">
          <span className="text-3xl filter drop-shadow-md select-none transform transition-transform group-hover:scale-110">
            {renderIconEmoji()}
          </span>
          <span className="text-[10px] font-mono text-dim mt-1 font-bold">
            CYRUS
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);

  const filteredBadges = TWENTY_BADGES.filter((b) => {
    if (filter === "unlocked") return b.unlocked;
    if (filter === "locked") return !b.unlocked;
    if (filter === "contribution") return b.category === "contribution";
    if (filter === "code") return b.category === "code";
    if (filter === "community") return b.category === "community";
    if (filter === "special") return b.category === "special";
    return true;
  });

  const unlockedCount = TWENTY_BADGES.filter((b) => b.unlocked).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-dim mb-4">
        <Link to="/dashboard" className="hover:text-ink">Dashboard</Link>
        <span>/</span>
        <span className="text-ink font-semibold">Badges & Achievements</span>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-hairline bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-surface p-8 sm:p-10 mb-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-400/30">
              <span>🏆 Collector Vault</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
              Curator Badges & Honors
            </h1>
            <p className="text-xs sm:text-sm text-dim leading-relaxed">
              Showcase verified milestones across codebase velocity, peer mentoring, architectural contributions, and open-source fellowship readiness.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-hairline shadow-sm shrink-0">
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center text-2xl font-black">
              🎖️
            </div>
            <div>
              <span className="text-xs font-mono text-dim block">Badges Unlocked</span>
              <span className="text-2xl font-extrabold text-ink font-mono">
                {unlockedCount} / {TWENTY_BADGES.length}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                {Math.round((unlockedCount / TWENTY_BADGES.length) * 100)}% Completed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-hairline pb-4">
        {[
          { id: "all", label: "All Badges (20)" },
          { id: "unlocked", label: `Unlocked (${unlockedCount})` },
          { id: "locked", label: `In Progress (${TWENTY_BADGES.length - unlockedCount})` },
          { id: "contribution", label: "Contribution" },
          { id: "code", label: "Code Craft" },
          { id: "community", label: "Mentorship & Community" },
          { id: "special", label: "Special Honors" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              filter === tab.id
                ? "bg-ink text-surface shadow-xs"
                : "bg-surface hover:bg-card text-dim hover:text-ink border border-hairline"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 20 Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredBadges.map((badge) => (
          <div
            key={badge.id}
            onClick={() => setSelectedBadge(badge)}
            className="group p-6 rounded-3xl border border-hairline bg-card hover:border-line hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* Hexagon Badge Visual (Inspired by Image 4) */}
            <BadgeHexagonIcon iconType={badge.iconType} theme={badge.theme} />

            <h3 className="text-lg font-bold text-ink mt-2 group-hover:text-rust transition-colors">
              {badge.title}
            </h3>
            <p className="text-xs text-dim mt-1 mb-4 leading-relaxed line-clamp-2">
              {badge.subtitle}
            </p>

            {badge.unlocked ? (
              <div className="mt-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
                <span>✓</span>
                <span>Badge Unlocked</span>
              </div>
            ) : (
              <div className="mt-auto w-full space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-dim">
                  <span>Progress</span>
                  <span>
                    {badge.progress?.current} / {badge.progress?.total}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden border border-hairline">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${((badge.progress?.current || 0) / (badge.progress?.total || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface border border-hairline text-dim hover:text-ink grid place-items-center text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="flex justify-center">
              <BadgeHexagonIcon iconType={selectedBadge.iconType} theme={selectedBadge.theme} />
            </div>

            <h3 className="text-2xl font-black text-ink">{selectedBadge.title}</h3>
            <p className="text-sm text-dim leading-relaxed font-medium">
              "{selectedBadge.subtitle}"
            </p>

            <div className="py-2">
              {selectedBadge.unlocked ? (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                  <span>✓ Badge Unlocked</span>
                </div>
              ) : (
                <div className="text-xs font-mono text-dim">
                  In progress: {selectedBadge.progress?.current} of {selectedBadge.progress?.total} requirements fulfilled
                </div>
              )}
            </div>

            {selectedBadge.unlockedDate && (
              <p className="text-[11px] font-mono text-dim">
                Achieved on {selectedBadge.unlockedDate} • Verified on GitHub
              </p>
            )}

            <div className="pt-4 border-t border-hairline flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `I just unlocked the "${selectedBadge.title}" badge on Cyrus! https://cyrus.ai/badges`
                  );
                  alert("Badge achievement link copied to clipboard!");
                }}
                className="w-full py-2.5 rounded-xl bg-ink text-surface text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Share Achievement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
