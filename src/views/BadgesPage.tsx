"use client";

import { useState } from "react";
import { Link } from "@/lib/router";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface AchievementBadge {
  id: string;
  title: string;
  subtitle: string;
  category: "contribution" | "code" | "community" | "speed" | "special";
  rarity: BadgeRarity;
  iconType: string;
  unlocked: boolean;
  unlockedDate?: string;
  progress?: { current: number; total: number };
  theme: "blue" | "emerald" | "amber" | "purple" | "rose" | "cyan" | "gold";
}

export const THIRTY_BADGES: AchievementBadge[] = [
  {
    id: "gremlin",
    title: "Night Owl",
    subtitle: "Merged commits past midnight with every test still green.",
    category: "special",
    rarity: "rare",
    iconType: "owl",
    unlocked: true,
    unlockedDate: "Nov 21, 2026",
    theme: "blue",
  },
  {
    id: "first-blood",
    title: "First Merge",
    subtitle: "Merged your very first upstream open-source pull request.",
    category: "contribution",
    rarity: "common",
    iconType: "git-merge",
    unlocked: true,
    unlockedDate: "Oct 12, 2026",
    theme: "rose",
  },
  {
    id: "bug-hunter",
    title: "Bug Stalker",
    subtitle: "Found, reproduced, and documented 5 confirmed upstream issues.",
    category: "contribution",
    rarity: "common",
    iconType: "bug",
    unlocked: true,
    unlockedDate: "Nov 02, 2026",
    theme: "emerald",
  },
  {
    id: "pr-machine",
    title: "PR Velocity",
    subtitle: "10 pull requests merged in a single calendar month.",
    category: "code",
    rarity: "epic",
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
    rarity: "epic",
    iconType: "eye",
    unlocked: false,
    progress: { current: 14, total: 20 },
    theme: "purple",
  },
  {
    id: "speed-demon",
    title: "Flash Patch",
    subtitle: "Claimed, coded, and landed a verified fix in under 90 minutes.",
    category: "speed",
    rarity: "rare",
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
    rarity: "epic",
    iconType: "globe",
    unlocked: true,
    unlockedDate: "Nov 08, 2026",
    theme: "purple",
  },
  {
    id: "docs-champion",
    title: "Docs Architect",
    subtitle: "Rewrote and refined developer onboarding & API guides.",
    category: "community",
    rarity: "common",
    iconType: "book",
    unlocked: true,
    unlockedDate: "Oct 28, 2026",
    theme: "emerald",
  },
  {
    id: "lighthouse-keeper",
    title: "Lighthouse 100",
    subtitle: "Scored 100 on Performance and Accessibility audits.",
    category: "code",
    rarity: "epic",
    iconType: "spark",
    unlocked: false,
    progress: { current: 3, total: 5 },
    theme: "amber",
  },
  {
    id: "community-mentor",
    title: "Guiding Light",
    subtitle: "Mentored 3 newcomer contributors to their first merged commit.",
    category: "community",
    rarity: "rare",
    iconType: "users",
    unlocked: true,
    unlockedDate: "Nov 17, 2026",
    theme: "cyan",
  },
  {
    id: "gsoc-contender",
    title: "Fellowship Architect",
    subtitle: "Drafted and completed a scored 90%+ GSoC/LFX proposal.",
    category: "special",
    rarity: "legendary",
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
    rarity: "legendary",
    iconType: "shield",
    unlocked: false,
    progress: { current: 1, total: 2 },
    theme: "rose",
  },
  {
    id: "refactor-ranger",
    title: "Negative Lines",
    subtitle: "Deleted 500+ lines of dead code with all tests green.",
    category: "code",
    rarity: "rare",
    iconType: "scissors",
    unlocked: true,
    unlockedDate: "Nov 14, 2026",
    theme: "emerald",
  },
  {
    id: "weekend-warrior",
    title: "Weekend Builder",
    subtitle: "Landed significant upstream PRs across 4 straight weekends.",
    category: "special",
    rarity: "rare",
    iconType: "terminal",
    unlocked: false,
    progress: { current: 3, total: 4 },
    theme: "amber",
  },
  {
    id: "pipeline-whisperer",
    title: "CI Accelerator",
    subtitle: "Optimized a GitHub Actions matrix workflow by 40% speedup.",
    category: "code",
    rarity: "epic",
    iconType: "rocket",
    unlocked: true,
    unlockedDate: "Nov 10, 2026",
    theme: "cyan",
  },
  {
    id: "curator-supreme",
    title: "Curator Supreme",
    subtitle: "Curated 50 beginner-verified good first issues on Cyrus.",
    category: "community",
    rarity: "epic",
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
    rarity: "legendary",
    iconType: "layers",
    unlocked: true,
    unlockedDate: "Nov 20, 2026",
    theme: "blue",
  },
  {
    id: "issue-tamer",
    title: "Issue Tamer",
    subtitle: "Triaged and resolved 25 stale issue backlogs in active repos.",
    category: "contribution",
    rarity: "rare",
    iconType: "target",
    unlocked: true,
    unlockedDate: "Nov 05, 2026",
    theme: "emerald",
  },
  {
    id: "zero-breakage",
    title: "Zero Breakage",
    subtitle: "Merged 15 consecutive PRs with zero CI failures or rollbacks.",
    category: "code",
    rarity: "legendary",
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
    rarity: "mythic",
    iconType: "crown",
    unlocked: false,
    progress: { current: 820, total: 1000 },
    theme: "gold",
  },
  {
    id: "open-source-advocate",
    title: "Open Source Advocate",
    subtitle: "Contributed to 10 distinct public repositories in one season.",
    category: "contribution",
    rarity: "epic",
    iconType: "globe",
    unlocked: true,
    unlockedDate: "Nov 23, 2026",
    theme: "emerald",
  },
  {
    id: "hotfix-hero",
    title: "Hotfix Hero",
    subtitle: "Shipped a critical production regression fix within 30 minutes.",
    category: "speed",
    rarity: "legendary",
    iconType: "bolt",
    unlocked: true,
    unlockedDate: "Nov 18, 2026",
    theme: "rose",
  },
  {
    id: "ci-guardian",
    title: "CI Guardian",
    subtitle: "Fixed 10 flaky integration tests across upstream pipelines.",
    category: "code",
    rarity: "rare",
    iconType: "shield",
    unlocked: false,
    progress: { current: 7, total: 10 },
    theme: "cyan",
  },
  {
    id: "api-architect",
    title: "API Architect",
    subtitle: "Designed and documented a backwards-compatible REST/GraphQL endpoint.",
    category: "code",
    rarity: "epic",
    iconType: "layers",
    unlocked: true,
    unlockedDate: "Nov 12, 2026",
    theme: "blue",
  },
  {
    id: "test-evangelist",
    title: "Test Evangelist",
    subtitle: "Raised unit and integration test coverage by 15%+ on a core package.",
    category: "code",
    rarity: "rare",
    iconType: "check",
    unlocked: true,
    unlockedDate: "Nov 09, 2026",
    theme: "emerald",
  },
  {
    id: "first-review",
    title: "First Review",
    subtitle: "Left your first constructive, actionable code review comment.",
    category: "community",
    rarity: "common",
    iconType: "eye",
    unlocked: true,
    unlockedDate: "Oct 18, 2026",
    theme: "purple",
  },
  {
    id: "dependency-keeper",
    title: "Dependency Keeper",
    subtitle: "Safely upgraded 10 major dependencies with zero breaking regressions.",
    category: "code",
    rarity: "common",
    iconType: "gear",
    unlocked: false,
    progress: { current: 6, total: 10 },
    theme: "cyan",
  },
  {
    id: "accessibility-ally",
    title: "A11y Champion",
    subtitle: "Resolved 10 WCAG AA keyboard navigation & contrast issues.",
    category: "community",
    rarity: "epic",
    iconType: "spark",
    unlocked: true,
    unlockedDate: "Nov 24, 2026",
    theme: "amber",
  },
  {
    id: "release-captain",
    title: "Release Captain",
    subtitle: "Coordinated changelog, semantic versioning, and release notes.",
    category: "special",
    rarity: "legendary",
    iconType: "rocket",
    unlocked: false,
    progress: { current: 1, total: 3 },
    theme: "gold",
  },
  {
    id: "streak-master",
    title: "Unbroken Flame",
    subtitle: "Sustained a 50-day continuous open-source contribution streak.",
    category: "special",
    rarity: "mythic",
    iconType: "crown",
    unlocked: true,
    unlockedDate: "Nov 22, 2026",
    theme: "gold",
  },
];

