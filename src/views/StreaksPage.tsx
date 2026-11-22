"use client";

import { useState } from "react";
import { Link } from "@/lib/router";

export interface StreakMilestone {
  days: number;
  title: string;
  tagline: string;
  desc: string;
  unlocked: boolean;
  unlockedDate?: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond" | "mythic" | "titan";
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 7,
    title: "Habit Spark",
    tagline: "The hardest part is behind you.",
    desc: "Maintained 7 consecutive days of meaningful open-source commits, reviews, or issue triages.",
    unlocked: true,
    unlockedDate: "Nov 18, 2026",
    tier: "bronze",
  },
  {
    days: 30,
    title: "Monthly Momentum",
    tagline: "A full lunar cycle of open craft.",
    desc: "Completed 30 days unbroken streak. You are building muscle memory that sets top contributors apart.",
    unlocked: true,
    unlockedDate: "Oct 24, 2026",
    tier: "silver",
  },
  {
    days: 50,
    title: "Locked In",
    tagline: "This is now your identity.",
    desc: "Fifty days of continuous contribution. Your commits are now an indispensable part of multiple upstream trees.",
    unlocked: true,
    unlockedDate: "Nov 22, 2026",
    tier: "gold",
  },
  {
    days: 100,
    title: "Centurion",
    tagline: "Triple-digit consistency.",
    desc: "Passed the fabled 100-day milestone. Less than 0.8% of global open-source developers reach this echelon.",
    unlocked: false,
    tier: "platinum",
  },
  {
    days: 150,
    title: "Relentless Vanguard",
    tagline: "A season conquered without pause.",
    desc: "Maintained streak across an entire program cycle. Unmatched reliability for maintainers and program evaluators.",
    unlocked: false,
    tier: "diamond",
  },
  {
    days: 500,
    title: "Living Legend",
    tagline: "Code is not work, it is life breath.",
    desc: "500 days unbroken streak. A foundational pillar of the global commons, celebrated across multiple foundations.",
    unlocked: false,
    tier: "mythic",
  },
  {
    days: 1000,
    title: "The Eternal Contributor",
    tagline: "Ascended into open-source eternity.",
    desc: "One thousand consecutive days. Your journey is enshrined in the permanent hall of open-source titans.",
    unlocked: false,
    tier: "titan",
  },
];

export function FlameIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="0.45" stopColor="#F59E0B" />
          <stop offset="0.85" stopColor="#EF4444" />
          <stop offset="1" stopColor="#B91C1C" />
        </linearGradient>
        <linearGradient id="flameInner" x1="12" y1="10" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7" />
          <stop offset="0.5" stopColor="#FDE047" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Outer flame */}
      <path
        d="M12 2C10.5 4.5 9 7.5 9 10C9 10.8 9.2 11.5 9.5 12.1C8.2 11.4 7.5 10 7.5 8.5C5.3 11 4 14.2 4 17C4 20.9 7.1 22 12 22C16.9 22 20 20.9 20 17C20 12.8 17.5 9.5 14.5 6C14.5 7.8 13.8 9.3 12.7 10.3C12.7 7.5 13 4.5 12 2Z"
        fill="url(#flameGrad)"
        filter="url(#glow)"
      />
      {/* Inner vibrant core */}
      <path
        d="M12 11C11 12.5 10.5 13.8 10.5 15C10.5 16.5 11.2 17.5 12 18.5C12.8 17.5 13.5 16.5 13.5 15C13.5 13.8 13 12.5 12 11Z"
        fill="url(#flameInner)"
      />
    </svg>
  );
}

