"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "@/lib/router";
import { useMentorsCatalog, type MentorCatalogItem } from "@/lib/mentorIndex";
import { ORGS } from "@/data/orgs";
import { btn, Portrait, Word } from "@/components/ui";

const POPULAR_TECHS = [
  "All",
  "Python",
  "C++",
  "JavaScript",
  "TypeScript",
  "Rust",
  "Go",
  "Docker",
  "React",
  "PyTorch",
  "Kubernetes",
  "Java",
  "Linux",
  "Django",
  "PostgreSQL",
  "Flutter",
  "Machine Learning",
  "Qt",
  "Git",
];

const PROGRAMS = [
  "All",
  "GSoC",
  "LFX Mentorship",
  "Summer of Bitcoin",
  "Season of KDE",
];

const YEARS = ["All", "2026", "2025", "2024", "2023", "2022"];

export default function Mentorship() {
  const { mentors, loading } = useMentorsCatalog();

  const [q, setQ] = useState("");
  const [selectedTech, setSelectedTech] = useState("All");
  const [selectedProg, setSelectedProg] = useState("All");
  const [selectedOrg, setSelectedOrg] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [sortBy, setSortBy] = useState<"projects" | "name" | "recent">("projects");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const listTopRef = useRef<HTMLDivElement>(null);

  // Extract all distinct organizations
  const allOrgs = useMemo(() => {
    if (!mentors) return [];
    const set = new Set<string>();
    for (const m of mentors) {
      for (const o of m.orgs) {
        if (o) set.add(o);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [mentors]);

  // Filter and sort mentors
  const filtered = useMemo(() => {
    if (!mentors) return [];
    const needle = q.trim().toLowerCase();

    return mentors
      .filter((m) => {
        // Tech stack filter
        if (selectedTech !== "All") {
          const hasTech = m.techs.some(
            (t) => t.toLowerCase() === selectedTech.toLowerCase()
          );
          if (!hasTech) return false;
        }

        // Program filter
        if (selectedProg !== "All") {
          const hasProg = m.progs.some((p) =>
            p.toLowerCase().includes(selectedProg.toLowerCase())
          );
          if (!hasProg) return false;
        }

        // Organization filter
        if (selectedOrg !== "All") {
          const hasOrg = m.orgs.some((o) => o === selectedOrg);
          if (!hasOrg) return false;
        }

        // Year filter
        if (selectedYear !== "All") {
          const yNum = parseInt(selectedYear, 10);
          if (!m.years.includes(yNum)) return false;
        }

        // Text query
        if (needle) {
          const matchName = m.name.toLowerCase().includes(needle);
          const matchOrg = m.orgs.some((o) => o.toLowerCase().includes(needle));
          const matchTech = m.techs.some((t) => t.toLowerCase().includes(needle));
          const matchTitle = (m.sampleTitle || "").toLowerCase().includes(needle);
          if (!matchName && !matchOrg && !matchTech && !matchTitle) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "recent") {
          const aRecent = Math.max(...a.years, 0);
          const bRecent = Math.max(...b.years, 0);
          if (bRecent !== aRecent) return bRecent - aRecent;
          return b.projects - a.projects;
        }
        // Default: most projects mentored
        return b.projects - a.projects || a.name.localeCompare(b.name);
      });
  }, [mentors, q, selectedTech, selectedProg, selectedOrg, selectedYear, sortBy]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [q, selectedTech, selectedProg, selectedOrg, selectedYear, sortBy, pageSize]);

  // Handle page change with smooth scroll to top of list
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const activeFiltersCount =
    (selectedTech !== "All" ? 1 : 0) +
    (selectedProg !== "All" ? 1 : 0) +
    (selectedOrg !== "All" ? 1 : 0) +
    (selectedYear !== "All" ? 1 : 0) +
    (q ? 1 : 0);

  const resetFilters = () => {
    setQ("");
    setSelectedTech("All");
    setSelectedProg("All");
    setSelectedOrg("All");
    setSelectedYear("All");
    setSortBy("projects");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-sand text-ink pb-20">
      {/* ── HERO BANNER ───────────────────────────────────────── */}
      <section className="bg-card border-b border-line pt-12 pb-14 px-4 sm:px-6">
        <div className="max-w-[1240px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-[760px]">
              <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold tracking-[.18em] uppercase text-accent mb-3 bg-accent/8 border border-accent/20 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Verified Mentorship Directory
              </span>
              <h1 className="font-display font-extrabold text-[32px] sm:text-[44px] md:text-[50px] tracking-[-.03em] leading-[1.08] text-ink">
                Find Mentors &amp; Advisors Across <Word>Open Source</Word>
              </h1>
              <p className="text-cocoa text-[14.5px] sm:text-[16px] leading-[1.65] mt-4">
                Explore over <strong>6,100+ verified mentors</strong> who guided accepted projects across Google Summer of Code, LFX Mentorship, Summer of Bitcoin, and Season of KDE. Search by tech stack, organization, or programming language to find mentors in your domain.
              </p>
            </div>

            {/* Quick Stat Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 shrink-0 bg-cream/80 border border-line p-4 rounded-[18px]">
              <div className="text-center px-3 py-1">
                <b className="block font-display text-[24px] sm:text-[28px] font-extrabold text-ink leading-tight tabular-nums">
                  {mentors ? mentors.length.toLocaleString() : "6,199"}
                </b>
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">Mentors</span>
              </div>
              <div className="text-center px-3 py-1 border-l border-line">
                <b className="block font-display text-[24px] sm:text-[28px] font-extrabold text-accent leading-tight tabular-nums">
                  4
                </b>
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">Programs</span>
              </div>
              <div className="text-center px-3 py-1 border-l border-line">
                <b className="block font-display text-[24px] sm:text-[28px] font-extrabold text-ink leading-tight tabular-nums">
                  {allOrgs.length ? allOrgs.length.toLocaleString() : "500+"}
                </b>
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">Orgs</span>
              </div>
              <div className="text-center px-3 py-1 border-l border-line">
                <b className="block font-display text-[24px] sm:text-[28px] font-extrabold text-ink leading-tight tabular-nums">
                  3.9k+
                </b>
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">Skills</span>
              </div>
            </div>
          </div>

          {/* Search bar & quick filter bar */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search mentors by name, tech stack, organization, or project title..."
                className="w-full bg-cream border border-line rounded-[14px] pl-11 pr-10 py-3.5 text-[14.5px] text-ink outline-none focus:border-accent transition-colors shadow-soft"
                aria-label="Search mentors by name, tech stack, or organization"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-line/80 text-ink grid place-items-center hover:bg-line transition-colors text-[13px] font-bold"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Mobile filter toggle button */}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="md:hidden flex items-center justify-center gap-2 w-full py-3 px-4 rounded-[12px] bg-coffee text-foam font-semibold text-[13px] shadow-lift active:scale-[0.98] transition-transform"
                aria-expanded={mobileFiltersOpen}
                aria-label="Open filter options"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filter Mentors {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
              </button>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-3 rounded-[12px] border border-line bg-card hover:bg-cream text-[13px] font-medium text-cocoa transition-colors"
                  aria-label="Reset all filters"
                >
                  Reset ({activeFiltersCount})
                </button>
              )}
            </div>
          </div>

          {/* Quick tech stack tags carousel */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.14em] text-dim">
                Filter by Popular Technology Stack
              </span>
              {selectedTech !== "All" && (
                <button
                  onClick={() => setSelectedTech("All")}
                  className="font-mono text-[10px] text-accent hover:underline"
                >
                  Clear tech filter
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              {POPULAR_TECHS.map((tech) => {
                const active = selectedTech.toLowerCase() === tech.toLowerCase();
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => setSelectedTech(tech)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-mono font-medium transition-all duration-150 border cursor-pointer min-h-[36px] flex items-center ${
                      active
                        ? "bg-accent text-foam border-accent shadow-sm"
                        : "bg-cream border-line text-cocoa hover:border-accent/40 hover:text-ink"
                    }`}
                    aria-pressed={active}
                  >
                    {tech}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT & FILTERS ────────────────────────────── */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 mt-8" ref={listTopRef}>
        {/* Desktop Filter Row */}
        <div className="hidden md:flex items-center justify-between gap-4 p-4 rounded-[16px] bg-card border border-line shadow-soft flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Program Dropdown */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-prog" className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
                Program
              </label>
              <select
                id="filter-prog"
                value={selectedProg}
                onChange={(e) => setSelectedProg(e.target.value)}
                className="bg-cream border border-line rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent cursor-pointer min-w-[160px]"
              >
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {p === "All" ? "All Programs" : p}
                  </option>
                ))}
              </select>
            </div>

            {/* Organization Dropdown */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-org" className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
                Organization
              </label>
              <select
                id="filter-org"
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="bg-cream border border-line rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent cursor-pointer max-w-[240px]"
              >
                <option value="All">All Organizations ({allOrgs.length})</option>
                {allOrgs.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-year" className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
                Year Active
              </label>
              <select
                id="filter-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-cream border border-line rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent cursor-pointer min-w-[110px]"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y === "All" ? "All Years" : y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort & Page Size */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="sort-by" className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
                Sort by
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "projects" | "name" | "recent")}
                className="bg-cream border border-line rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent cursor-pointer"
              >
                <option value="projects">Most Projects Mentored</option>
                <option value="name">Name (A to Z)</option>
                <option value="recent">Most Recent Year</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="page-size" className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">
                Per Page
              </label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="bg-cream border border-line rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent cursor-pointer"
              >
                <option value={24}>24</option>
                <option value={48}>48</option>
                <option value={96}>96</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Counter & Active Pills Bar */}
        <div className="flex items-center justify-between gap-4 my-5 flex-wrap">
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span className="font-display font-extrabold text-[18px] text-ink">
              {filtered.length.toLocaleString()}
            </span>
            <span className="text-[13.5px] text-cocoa">
              mentors found
              {filtered.length > 0 && ` · Page ${page} of ${totalPages}`}
            </span>
          </div>

          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedTech !== "All" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-[11px]">
                  Tech: {selectedTech}
                  <button onClick={() => setSelectedTech("All")} className="hover:text-ink font-bold">✕</button>
                </span>
              )}
              {selectedProg !== "All" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-denim/10 border border-denim/30 text-denim font-mono text-[11px]">
                  Prog: {selectedProg}
                  <button onClick={() => setSelectedProg("All")} className="hover:text-ink font-bold">✕</button>
                </span>
              )}
              {selectedOrg !== "All" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bean/10 border border-bean/30 text-ink font-mono text-[11px]">
                  Org: {selectedOrg}
                  <button onClick={() => setSelectedOrg("All")} className="hover:text-ink font-bold">✕</button>
                </span>
              )}
              {selectedYear !== "All" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream border border-line text-ink font-mono text-[11px]">
                  Year: {selectedYear}
                  <button onClick={() => setSelectedYear("All")} className="hover:text-ink font-bold">✕</button>
                </span>
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11.5px] font-mono text-accent hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── MENTORS GRID ──────────────────────────────────────── */}
        {loading || !mentors ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-[210px] rounded-[18px] border border-line bg-card/60 p-5 animate-pulse" />
            ))}
          </div>
        ) : paginated.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginated.map((m) => (
              <MentorCard
                key={`${m.name}-${m.orgs.join("-")}`}
                mentor={m}
                onSelectTech={(tech) => setSelectedTech(tech)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4 bg-card border border-line rounded-[20px] shadow-soft mt-4">
            <div className="w-16 h-16 rounded-full bg-cream border border-line mx-auto grid place-items-center text-dim text-2xl mb-4">
              🔍
            </div>
            <h3 className="font-display font-bold text-[20px] text-ink">
              No mentors match your criteria
            </h3>
            <p className="text-cocoa text-[13.5px] max-w-[440px] mx-auto mt-2 leading-[1.6]">
              We couldn&apos;t find any mentors matching your current filters. Try relaxing your search terms or clearing the selected technology stack and program.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className={btn("primary", "md", "mt-6")}
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* ── PAGINATION BAR ────────────────────────────────────── */}
        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between gap-4 mt-10 pt-6 border-t border-line flex-wrap"
            aria-label="Pagination"
          >
            <div className="text-[12.5px] font-mono text-dim">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length.toLocaleString()} mentors
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className={`min-h-[44px] px-3.5 rounded-[10px] font-mono text-[12px] font-semibold border transition-colors flex items-center gap-1 ${
                  page <= 1
                    ? "opacity-40 cursor-not-allowed bg-card border-line text-dim"
                    : "bg-card border-line text-ink hover:bg-cream active:scale-95 cursor-pointer"
                }`}
                aria-label="Go to previous page"
              >
                ← Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5 && page > 3) {
                    pNum = Math.min(totalPages - 4 + i, page - 2 + i);
                  }
                  const isCurrent = page === pNum;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => handlePageChange(pNum)}
                      className={`min-w-[44px] min-h-[44px] rounded-[10px] font-mono text-[12px] font-semibold border transition-all grid place-items-center ${
                        isCurrent
                          ? "bg-coffee text-foam border-coffee shadow-sm font-bold"
                          : "bg-card border-line text-cocoa hover:bg-cream cursor-pointer"
                      }`}
                      aria-label={`Page ${pNum}`}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className={`min-h-[44px] px-3.5 rounded-[10px] font-mono text-[12px] font-semibold border transition-colors flex items-center gap-1 ${
                  page >= totalPages
                    ? "opacity-40 cursor-not-allowed bg-card border-line text-dim"
                    : "bg-card border-line text-ink hover:bg-cream active:scale-95 cursor-pointer"
                }`}
                aria-label="Go to next page"
              >
                Next →
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* ── MOBILE FILTERS DRAWER ──────────────────────────────── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[100] md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-coffee/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative z-[101] bg-card border-t border-line rounded-t-[24px] p-6 max-h-[85vh] overflow-y-auto shadow-lift">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
              <h2 className="font-display font-bold text-[18px] text-ink">
                Filter Mentors
              </h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-8 h-8 rounded-full bg-cream border border-line text-ink grid place-items-center text-sm font-bold"
                aria-label="Close filters drawer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Program */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[.12em] text-dim mb-1.5">
                  Program
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PROGRAMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProg(p)}
                      className={`min-h-[44px] px-3 py-2 rounded-[10px] text-[12.5px] font-medium border text-left truncate transition-colors ${
                        selectedProg === p
                          ? "bg-coffee text-foam border-coffee font-semibold"
                          : "bg-cream border-line text-ink"
                      }`}
                    >
                      {p === "All" ? "All Programs" : p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Organization */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[.12em] text-dim mb-1.5">
                  Organization
                </label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="w-full min-h-[44px] bg-cream border border-line rounded-[10px] px-3 text-[13px] text-ink outline-none"
                >
                  <option value="All">All Organizations ({allOrgs.length})</option>
                  {allOrgs.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[.12em] text-dim mb-1.5">
                  Year Active
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setSelectedYear(y)}
                      className={`min-h-[44px] px-3 py-2 rounded-[10px] text-[12px] font-mono border text-center transition-colors ${
                        selectedYear === y
                          ? "bg-coffee text-foam border-coffee font-bold"
                          : "bg-cream border-line text-ink"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[.12em] text-dim mb-1.5">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "projects" | "name" | "recent")}
                  className="w-full min-h-[44px] bg-cream border border-line rounded-[10px] px-3 text-[13px] text-ink outline-none"
                >
                  <option value="projects">Most Projects Mentored</option>
                  <option value="name">Name (A to Z)</option>
                  <option value="recent">Most Recent Year</option>
                </select>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line flex items-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className={btn("outline", "md", "flex-1 min-h-[44px]")}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className={btn("primary", "md", "flex-1 min-h-[44px]")}
              >
                Show Results ({filtered.length.toLocaleString()})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MENTOR CARD COMPONENT ───────────────────────────────────────
function MentorCard({
  mentor,
  onSelectTech,
}: {
  mentor: MentorCatalogItem;
  onSelectTech: (tech: string) => void;
}) {
  // Check if any of the mentor's organizations match an organization in our catalog
  const matchedOrg = useMemo(() => {
    for (const orgName of mentor.orgs) {
      const match = ORGS.find(
        (o) =>
          o.name.toLowerCase() === orgName.toLowerCase() ||
          o.login.toLowerCase() === orgName.toLowerCase()
      );
      if (match) return match;
    }
    return null;
  }, [mentor.orgs]);

  return (
    <article className="group flex flex-col justify-between rounded-[18px] border border-line bg-card p-5 shadow-soft hover:shadow-lift hover:border-accent/40 transition-all duration-200">
      <div>
        {/* Header: Portrait avatar + Name & Program badge */}
        <div className="flex items-start gap-3.5 mb-3.5">
          <div className="shrink-0 overflow-hidden rounded-[12px] bg-cream border border-line">
            <Portrait name={mentor.name} size={46} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-[16px] text-ink truncate leading-tight group-hover:text-accent transition-colors">
                {mentor.name}
              </h2>
            </div>

            <span className="block font-mono text-[10px] text-dim truncate mt-1">
              Active {mentor.years.join(", ")}
            </span>
          </div>

          <div className="shrink-0">
            <span className="font-mono text-[11px] font-bold text-accent bg-accent/8 border border-accent/20 px-2.5 py-1 rounded-full">
              {mentor.projects} {mentor.projects === 1 ? "project" : "projects"}
            </span>
          </div>
        </div>

        {/* Programs & Organizations */}
        <div className="space-y-2 mb-3.5">
          {/* Programs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {mentor.progs.map((prog) => (
              <span
                key={prog}
                className="font-mono text-[9.5px] uppercase tracking-[.08em] px-2 py-0.5 rounded-[6px] bg-cream border border-line text-cocoa"
              >
                {prog}
              </span>
            ))}
          </div>

          {/* Organizations */}
          <div className="text-[12.5px] text-ink leading-snug">
            {matchedOrg ? (
              <Link
                to={`/organizations/${matchedOrg.login}`}
                className="font-medium hover:text-accent hover:underline inline-flex items-center gap-1"
                title={`View ${matchedOrg.name} profile`}
              >
                🏢 {matchedOrg.name}
              </Link>
            ) : (
              <span className="text-cocoa font-medium truncate block">
                🏢 {mentor.orgs.join(", ") || "Independent Open Source Project"}
              </span>
            )}
          </div>
        </div>

        {/* Tech Stack Chips */}
        {mentor.techs.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {mentor.techs.slice(0, 5).map((tech) => (
              <button
                key={tech}
                type="button"
                onClick={() => onSelectTech(tech)}
                className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-line bg-cream hover:bg-accent/10 hover:border-accent/30 hover:text-accent text-cocoa transition-colors cursor-pointer"
                title={`Filter by ${tech}`}
              >
                {tech}
              </button>
            ))}
            {mentor.techs.length > 5 && (
              <span className="font-mono text-[9px] text-dim self-center">
                +{mentor.techs.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Highlight Sample Project */}
        {mentor.sampleTitle && (
          <div className="rounded-[10px] bg-cream/70 border border-line/70 p-2.5 mb-4">
            <span className="block font-mono text-[8.5px] uppercase tracking-[.12em] text-dim mb-1">
              Sample Accepted Project
            </span>
            <p className="text-[12px] text-cocoa line-clamp-2 leading-[1.4] italic">
              &ldquo;{mentor.sampleTitle}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Card Footer: Action Link to Project Archive */}
      <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-2 mt-auto">
        <span className="font-mono text-[10px] text-dim">
          Verified Archive Record
        </span>
        {mentor.sampleUrl ? (
          <a
            href={mentor.sampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={btn("outline", "sm", "text-[11px] font-mono py-1 px-2.5 min-h-[34px] flex items-center gap-1")}
          >
            Project ↗
          </a>
        ) : (
          <span className="font-mono text-[10px] text-dim">Official Archive</span>
        )}
      </div>
    </article>
  );
}
