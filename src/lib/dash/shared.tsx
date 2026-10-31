/* ══ dash/shared.tsx — constants + pure helpers for the board ══════
   No "use client" here on purpose: the /dashboard/[feature] route reads
   FEATURES during static-param generation, and this file is pure data
   and math anyway.                                                  ══ */

/* the board is a full-width application shell, not an article column */
export const W = "max-w-[1440px] mx-auto px-5 md:px-7";

/* ── issue pipeline: the four stages the product speaks about ───── */
export const ISSUE_STAGES = ["saved", "interested", "working", "done"] as const;
export type IssueStage = (typeof ISSUE_STAGES)[number];
export const STAGE_LABEL: Record<IssueStage, string> = {
  saved: "Saved",
  interested: "Interested",
  working: "Working on it",
  done: "Completed",
};
/* what each stage means to the person holding the board */
export const STAGE_NOTE: Record<IssueStage, string> = {
  saved: "On the list. Nothing committed yet.",
  interested: "You have read the thread and mean to take it.",
  working: "A branch exists; the pull request is open or about to be.",
  done: "Merged, closed or handed back. The record stays.",
};

export const STAGE_NEXT: Record<IssueStage, IssueStage> = {
  saved: "interested",
  interested: "working",
  working: "done",
  done: "saved",
};
export const STAGE_CLS: Record<IssueStage, string> = {
  saved: "text-cocoa border-line bg-cream",
  interested: "text-denim border-denim/35 bg-denim/10",
  working: "text-honey border-honey/35 bg-honey/10",
  done: "text-leaf border-leaf/35 bg-leaf/10",
};

export interface TrackedIssue {
  url: string; repo: string; title: string; number: number;
  lang?: string | null; stars?: number; labels?: string[]; beginner?: boolean;
  updated?: string; added: string;
}

/* A GitHub issue URL is the only thing we accept from a paste box.
   Everything else about an issue comes from the crawl. */
export function parseIssueUrl(raw: string): { url: string; repo: string; number: number } | null {
  try {
    let s = raw.trim();
    if (!s) return null;
    if (s.startsWith("//")) s = "https:" + s;
    else if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(s)) s = "https://" + s;
    const u = new URL(s);
    if (u.hostname !== "github.com") return null;
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/);
    if (!m) return null;
    return { url: `https://github.com/${m[1]}/${m[2]}/issues/${m[3]}`, repo: `${m[1]}/${m[2]}`, number: Number(m[3]) };
  } catch {
    return null;
  }
}

export const daysAgo = (iso: string): number => Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 864e5));

/* A crawl row older than this is a warning sign, not a beginner invite. */
export const STALE_DAYS = 90;
export const isStale = (iso?: string) => (iso ? daysAgo(iso) > STALE_DAYS : false);

export const greet = () => {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Late session";
};

/* ── the board's own pages. Everything else lives outside it. ───── */
export type FeatureId = "issues" | "repos" | "calendar" | "matcher" | "mentors" | "compare" | "gitstart" | "drafts" | "analyser" | "demand" | "settings";
export const FEATURES: { id: FeatureId; title: string; icon: string; desc: string }[] = [
  { id: "issues", title: "My Issues", icon: "issue", desc: "Every issue you took, held at the stage you left it: saved, interested, working, done." },
  { id: "repos", title: "My Repositories", icon: "repo", desc: "The repositories you follow, with the stars, open issues and last update that decide where you contribute." },
  { id: "calendar", title: "Season calendar", icon: "calendar", desc: "Application windows and coding periods for all thirteen programs on one grid, with Google Calendar and .ics export." },
  { id: "matcher", title: "Co-pilot", icon: "spark", desc: "Four steps: the skills you write, what you want from a season, what fits, and the organizations, repositories and live open issues that come out of it." },
  { id: "mentors", title: "Mentor finder", icon: "target", desc: "Search the people who actually mentored a GSoC project, by name, organization or technology, straight from the archive." },
  { id: "compare", title: "Compare orgs", icon: "layers", desc: "Two organizations, every public number we track for them, side by side - stars, repos, issues and the programs each runs." },
  { id: "gitstart", title: "Git initializer", icon: "code", desc: "Paste the issue you claimed and get the seven commands that turn it into a branch, a commit and an open pull request." },
  { id: "drafts", title: "Draft studio", icon: "file", desc: "Write the four files a repository is judged on - README, CONTRIBUTING, LICENSE and CODE_OF_CONDUCT - and download them clean." },
  { id: "analyser", title: "Repo analyser", icon: "pulse", desc: "Any public repository, read live from GitHub: activity, open work, maintainer load and whether it is ready for a first contributor." },
  { id: "demand", title: "Demand radar", icon: "star", desc: "What five years of accepted projects actually asked for - technologies, organizations and scale, counted from the archive." },
  { id: "settings", title: "Settings", icon: "settings", desc: "Theme, what the board holds about you, and a way to delete everything it remembers." },
];
export const featureBy = (id: string) => FEATURES.find((f) => f.id === id);

/* loose text match for the board filters: lowercase, collapse whitespace */
export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/* ── icon path library - every stroke icon on the board ─────── */
export const DP: Record<string, string> = {
  grid: "M4 5.5h6.5V12H4zM13.5 5.5H20V10h-6.5zM13.5 13H20v5.5h-6.5zM4 15h6.5v3.5H4z",
  issue: "M12 8.5v4.5M12 16.6v.1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  repo: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM8 4v13M11 8h6",
  star: "M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z",
  building: "M4 21V6.5L11 3.5V21M11 21h9V10l-9-2.8M7 9.5v.1M7 13v.1M7 16.5v.1M15 13v.1M15 16.5v.1",
  calendar: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  pulse: "M3 12h4l2.5-7 4 14L16 12h5",
  code: "M8.5 8L3.5 13l5 5M15.5 8l5 5-5 5M13.5 4.5l-3 17",
  plus: "M12 5v14M5 12h14",
  x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  bookmark: "M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1z",
  check: "M4 12.5 10 18.5 20 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  home: "M4 11 12 4l8 7M6 9.5V20h12V9.5",
  bell: "M18 15V10a6 6 0 1 0-12 0v5l-2 3h16l-2-3zM10 21h4",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 4.6h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.4 2.3-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.6.1-1z",
  collapse: "M20 4H4v16h16V4zM14 4v16M4 9h4m-4 4h4",
  expand: "M4 4h16v16H4V4zM10 4v16M14 12h4m-4-3h4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  github: "M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.6-.2.6-.5v-1.7c-2.4.5-3-.9-3.2-1.7-.2-.5-.9-1.7-1.5-2-.5-.3-1.2-.8 0-.9 1.1 0 1.9 1 2.1 1.4 1.2 2 3.1 1.4 3.9 1.1.1-.9.4-1.4.8-1.8-2.4-.3-4.4-1.2-4.4-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.7-2 4.6-4.4 4.9.5.5.8 1.2.8 2.4v3.5c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5z",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  sun: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M11 8l-4 4 4 4M7 12h11",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5",
  flag: "M5 21V4m0 0 6 2 8-2v9l-8 2-6-2",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  download: "M12 4v11m0 0-4-4m4 4 4-4M4 19h16",
  link: "M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1",
  spark: "M12 4l1.7 4.9L18.6 10l-4.9 1.7L12 16.6l-1.7-4.9L5.4 10l4.9-1.4L12 4z",
  file: "M14 3v5h5M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-5-5zM9 13h6M9 16.5h4",
};