/* Alias for backwards compatibility with any imports */
export const TWENTY_BADGES = THIRTY_BADGES;

const THEME_PALETTE: Record<AchievementBadge["theme"], { top: string; mid: string; bot: string; glow: string; accent: string }> = {
  emerald: { top: "#34d399", mid: "#059669", bot: "#064e3b", glow: "rgba(16,185,129,0.38)", accent: "#6ee7b7" },
  amber:   { top: "#fbbf24", mid: "#d97706", bot: "#78350f", glow: "rgba(245,158,11,0.38)", accent: "#fde68a" },
  rose:    { top: "#fb7185", mid: "#e11d48", bot: "#881337", glow: "rgba(244,63,94,0.38)",  accent: "#fda4af" },
  purple:  { top: "#a78bfa", mid: "#7c3aed", bot: "#4c1d95", glow: "rgba(139,92,246,0.38)", accent: "#ddd6fe" },
  cyan:    { top: "#22d3ee", mid: "#0891b2", bot: "#164e63", glow: "rgba(6,182,212,0.38)",  accent: "#a5f3fc" },
  gold:    { top: "#fde047", mid: "#eab308", bot: "#713f12", glow: "rgba(234,179,8,0.45)",  accent: "#fef08a" },
  blue:    { top: "#60a5fa", mid: "#2563eb", bot: "#1e3a8a", glow: "rgba(59,130,246,0.38)", accent: "#bfdbfe" },
};

