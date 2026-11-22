"use client";

import { useState, useMemo } from "react";
import { Link } from "@/lib/router";

interface ProgramSpec {
  id: string;
  name: string;
  badge: string;
  baseStipendUSD: { min: number; max: number };
  weeklyHours: string;
  eligibility: string;
  studentRequired: boolean;
  timeline: string;
  season: string;
  acceptanceRate: string;
  mentorRatio: string;
  description: string;
  keyRequirements: string[];
}

const PROGRAMS_DATA: ProgramSpec[] = [
  {
    id: "gsoc",
    name: "Google Summer of Code (GSoC)",
    badge: "Global · 175h or 350h",
    baseStipendUSD: { min: 1500, max: 6600 },
    weeklyHours: "30h - 40h/week",
    eligibility: "18+ years old, global",
    studentRequired: false,
    timeline: "March (Apps) → May-Aug (Coding) → Sep (Results)",
    season: "Summer (Annual)",
    acceptanceRate: "~12%",
    mentorRatio: "1:1 or 2:1 Dedicated Mentors",
    description: "Google's flagship open-source program pairing contributors with open-source organizations worldwide.",
    keyRequirements: ["Detailed proposal PDF", "Proof of eligibility", "Prior community interactions"],
  },
  {
    id: "lfx",
    name: "LFX Mentorship (Linux Foundation)",
    badge: "Linux Foundation · 3 Terms/Yr",
    baseStipendUSD: { min: 3000, max: 6600 },
    weeklyHours: "20h (Part-time) or 40h (Full-time)",
    eligibility: "18+ years old, global",
    studentRequired: false,
    timeline: "Spring (Jan-May) · Summer (Jun-Aug) · Fall (Sep-Nov)",
    season: "Tri-Annual (3 Seasons)",
    acceptanceRate: "~8%",
    mentorRatio: "1:1 Core Maintainer Mentorship",
    description: "Paid internships funded by the Linux Foundation across CNCF, Hyperledger, GraphQL, and OpenJS projects.",
    keyRequirements: ["Coding task / PR submission", "Resume & Cover Letter", "Technical interview in select projects"],
  },
  {
    id: "outreachy",
    name: "Outreachy",
    badge: "Diversity & Inclusion · Remote",
    baseStipendUSD: { min: 7000, max: 7000 },
    weeklyHours: "30h/week (Full-time)",
    eligibility: "Underrepresented groups in tech, 18+",
    studentRequired: false,
    timeline: "May-Aug (Round 1) · Dec-Mar (Round 2)",
    season: "Bi-Annual (2 Cohorts)",
    acceptanceRate: "~6%",
    mentorRatio: "1:1 Dedicated Mentorship + Alumni Network",
    description: "Paid 3-month remote internships for people subject to systemic bias and underrepresented in tech.",
    keyRequirements: ["Initial essay application", "Mandatory contribution period with recorded PRs"],
  },
  {
    id: "sob",
    name: "Summer of Bitcoin",
    badge: "Bitcoin Core & Lightning",
    baseStipendUSD: { min: 3000, max: 5000 },
    weeklyHours: "35h/week",
    eligibility: "University students worldwide",
    studentRequired: true,
    timeline: "Feb-Apr (Selection) → May-Aug (Coding)",
    season: "Summer (Annual)",
    acceptanceRate: "~4%",
    mentorRatio: "1:1 Bitcoin Core Maintainer",
    description: "Intensive summer program focused on Bitcoin protocol development and open-source Lightning applications.",
    keyRequirements: ["Challenging coding assessment", "Bitcoin architecture essay", "Technical interview"],
  },
  {
    id: "mlh",
    name: "Major League Hacking (MLH) Fellowship",
    badge: "Open Source Track · 12 Weeks",
    baseStipendUSD: { min: 2000, max: 5000 },
    weeklyHours: "30h - 40h/week",
    eligibility: "18+, global developer community",
    studentRequired: false,
    timeline: "Spring (Jan) · Summer (May) · Fall (Sep)",
    season: "Tri-Annual",
    acceptanceRate: "~5%",
    mentorRatio: "Pod Leader + Staff Engineer Mentors",
    description: "Collaborative 12-week fellowship contributing to major open-source tools maintained by top sponsors.",
    keyRequirements: ["Code sample submission", "Technical & behavioral video interviews"],
  },
  {
    id: "gsod",
    name: "Google Season of Docs",
    badge: "Technical Writing · Documentation",
    baseStipendUSD: { min: 3000, max: 15000 },
    weeklyHours: "Flexible milestone based",
    eligibility: "Experienced technical writers, 18+",
    studentRequired: false,
    timeline: "April (Org selection) → May-Nov (Doc Sprints)",
    season: "Annual",
    acceptanceRate: "~15%",
    mentorRatio: "Direct org collaboration",
    description: "Brings technical writers and open source organizations together to build world-class documentation.",
    keyRequirements: ["Technical writing portfolio", "Direct statement of work for documentation revamp"],
  },
];

