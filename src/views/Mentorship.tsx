"use client";

/* ══ Mentorship.tsx — the open source mentor directory: ~6.2k verified
   mentors across GSoC, LFX Mentorship, Summer of Bitcoin and Season of KDE,
   fetched at runtime from /data/mentors-catalog.json — listed in the authentic
   Cyrus / Contribo style with a sticky filter rail, tech stack chips, program
   facets, and verified project links. ═════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { ORGS } from "../data/orgs";
import { fmtFull } from "../lib/siteStats";
import { useStore } from "../lib/store";
import { btn, Chip, Portrait, Word } from "../components/ui";
import { useMentorsCatalog, type MentorCatalogItem } from "../lib/mentorIndex";

const W = "max-w-[1240px] mx-auto px-6";

const POPULAR_STACKS = [
  "python",
  "c++",
  "javascript",
  "typescript",
  "rust",
  "go",
  "docker",
  "react",
  "pytorch",
  "kubernetes",
  "java",
  "linux",
  "django",
  "postgresql",
  "flutter",
  "machine learning",
  "qt",
  "git",
];

const PROGRAM_LABELS: Record<string, string> = {
  all: "All Programs",
  gsoc: "Google Summer of Code",
  lfx: "LFX Mentorship",
  sob: "Summer of Bitcoin",
  kde: "Season of KDE",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* our live GitHub directory, keyed by normalised name AND login */
const DIR_LOGIN = new Map<string, string>();
for (const o of ORGS) {
  DIR_LOGIN.set(norm(o.login), o.login);
  DIR_LOGIN.set(norm(o.name), o.login);
}

function orgTarget(orgName: string): string | null {
  const dir = DIR_LOGIN.get(norm(orgName));
  return dir ? `/organizations/${dir}` : null;
}