const RARITY_STYLES: Record<BadgeRarity, string> = {
  common: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-400/30",
  rare: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-400/30",
  epic: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-400/30",
  legendary: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-400/40",
  mythic: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-400/40",
};

function BadgeVectorGlyph({ iconType, color }: { iconType: string; color: string }) {
  const props = { width: 30, height: 30, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (iconType) {
    case "git-merge":
      return <svg {...props}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>;
    case "bug":
      return <svg {...props}><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>;
    case "gear":
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "eye":
      return <svg {...props}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "bolt":
      return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "globe":
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
    case "book":
      return <svg {...props}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;
    case "spark":
      return <svg {...props}><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>;
    case "users":
      return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "scroll":
      return <svg {...props}><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></svg>;
    case "shield":
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "scissors":
      return <svg {...props}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/></svg>;
    case "terminal":
      return <svg {...props}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
    case "rocket":
      return <svg {...props}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>;
    case "gem":
      return <svg {...props}><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>;
    case "layers":
      return <svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case "target":
      return <svg {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
    case "medal":
      return <svg {...props}><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><circle cx="12" cy="17" r="5"/></svg>;
    case "check":
      return <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    case "owl":
      return <svg {...props}><path d="M12 3a7 7 0 0 0-7 7v4a7 7 0 0 0 14 0v-4a7 7 0 0 0-7-7Z"/><circle cx="9.5" cy="10.5" r="1.2" fill={color}/><circle cx="14.5" cy="10.5" r="1.2" fill={color}/><path d="m12 13-1.2 1.5h2.4L12 13Z"/></svg>;
    case "crown":
    default:
      return <svg {...props}><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>;
  }
}

function BadgeHexagonIcon({ iconType, theme, unlocked }: { iconType: string; theme: AchievementBadge["theme"]; unlocked: boolean }) {
  const p = THEME_PALETTE[theme];
  const uid = `hex-${theme}-${iconType}`;
  return (
    <div
      className="relative w-28 h-32 grid place-items-center my-2 shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-1"
      style={{ filter: unlocked ? `drop-shadow(0 10px 22px ${p.glow})` : "grayscale(0.65) opacity(0.7)" }}
    >
      <svg viewBox="0 0 120 136" className="w-full h-full">
        <defs>
          <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="120" y2="136" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={p.top} />
            <stop offset="50%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.bot} />
          </linearGradient>
          <linearGradient id={`${uid}-core`} x1="20" y1="10" x2="100" y2="126" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>
        </defs>
        {/* Outer metallic bevel */}
        <polygon
          points="60 3 114 34 114 102 60 133 6 102 6 34"
          fill={`url(#${uid}-rim)`}
          stroke={p.accent}
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        {/* Inner dark obsidian plate */}
        <polygon
          points="60 12 105 39 105 97 60 124 15 97 15 39"
          fill={`url(#${uid}-core)`}
          stroke={p.top}
          strokeOpacity="0.4"
          strokeWidth="1"
        />
        {/* Top specular facet */}
        <polygon
          points="60 12 105 39 60 54 15 39"
          fill="white"
          fillOpacity="0.06"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <BadgeVectorGlyph iconType={iconType} color={p.accent} />
        <span className="text-[9px] font-mono tracking-[0.22em] font-bold mt-1.5" style={{ color: p.top }}>
          CYRUS
        </span>
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);

  const filteredBadges = THIRTY_BADGES.filter((b) => {
    if (filter === "unlocked") return b.unlocked;
    if (filter === "locked") return !b.unlocked;
    if (filter === "contribution") return b.category === "contribution";
    if (filter === "code") return b.category === "code";
    if (filter === "community") return b.category === "community";
    if (filter === "speed") return b.category === "speed";
    if (filter === "special") return b.category === "special";
    return true;
  });

  const unlockedCount = THIRTY_BADGES.filter((b) => b.unlocked).length;
  const pct = Math.round((unlockedCount / THIRTY_BADGES.length) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-dim mb-4">
        <Link to="/dashboard" className="hover:text-ink">Dashboard</Link>
        <span>/</span>
        <span className="text-ink font-semibold">Badges &amp; Honors</span>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-hairline bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-purple-500/10 p-8 sm:p-10 mb-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-400/30">
              <span>Collector Vault · {THIRTY_BADGES.length} Honors</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
              Open-Source Badges &amp; Honors
            </h1>
            <p className="text-xs sm:text-sm text-dim leading-relaxed">
              Earn metallic hexagonal honors for upstream PR velocity, peer code reviews, accessibility fixes, security disclosures, and fellowship readiness.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 bg-card/80 backdrop-blur-md p-5 rounded-2xl border border-hairline shadow-sm shrink-0 min-w-[220px]">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-dim">Unlocked</span>
              <span className="text-2xl font-black text-ink">
                {unlockedCount} <span className="text-sm font-medium text-dim">/ {THIRTY_BADGES.length}</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface border border-hairline overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-dim">
              {pct}% Vault Completion · Top 4% Tier
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[
          { id: "all", label: `All (${THIRTY_BADGES.length})` },
          { id: "unlocked", label: `Unlocked (${unlockedCount})` },
          { id: "locked", label: `In Progress (${THIRTY_BADGES.length - unlockedCount})` },
          { id: "contribution", label: "Contribution" },
          { id: "code", label: "Code Quality" },
          { id: "community", label: "Community" },
          { id: "speed", label: "Velocity" },
          { id: "special", label: "Special" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              filter === tab.id
                ? "bg-ink text-paper border-ink shadow-sm"
                : "bg-card text-dim border-hairline hover:text-ink hover:border-line"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBadges.map((b) => (
          <div
            key={b.id}
            onClick={() => setSelectedBadge(b)}
            className={`group relative rounded-3xl border p-6 flex flex-col items-center text-center transition-all duration-300 cursor-pointer overflow-hidden ${
              b.unlocked
                ? "bg-card border-hairline hover:border-accent/50 hover:shadow-xl"
                : "bg-surface/60 border-hairline/70 hover:border-line"
            }`}
          >
            <div className="w-full flex items-center justify-between mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${RARITY_STYLES[b.rarity]}`}>
                {b.rarity}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-dim">
                {b.category}
              </span>
            </div>

            <BadgeHexagonIcon iconType={b.iconType} theme={b.theme} unlocked={b.unlocked} />

            <h3 className="text-lg font-bold text-ink mt-1">{b.title}</h3>
            <p className="text-xs text-dim leading-relaxed mt-1.5 min-h-[36px]">
              {b.subtitle}
            </p>

            <div className="w-full mt-4 pt-3.5 border-t border-hairline">
              {b.unlocked ? (
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Unlocked</span>
                  <span className="text-dim">{b.unlockedDate}</span>
                </div>
              ) : b.progress ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-dim">
                    <span>Progress</span>
                    <span>{b.progress.current} / {b.progress.total}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface border border-hairline overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                      style={{ width: `${Math.round((b.progress.current / b.progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-[11px] font-mono text-dim">Locked</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Badge Modal */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setSelectedBadge(null)}
        >
          <div
            className="bg-card border border-hairline rounded-3xl max-w-md w-full p-7 shadow-2xl text-center flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className={`px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border mb-2 ${RARITY_STYLES[selectedBadge.rarity]}`}>
              {selectedBadge.rarity} · {selectedBadge.category}
            </span>
            <BadgeHexagonIcon iconType={selectedBadge.iconType} theme={selectedBadge.theme} unlocked={selectedBadge.unlocked} />
            <h2 className="text-2xl font-extrabold text-ink mt-2">{selectedBadge.title}</h2>
            <p className="text-sm text-dim mt-2 leading-relaxed">{selectedBadge.subtitle}</p>
            <div className="mt-5 text-xs font-mono text-dim">
              {selectedBadge.unlocked
                ? `Earned on ${selectedBadge.unlockedDate}`
                : selectedBadge.progress
                  ? `Progress: ${selectedBadge.progress.current} of ${selectedBadge.progress.total}`
                  : "Keep contributing to unlock"}
            </div>
            <button
              onClick={() => setSelectedBadge(null)}
              className="mt-6 px-6 py-2 rounded-full bg-ink text-paper text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