const PPP_MULTIPLIERS: Record<string, { label: string; factor: number; flag: string; currency: string }> = {
  US: { label: "United States (1.00x Base)", factor: 1.0, flag: "🇺🇸", currency: "USD" },
  IN: { label: "India (PPP Adjusted ~0.55x)", factor: 0.55, flag: "🇮🇳", currency: "USD (~INR)" },
  NG: { label: "Nigeria (PPP Adjusted ~0.45x)", factor: 0.45, flag: "🇳🇬", currency: "USD" },
  BR: { label: "Brazil (PPP Adjusted ~0.60x)", factor: 0.6, flag: "🇧🇷", currency: "USD" },
  DE: { label: "Germany / EU (PPP Adjusted ~0.90x)", factor: 0.9, flag: "🇪🇺", currency: "EUR" },
  GB: { label: "United Kingdom (PPP Adjusted ~0.95x)", factor: 0.95, flag: "🇬🇧", currency: "GBP" },
};

export default function ProgramCompare() {
  const [selectedCountry, setSelectedCountry] = useState("IN");
  const [filterStudentOnly, setFilterStudentOnly] = useState<boolean | null>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(["gsoc", "lfx", "outreachy"]);

  const ppp = PPP_MULTIPLIERS[selectedCountry] ?? PPP_MULTIPLIERS.US;

  const toggleProgram = (id: string) => {
    if (selectedPrograms.includes(id)) {
      if (selectedPrograms.length > 1) {
        setSelectedPrograms(selectedPrograms.filter((p) => p !== id));
      }
    } else {
      setSelectedPrograms([...selectedPrograms, id]);
    }
  };

  const activeList = useMemo(() => {
    return PROGRAMS_DATA.filter((p) => {
      if (filterStudentOnly !== null && p.studentRequired !== filterStudentOnly) return false;
      return true;
    });
  }, [filterStudentOnly]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-hairline mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link to="/programs" className="text-xs text-dim hover:text-ink">
                ← Programs Catalog
              </Link>
              <span className="text-hairline">/</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Comparison Index</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Multi-Program Comparison & Regional Stipend Engine
            </h1>
            <p className="text-sm text-dim mt-1 max-w-2xl">
              Side-by-side analysis of Google Summer of Code, LFX Mentorship, Outreachy, Summer of Bitcoin and more.
              Compare regional purchasing power parity (PPP) stipends, eligibility rules, and timeline overlaps.
            </p>
          </div>

          {/* Regional PPP Selector */}
          <div className="p-3.5 rounded-2xl border border-hairline bg-surface/60 space-y-1.5 min-w-[240px]">
            <div className="text-[11px] font-mono uppercase tracking-wider text-dim flex items-center justify-between">
              <span>Regional PPP Country</span>
              <span>{ppp.flag}</span>
            </div>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-hairline bg-surface text-ink text-xs font-semibold focus:outline-none focus:border-emerald-500"
            >
              {Object.entries(PPP_MULTIPLIERS).map(([code, item]) => (
                <option key={code} value={code}>
                  {item.flag} {item.label}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-dim">
              Stipends reflect local purchasing power factor ({ppp.factor.toFixed(2)}x)
            </div>
          </div>
        </div>

        {/* Filters and Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-hairline bg-surface/40 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-dim mr-2">Compare:</span>
            {activeList.map((p) => {
              const active = selectedPrograms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProgram(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-emerald-600 text-white shadow-sm font-semibold"
                      : "bg-surface border border-hairline text-dim hover:text-ink hover:border-emerald-500/50"
                  }`}
                >
                  {p.name.split(" ")[0]} {active ? "✓" : "+"}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setFilterStudentOnly(null)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filterStudentOnly === null ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold" : "text-dim hover:text-ink"
              }`}
            >
              All Programs
            </button>
            <button
              onClick={() => setFilterStudentOnly(false)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filterStudentOnly === false ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold" : "text-dim hover:text-ink"
              }`}
            >
              Non-Students Allowed
            </button>
            <button
              onClick={() => setFilterStudentOnly(true)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filterStudentOnly === true ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold" : "text-dim hover:text-ink"
              }`}
            >
              Students Only
            </button>
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {PROGRAMS_DATA.filter((p) => selectedPrograms.includes(p.id)).map((p) => {
            const minStipend = Math.round(p.baseStipendUSD.min * ppp.factor);
            const maxStipend = Math.round(p.baseStipendUSD.max * ppp.factor);

            return (
              <div
                key={p.id}
                className="flex flex-col p-6 rounded-2xl border border-hairline bg-surface/50 hover:border-emerald-500/40 transition-all shadow-sm"
              >
                {/* Badge & Title */}
                <div className="mb-4">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/50 mb-2">
                    {p.badge}
                  </span>
                  <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                  <p className="text-xs text-dim mt-1 leading-relaxed">{p.description}</p>
                </div>

                {/* Regional Stipend Card */}
                <div className="p-4 rounded-xl border border-hairline bg-page mb-5 space-y-1">
                  <div className="text-[11px] font-mono uppercase text-dim">Regional Stipend ({ppp.flag})</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    ${minStipend.toLocaleString()} - ${maxStipend.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-dim">USD</span>
                  </div>
                  <div className="text-[10px] text-dim">Paid across midterm and final evaluation milestones</div>
                </div>

                {/* Key Specs Matrix */}
                <div className="space-y-3 text-xs mb-6 flex-1">
                  <div className="flex justify-between py-1.5 border-b border-hairline">
                    <span className="text-dim">Weekly Commitment</span>
                    <span className="font-semibold text-ink">{p.weeklyHours}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-hairline">
                    <span className="text-dim">Student Requirement</span>
                    <span className={`font-semibold ${p.studentRequired ? "text-amber-500" : "text-emerald-500"}`}>
                      {p.studentRequired ? "Student ID Required" : "No (Open to All)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-hairline">
                    <span className="text-dim">Seasons / Frequency</span>
                    <span className="font-semibold text-ink">{p.season}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-hairline">
                    <span className="text-dim">Est. Acceptance Rate</span>
                    <span className="font-semibold text-ink">{p.acceptanceRate}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-hairline">
                    <span className="text-dim">Mentorship Structure</span>
                    <span className="font-semibold text-ink">{p.mentorRatio}</span>
                  </div>
                  <div className="py-1.5">
                    <div className="text-dim mb-1">Timeline & Deadlines</div>
                    <div className="font-semibold text-ink text-[11px]">{p.timeline}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-4 border-t border-hairline">
                  <Link
                    to="/proposal-studio"
                    className="flex-1 py-2 text-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-sm"
                  >
                    Draft Proposal →
                  </Link>
                  <Link
                    to="/mentorship"
                    className="px-3 py-2 rounded-xl border border-hairline hover:bg-surface text-ink text-xs font-semibold transition-all"
                  >
                    Find Mentors
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Clash Warning Box */}
        <div className="p-6 rounded-2xl border border-hairline bg-surface/50 space-y-3">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <span className="text-amber-500">⚠️</span> Multi-Program Timeline Clash & Overlap Rules
          </h3>
          <p className="text-xs text-dim leading-relaxed">
            Many paid developer programs (e.g. GSoC and LFX Mentorship) strictly forbid simultaneous full-time participation during overlapping coding periods.
            If applying to multiple programs, ensure your proposed milestones do not conflict, or apply to consecutive terms (e.g., LFX Spring followed by GSoC Summer).
          </p>
        </div>
      </div>
    </div>
  );
}