export function CheckTickIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="9" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10.2L8.7 13L14 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StreaksPage() {
  const [activeStreak] = useState(50);
  const [freezeTokens] = useState(2);
  const [selectedMilestone, setSelectedMilestone] = useState<StreakMilestone | null>(STREAK_MILESTONES[2]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-dim mb-4">
        <Link to="/dashboard" className="hover:text-ink">Dashboard</Link>
        <span>/</span>
        <span className="text-ink font-semibold">Streaks & Milestones</span>
      </div>

      {/* Hero Showcase Band */}
      <div className="relative overflow-hidden rounded-3xl border border-hairline bg-gradient-to-b from-amber-500/10 via-surface to-surface p-8 sm:p-12 mb-10 shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 max-w-xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40">
              <FlameIcon size={16} />
              <span>Streak Milestone Tracker</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-ink tracking-tight">
              Habits Build Reputations
            </h1>
            <p className="text-sm sm:text-base text-dim leading-relaxed">
              Every day you review an issue, submit code, or guide a peer, your streak strengthens. Unbroken consistency is the #1 signal mentors and hiring maintainers look for.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <div className="px-5 py-3 rounded-2xl bg-surface border border-hairline shadow-sm">
                <span className="text-xs text-dim block font-mono">Current Active Streak</span>
                <span className="text-2xl font-black text-amber-500 flex items-center gap-2">
                  <FlameIcon size={24} /> {activeStreak} Days
                </span>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-surface border border-hairline shadow-sm">
                <span className="text-xs text-dim block font-mono">Streak Freeze Shields</span>
                <span className="text-2xl font-black text-blue-500 flex items-center gap-2">
                  ❄️ {freezeTokens} Available
                </span>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-surface border border-hairline shadow-sm">
                <span className="text-xs text-dim block font-mono">Next Milestone</span>
                <span className="text-2xl font-black text-ink font-mono">
                  100 Days (50%)
                </span>
              </div>
            </div>
          </div>

          {/* Golden Badge Showcase (Inspired by Image 3) */}
          <div className="w-full max-w-xs shrink-0 flex flex-col items-center p-6 rounded-3xl bg-gradient-to-b from-amber-400/20 via-amber-500/5 to-surface/80 border border-amber-400/30 shadow-2xl backdrop-blur-sm text-center">
            {/* Hexagonal Gold Badge */}
            <div className="relative w-36 h-40 grid place-items-center my-2">
              {/* Outer Hexagon */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 rounded-3xl shadow-xl transform rotate-45 scale-90"
                style={{
                  clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
                  boxShadow: "0 10px 30px rgba(245, 158, 11, 0.4)",
                }}
              />
              {/* Inner Hexagon Core */}
              <div
                className="absolute inset-2 bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-100 grid place-items-center"
                style={{
                  clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
                }}
              >
                <div className="flex flex-col items-center justify-center text-amber-950 pb-1">
                  <FlameIcon size={32} />
                  <span className="text-2xl font-black tracking-tighter leading-none mt-1">
                    50
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest leading-none">
                    STREAK
                  </span>
                  <span className="text-xs mt-0.5">🌟</span>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-ink mt-3">Locked In</h3>
            <p className="text-xs text-dim mt-0.5 mb-3 font-medium">
              This is now your identity.
            </p>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
              <CheckTickIcon size={14} className="text-emerald-500" />
              <span>Badge Unlocked</span>
            </div>
            <span className="text-[11px] text-dim mt-2 font-mono">
              Cyrus Certified • Nov 22, 2026
            </span>
          </div>
        </div>
      </div>

      {/* All Milestones Grid */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-ink tracking-tight">
              All Streak Milestones
            </h2>
            <p className="text-xs text-dim mt-0.5">
              Unlock distinct golden credentials at 7, 30, 50, 100, 150, 500, and 1000 active days.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STREAK_MILESTONES.map((m) => {
            const isSelected = selectedMilestone?.days === m.days;
            return (
              <div
                key={m.days}
                onClick={() => setSelectedMilestone(m)}
                className={`p-6 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? "border-amber-400/80 bg-amber-500/5 shadow-md shadow-amber-500/10"
                    : "border-hairline bg-card hover:border-line"
                } ${!m.unlocked ? "opacity-75" : ""}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    {/* Badge Hexagon Icon */}
                    <div
                      className={`w-14 h-14 rounded-2xl grid place-items-center shadow-md ${
                        m.unlocked
                          ? "bg-gradient-to-tr from-amber-500 to-amber-300 text-amber-950 font-black"
                          : "bg-surface border border-hairline text-dim font-bold"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-base font-black leading-none block">{m.days}</span>
                        <span className="text-[8px] uppercase tracking-wider block font-bold leading-none mt-0.5">
                          Days
                        </span>
                      </div>
                    </div>

                    {m.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                        <CheckTickIcon size={12} /> Unlocked
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-dim bg-surface px-2.5 py-0.5 rounded-full border border-hairline">
                        Locked
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-ink">{m.title}</h3>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 italic">
                    "{m.tagline}"
                  </p>
                  <p className="text-xs text-dim leading-relaxed">
                    {m.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-hairline flex items-center justify-between text-xs font-mono">
                  <span className="text-dim">
                    {m.unlockedDate ? `Achieved ${m.unlockedDate}` : `${m.days - activeStreak} days left`}
                  </span>
                  <span className="font-semibold text-ink uppercase tracking-wider text-[10px]">
                    {m.tier}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Week Rhythm Tracker Details */}
      <div className="p-6 rounded-2xl border border-hairline bg-surface/50">
        <h3 className="text-lg font-bold text-ink mb-2">Weekly Contribution Rhythm</h3>
        <p className="text-xs text-dim mb-6">
          Your 7-day rolling window is synced live with GitHub activity, PR submissions, and Cyrus ledger updates.
        </p>

        <div className="grid grid-cols-7 gap-3 text-center">
          {[
            { day: "Mon", status: "completed", date: "Nov 16" },
            { day: "Tue", status: "completed", date: "Nov 17" },
            { day: "Wed", status: "completed", date: "Nov 18" },
            { day: "Thu", status: "completed", date: "Nov 19" },
            { day: "Fri", status: "completed", date: "Nov 20" },
            { day: "Sat", status: "completed", date: "Nov 21" },
            { day: "Sun", status: "completed", date: "Today" },
          ].map((item) => (
            <div key={item.day} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-hairline">
              <span className="text-xs font-bold text-ink">{item.day}</span>
              <span className="text-[10px] font-mono text-dim">{item.date}</span>
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white grid place-items-center shadow-xs">
                <CheckTickIcon size={16} className="text-white" />
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
