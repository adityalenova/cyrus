"use client";

import { useState, useEffect } from "react";
import { Link } from "@/lib/router";

interface Props {
  user: { name: string; email?: string | null; login?: string | null };
}

export default function DashboardEnhancements({ user }: Props) {
  const [roleTrack, setRoleTrack] = useState<"contributor" | "mentor">("contributor");
  const [completedSteps, setCompletedSteps] = useState<number[]>([1, 2]);
  const [streakDays] = useState(4);
  const [streakFreezeActive] = useState(true);

  useEffect(() => {
    try {
      const savedSteps = localStorage.getItem("cyrus.interactive_path.steps");
      if (savedSteps) setCompletedSteps(JSON.parse(savedSteps));
      const savedTrack = localStorage.getItem("cyrus.interactive_path.track");
      if (savedTrack === "mentor" || savedTrack === "contributor") setRoleTrack(savedTrack);
    } catch {
      // Ignore
    }
  }, []);

  const toggleStep = (stepId: number) => {
    const updated = completedSteps.includes(stepId)
      ? completedSteps.filter((s) => s !== stepId)
      : [...completedSteps, stepId];
    setCompletedSteps(updated);
    try {
      localStorage.setItem("cyrus.interactive_path.steps", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleTrackChange = (track: "contributor" | "mentor") => {
    setRoleTrack(track);
    try {
      localStorage.setItem("cyrus.interactive_path.track", track);
    } catch {
      // Ignore
    }
  };

  const contributorSteps = [
    {
      id: 1,
      title: "Discover Target Repositories & Follow Organizations",
      desc: "Explore 364+ organizations, filter by tech stack (Rust, Go, TypeScript), and star projects.",
      link: "/organizations",
      linkText: "Explore Orgs",
    },
    {
      id: 2,
      title: "Select a Starter Issue & Pin to Board",
      desc: "Find beginner-friendly good-first-issues from 40,000+ open GitHub issues.",
      link: "/issues",
      linkText: "Browse Issues",
    },
    {
      id: 3,
      title: "Connect with a Verified Mentor",
      desc: "Schedule a session or request 1-on-1 mentorship with a seasoned open-source fellow.",
      link: "/mentorship",
      linkText: "Find Mentors",
    },
    {
      id: 4,
      title: "Draft Proposal in Proposal Studio",
      desc: "Use our structured workspace to craft and score your GSoC or LFX application.",
      link: "/proposal-studio",
      linkText: "Open Proposal Studio",
    },
    {
      id: 5,
      title: "Compare Program Stipends & Deadlines",
      desc: "Review regional PPP stipends and timeline clashes across GSoC, LFX, and Outreachy.",
      link: "/programs/compare",
      linkText: "Compare Programs",
    },
  ];

  const mentorSteps = [
    {
      id: 1,
      title: "Setup Mentor Profile & Tech Expertise",
      desc: "Configure your weekly availability slots, domain specialties, and timezone.",
      link: "/mentorship",
      linkText: "Configure Profile",
    },
    {
      id: 2,
      title: "Review Incoming Mentee Requests",
      desc: "Evaluate mentee learning goals and accept matching contributor requests.",
      link: "/mentorship",
      linkText: "Review Requests",
    },
    {
      id: 3,
      title: "Host 1-on-1 Code Review Sessions",
      desc: "Guide mentees through PR reviews, architecture decisions, and proposal drafting.",
      link: "/mentorship",
      linkText: "Mentorship Hub",
    },
    {
      id: 4,
      title: "Award Community Endorsements",
      desc: "Endorse top mentees upon landing their first major upstream open-source PRs.",
      link: "/leaderboard",
      linkText: "Community Board",
    },
  ];

  const steps = roleTrack === "contributor" ? contributorSteps : mentorSteps;
  const progressPct = Math.round((completedSteps.filter((id) => steps.some((s) => s.id === id)).length / steps.length) * 100);

  const BADGES = [
    { id: "first-pr", name: "First PR Landed", icon: "🚀", desc: "Submitted and merged first open source pull request", unlocked: true },
    { id: "hunter", name: "Issue Hunter", icon: "🎯", desc: "Tracked and triaged 5+ open issues on personal ledger", unlocked: true },
    { id: "proposal", name: "Proposal Architect", icon: "📝", desc: "Drafted a complete proposal in Proposal Studio", unlocked: true },
    { id: "mentor-sync", name: "Mentor Connection", icon: "🤝", desc: "Connected with a verified GSoC or LFX mentor", unlocked: true },
    { id: "streak-master", name: "Streak Master", icon: "🔥", desc: "Maintained a 7-day contribution habit", unlocked: false },
    { id: "fellow", name: "Program Fellow", icon: "🏆", desc: "Accepted into an open-source mentorship cohort", unlocked: false },
  ];

  return (
    <div className="space-y-8 my-8">
      {/* 1. Streaks & Daily Milestones Band */}
      <div className="p-6 rounded-2xl border border-hairline bg-surface/50 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-2xl shadow-inner">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-ink">{streakDays}-Day Active Streak</span>
              {streakFreezeActive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800/50">
                  ❄️ Freeze Active
                </span>
              )}
            </div>
            <p className="text-xs text-dim mt-0.5">
              Keep checking issues and contributing daily to unlock the Streak Master badge!
            </p>
          </div>
        </div>

        {/* 7-Day Dot Heatmap */}
        <div className="flex items-center gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => {
            const active = idx < streakDays;
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-dim">{day}</span>
                <div
                  className={`w-7 h-7 rounded-lg grid place-items-center text-xs font-bold transition-all ${
                    active
                      ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20 scale-105"
                      : "bg-surface border border-hairline text-dim"
                  }`}
                >
                  {active ? "✓" : "·"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Role Path Navigator */}
      <div className="p-6 rounded-2xl border border-hairline bg-surface/50 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/50 mb-1">
              Personalized Journey
            </div>
            <h2 className="text-xl font-bold text-ink">Interactive Onboarding Pathway</h2>
            <p className="text-xs text-dim">
              Step-by-step milestones to advance from newcomer to paid open-source fellow or mentor.
            </p>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-page border border-hairline text-xs font-semibold">
            <button
              onClick={() => handleTrackChange("contributor")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                roleTrack === "contributor"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-dim hover:text-ink"
              }`}
            >
              🎓 Contributor Pathway
            </button>
            <button
              onClick={() => handleTrackChange("mentor")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                roleTrack === "mentor"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-dim hover:text-ink"
              }`}
            >
              🌟 Mentor Pathway
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-dim">Pathway Completion</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono">{progressPct}% Complete</span>
          </div>
          <div className="w-full bg-hairline rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {steps.map((st) => {
            const isDone = completedSteps.includes(st.id);
            return (
              <div
                key={st.id}
                className={`flex items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                  isDone
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-surface border-hairline hover:border-hairline/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleStep(st.id)}
                    className={`mt-0.5 sm:mt-0 w-6 h-6 rounded-lg border grid place-items-center text-xs font-bold transition-all cursor-pointer ${
                      isDone
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                        : "border-dim text-transparent hover:border-emerald-500"
                    }`}
                  >
                    ✓
                  </button>
                  <div>
                    <h3 className={`text-sm font-bold ${isDone ? "text-ink line-through opacity-80" : "text-ink"}`}>
                      {st.title}
                    </h3>
                    <p className="text-xs text-dim mt-0.5">{st.desc}</p>
                  </div>
                </div>

                <Link
                  to={st.link}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-hairline bg-surface hover:bg-surface/80 text-xs font-semibold text-ink transition-all shadow-sm"
                >
                  {st.linkText} →
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. GitHub Contributor Passport & Curator Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Holographic Passport Card */}
        <div className="p-6 rounded-3xl border border-hairline bg-gradient-to-br from-surface/80 via-surface/40 to-surface/80 shadow-md relative overflow-hidden space-y-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-dim">
                Cyrus Open Passport
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
              VERIFIED
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xl font-black text-ink">{user.name}</div>
            <div className="text-xs font-mono text-dim">
              @{user.login || user.email?.split("@")[0] || "contributor"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-page/60 border border-hairline text-xs">
            <div>
              <div className="text-[10px] font-mono text-dim uppercase">Status Tier</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400">Master Contributor</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-dim uppercase">Passport ID</div>
              <div className="font-mono text-ink text-[11px]">CYRUS-9428-OSS</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-dim uppercase">Merged PRs</div>
              <div className="font-bold text-ink">14 Upstream</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-dim uppercase">Impact Index</div>
              <div className="font-bold text-ink">Top 5% Global</div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-dim border-t border-hairline">
            <span>Valid for GSoC & LFX Programs</span>
            <span className="font-mono">Season 2026</span>
          </div>
        </div>

        {/* Curator Badges Grid */}
        <div className="lg:col-span-2 p-6 rounded-3xl border border-hairline bg-surface/50 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Curator Badges & Achievements</h2>
              <p className="text-xs text-dim">
                Unlock badges through verified PRs, proposal drafts, and mentorship reviews.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              4 / 6 Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {BADGES.map((b) => (
              <div
                key={b.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  b.unlocked
                    ? "bg-surface border-emerald-500/20 shadow-sm"
                    : "bg-surface/20 border-hairline opacity-50 grayscale"
                }`}
              >
                <div>
                  <div className="text-2xl mb-1.5">{b.icon}</div>
                  <div className="text-xs font-bold text-ink">{b.name}</div>
                  <p className="text-[11px] text-dim mt-0.5 leading-snug">{b.desc}</p>
                </div>
                <div className="mt-3 text-[10px] font-mono font-semibold">
                  {b.unlocked ? (
                    <span className="text-emerald-600 dark:text-emerald-400">✓ Unlocked</span>
                  ) : (
                    <span className="text-dim">🔒 Locked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