/* ── mentor card — authentic Cyrus design with program chips, tags & project links ── */
function MentorCard({ m }: { m: MentorCatalogItem }) {
  const { saved, toggleSaved, toast } = useStore();
  const trackKey = `mentor:${m.name.toLowerCase()}`;
  const on = saved.includes(trackKey);

  const primaryOrg = m.orgs[0] || "Open Source";
  const orgTo = orgTarget(primaryOrg);

  return (
    <article className="group bg-card border border-line rounded-[18px] p-[18px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/45">
      <div className="flex items-start gap-3">
        <div className="shrink-0 overflow-hidden rounded-[13px] bg-cream border border-line w-[44px] h-[44px]">
          <Portrait name={m.name} size={44} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="card-title text-[16px] line-clamp-1">{m.name}</h3>
          <p className="font-mono text-[10px] tracking-[.09em] uppercase text-dim mt-1.5 truncate">
            {m.orgs.join(", ") || "Open Source"}{m.years.length ? ` • ${m.years.join(", ")}` : ""}
          </p>
        </div>
      </div>

      {/* Program and Project count chips */}
      <div className="flex gap-1.5 flex-wrap mt-3">
        {m.progs.map((p) => (
          <Chip key={p} tone="cat">
            {p === "GSoC" ? "Google Summer of Code" : p}
          </Chip>
        ))}
        <Chip tone="stars">
          ★ {m.projects} {m.projects === 1 ? "project" : "projects"}
        </Chip>
      </div>

      {/* Sample project highlight */}
      {m.sampleTitle && (
        <p className="text-cocoa text-[12.5px] leading-[1.55] mt-2.5 line-clamp-2 italic">
          &ldquo;{m.sampleTitle}&rdquo;
        </p>
      )}

      {/* Tech stack badges */}
      {m.techs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-3 items-center">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-dim shrink-0"
            aria-hidden="true"
          >
            <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
          </svg>
          {m.techs.slice(0, 3).map((t) => (
            <Chip key={t} tone="lang">
              {t}
            </Chip>
          ))}
          {m.techs.length > 3 && (
            <span className="text-[11.5px] text-dim">+{m.techs.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer action bar */}
      <div className="flex items-center gap-2 mt-auto pt-3.5 border-t border-liness mt-4">
        {m.sampleUrl ? (
          <a
            href={m.sampleUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] font-bold text-accent hover:text-rust transition-colors"
          >
            Project Record ↗
          </a>
        ) : (
          <span className="text-[12px] text-dim font-mono">Official Archive</span>
        )}

        {orgTo && (
          <Link
            to={orgTo}
            title={`View ${primaryOrg} on cyrus.ai`}
            className="font-mono text-[10px] font-bold tracking-[.08em] uppercase text-cocoa border border-line rounded-[9px] px-2.5 py-1.5 hover:border-accent hover:text-rust transition-colors"
          >
            Org
          </Link>
        )}

        <button
          aria-label={on ? `Stop tracking ${m.name}` : `Track ${m.name}`}
          title={on ? "Stop tracking" : "Track on dashboard"}
          onClick={() => {
            const added = toggleSaved(trackKey);
            toast(added ? `Saved mentor ${m.name}` : `Removed ${m.name}`);
          }}
          className={`ml-auto w-[30px] h-[30px] rounded-[9px] border grid place-items-center text-[13px] transition-all cursor-pointer ${
            on
              ? "bg-accent border-accent text-accentfg"
              : "bg-cream border-line text-dim hover:border-accent hover:text-accent"
          }`}
        >
          {on ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default function Mentorship() {
  const { mentors, loading } = useMentorsCatalog();

  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [prog, setProg] = useState(params.get("prog") ?? "all");
  const [year, setYear] = useState(params.get("year") ?? "all");
  const [tech, setTech] = useState(params.get("tech") ?? "all");
  const [org, setOrg] = useState(params.get("org") ?? "all");
  const [sort, setSort] = useState<"projects" | "recent" | "name">(
    (params.get("sort") as "projects" | "recent" | "name") || "projects"
  );
  const [shown, setShown] = useState(60);

  // Sync params with query string
  const write = (
    over: Partial<{
      q: string;
      prog: string;
      year: string;
      tech: string;
      org: string;
      sort: string;
    }>
  ) => {
    const m = { q, prog, year, tech, org, sort, ...over };
    const rec: Record<string, string> = {};
    if (m.q) rec.q = m.q;
    if (m.prog !== "all") rec.prog = m.prog;
    if (m.year !== "all") rec.year = m.year;
    if (m.tech !== "all") rec.tech = m.tech;
    if (m.org !== "all") rec.org = m.org;
    if (m.sort !== "projects") rec.sort = m.sort;
    setParams(rec);
  };

  const setQUrl = (v: string) => {
    setQ(v);
    write({ q: v });
  };
  const setProgUrl = (v: string) => {
    setProg(v);
    write({ prog: v });
    setShown(60);
  };
  const setYearUrl = (v: string) => {
    setYear(v);
    write({ year: v });
    setShown(60);
  };
  const setTechUrl = (v: string) => {
    setTech(v);
    write({ tech: v });
    setShown(60);
  };
  const setOrgUrl = (v: string) => {
    setOrg(v);
    write({ org: v });
    setShown(60);
  };
  const setSortUrl = (v: "projects" | "recent" | "name") => {
    setSort(v);
    write({ sort: v });
  };
  const clearUrl = () => {
    setQ("");
    setProg("all");
    setYear("all");
    setTech("all");
    setOrg("all");
    setSort("projects");
    setParams({});
    setShown(60);
  };

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setProg(params.get("prog") ?? "all");
    setYear(params.get("year") ?? "all");
    setTech(params.get("tech") ?? "all");
    setOrg(params.get("org") ?? "all");
    setSort(
      (params.get("sort") as "projects" | "recent" | "name") || "projects"
    );
  }, [params]);

  // Derived filter options
  const years = useMemo(() => {
    if (!mentors) return [2026, 2025, 2024, 2023, 2022];
    const s = new Set<number>();
    for (const m of mentors) for (const y of m.years) if (y > 0) s.add(y);
    return [...s].sort((a, b) => b - a);
  }, [mentors]);

  const allOrgs = useMemo(() => {
    if (!mentors) return [];
    const s = new Set<string>();
    for (const m of mentors) for (const o of m.orgs) if (o) s.add(o);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [mentors]);

  const list = useMemo(() => {
    if (!mentors) return [];
    const needle = q.trim().toLowerCase();

    const filtered = mentors.filter((m) => {
      if (prog !== "all") {
        const matchesProg = m.progs.some((p) =>
          p.toLowerCase().includes(prog.toLowerCase())
        );
        if (!matchesProg) return false;
      }

      if (year !== "all") {
        const yNum = parseInt(year, 10);
        if (!m.years.includes(yNum)) return false;
      }

      if (tech !== "all") {
        const matchesTech = m.techs.some(
          (t) => t.toLowerCase() === tech.toLowerCase()
        );
        if (!matchesTech) return false;
      }

      if (org !== "all") {
        if (!m.orgs.includes(org)) return false;
      }

      if (needle) {
        const matchName = m.name.toLowerCase().includes(needle);
        const matchOrg = m.orgs.some((o) => o.toLowerCase().includes(needle));
        const matchTech = m.techs.some((t) => t.toLowerCase().includes(needle));
        const matchTitle = (m.sampleTitle || "").toLowerCase().includes(needle);
        if (!matchName && !matchOrg && !matchTech && !matchTitle) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sort === "recent") {
        const aRecent = Math.max(...a.years, 0);
        const bRecent = Math.max(...b.years, 0);
        if (bRecent !== aRecent) return bRecent - aRecent;
        return b.projects - a.projects;
      }
      return b.projects - a.projects || a.name.localeCompare(b.name);
    });

    return filtered;
  }, [mentors, q, prog, year, tech, org, sort]);

  const visible = list.slice(0, shown);

  const fin =
    "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34,197,94,.12)]";
  const lbl =
    "block font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2.5";
  const anyFilter =
    q || prog !== "all" || year !== "all" || tech !== "all" || org !== "all";

  return (
    <div className={`${W} pt-14 pb-12`}>
      {/* ── Breadcrumb ── */}
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">
          Platform
        </Link>{" "}
        <span className="text-accent">›</span>{" "}
        <span className="text-cocoa">Mentorship</span>
      </p>

      {/* ── Page Title ── */}
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Find your <Word>mentor.</Word> Across 4 major programs.
      </h1>

      <p className="text-ink font-medium max-w-[720px] text-[16.5px] leading-[1.6]">
        Over 6,100 verified open-source mentors who guided accepted projects across Google Summer of Code, LFX Mentorship, Summer of Bitcoin, and Season of KDE. Search by technology stack, organization, or program.
      </p>

      {/* ── Warm Callout Box (Cyrus signature banner) ── */}
      <div className="mt-8 bg-gradient-to-br from-clay to-peach/60 border border-line rounded-[22px] px-8 py-7 flex items-center gap-6 flex-wrap max-[700px]:px-5">
        <div className="min-w-[280px] flex-1">
          <h2 className="card-title-xl">
            Looking for mentorship in an open-source program?
          </h2>
          <p className="text-cocoa text-[13.5px] leading-[1.6] mt-2 max-w-[600px]">
            Explore the people who actually reviewed code and guided accepted projects. Narrow by your technology stack — Python, Rust, Go, C++ or React — and inspect the project record directly.
          </p>
        </div>
        <Link
          to="/dashboard/mentors"
          className={btn("primary", "lg") + " shrink-0"}
        >
          Track on your dashboard
        </Link>
      </div>

      {/* ── Rail + Results Two-Column Layout ── */}
      <div className="grid grid-cols-[280px_1fr] gap-7 items-start mt-8 max-[980px]:grid-cols-1">
        {/* ── Sticky Filter Rail (Left) ── */}
        <aside className="sticky top-[86px] max-[980px]:static bg-card border border-line rounded-[22px] p-[22px] shadow-soft grid gap-5">
          <div className="flex items-center gap-2.5">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-ink"
            >
              <path d="M4 6h16M4 12h10M4 18h5" />
              <circle cx="19" cy="18" r="2.5" />
            </svg>
            <span className="font-display font-bold text-[15px] tracking-[-.01em]">
              Filters
            </span>
          </div>

          {/* Search */}
          <div>
            <span className={lbl}>Search</span>
            <input
              className={fin}
              placeholder="Mentor, tech, org..."
              value={q}
              onChange={(e) => {
                setQUrl(e.target.value);
                setShown(60);
              }}
              aria-label="Search mentors"
            />
          </div>

          {/* Program Select */}
          <div>
            <span className={lbl}>Program</span>
            <select
              className={`${fin} select-warm pr-8`}
              value={prog}
              onChange={(e) => setProgUrl(e.target.value)}
              aria-label="Filter by program"
            >
              <option value="all">All Programs</option>
              <option value="GSoC">Google Summer of Code</option>
              <option value="LFX">LFX Mentorship</option>
              <option value="Summer of Bitcoin">Summer of Bitcoin</option>
              <option value="Season of KDE">Season of KDE</option>
            </select>
          </div>

          {/* Organization Select */}
          <div>
            <span className={lbl}>Organization</span>
            <select
              className={`${fin} select-warm pr-8`}
              value={org}
              onChange={(e) => setOrgUrl(e.target.value)}
              aria-label="Filter by organization"
            >
              <option value="all">All Organizations ({allOrgs.length})</option>
              {allOrgs.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Popular Stacks Chips */}
          <div>
            <span className={lbl}>Popular Stacks</span>
            <div className="flex flex-wrap gap-[7px]">
              {POPULAR_STACKS.map((s) => {
                const on = tech.toLowerCase() === s.toLowerCase();
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setTechUrl(on ? "all" : s);
                      setShown(60);
                    }}
                    className={`text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${
                      on
                        ? "bg-coffee border-coffee text-foam"
                        : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className={btn("primary", "md", "w-full")}
            onClick={() =>
              document
                .getElementById("results")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Apply filters
          </button>

          {anyFilter && (
            <button
              className="text-[12.5px] font-semibold text-cocoa hover:text-rust cursor-pointer -mt-2 text-center"
              onClick={clearUrl}
            >
              Reset filters
            </button>
          )}
        </aside>

        {/* ── Results Grid (Right) ── */}
        <section id="results" className="scroll-mt-24">
          {/* Active Program Pill */}
          {prog !== "all" && (
            <p className="font-mono text-[11px] font-bold tracking-[.05em] text-cocoa pb-4">
              <span className="rounded-full border border-line bg-card px-3.5 py-2">
                {PROGRAM_LABELS[prog.toLowerCase()] ?? prog}
                <button
                  onClick={() => setProgUrl("all")}
                  className="ml-2.5 text-accent font-bold hover:underline cursor-pointer"
                >
                  Show every program
                </button>
              </span>
            </p>
          )}

          {/* Active Year Pills */}
          <div className="flex gap-2 flex-wrap pb-4">
            {[
              ["all", "All Years"],
              ...years.map((y) => [String(y), String(y)] as [string, string]),
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setYearUrl(v)}
                className={`font-mono text-[11.5px] font-bold tracking-[.05em] rounded-full px-4 py-2 border transition-all cursor-pointer ${
                  year === v
                    ? "bg-coffee border-coffee text-foam"
                    : "bg-card border-line text-cocoa hover:border-accent hover:text-rust"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Results Bar + Sort */}
          <div className="flex items-center gap-3.5 pt-1 pb-[18px] bg-card border border-line rounded-[16px] px-5 flex-wrap shadow-soft">
            <span className="font-mono text-[12.5px] tracking-[.1em] uppercase text-cocoa">
              <b className="text-ink">{fmtFull(list.length)}</b> mentors found
            </span>

            <span className="ml-auto font-mono text-[10.5px] tracking-[.12em] uppercase text-dim">
              Sort by
            </span>
            <select
              className={`${fin} select-warm !w-auto rounded-full pr-8 py-2 text-[13px] font-semibold`}
              value={sort}
              onChange={(e) =>
                setSortUrl(e.target.value as "projects" | "recent" | "name")
              }
              aria-label="Sort mentors"
            >
              <option value="projects">Most Projects Mentored</option>
              <option value="recent">Most Recent Active</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          {/* Mentors Grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4 max-[1150px]:grid-cols-2 max-[700px]:grid-cols-1 mt-6">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[210px] rounded-[18px] border border-line bg-card/60 p-5 animate-pulse"
                />
              ))}
            </div>
          ) : list.length ? (
            <>
              <div className="grid grid-cols-3 gap-4 max-[1150px]:grid-cols-2 max-[700px]:grid-cols-1 mt-6">
                {visible.map((m) => (
                  <MentorCard
                    key={`${m.name}-${m.orgs.join("-")}`}
                    m={m}
                  />
                ))}
              </div>

              {shown < list.length && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setShown(shown + 60)}
                    className={btn("outline", "lg") + " cursor-pointer min-h-[44px]"}
                  >
                    Show {Math.min(60, list.length - shown)} of{" "}
                    {fmtFull(list.length - shown)} more
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-dim border border-dashed border-line rounded-[22px] bg-cream mt-6">
              <p className="font-display text-[20px] text-cocoa mb-2">
                No mentors match that combination.
              </p>
              <p>
                Loosen a filter — or{" "}
                <button
                  className="text-accent font-semibold hover:underline cursor-pointer"
                  onClick={clearUrl}
                >
                  reset all filters
                </button>
                .
              </p>
            </div>
          )}

          {anyFilter && list.length > 0 && (
            <p className="font-mono text-[10.5px] text-dim mt-5">
              Showing {visible.length} of {fmtFull(list.length)} ·{" "}
              <button
                className="text-accent font-semibold hover:underline cursor-pointer"
                onClick={clearUrl}
              >
                Clear filters
              </button>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
