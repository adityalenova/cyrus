/* ══ util.ts — formatting, hashing, storage helpers ═════════ */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { REPOS } from "../data/repos";
import { PROGRAM_REPOS } from "../data/programRepos";
import type { Level, Repo } from "./types";
import { ORGS } from "../data/orgs";

/** full catalog: the 528-repo agent catalog + program projects */
export const CATALOG: Repo[] = [...REPOS, ...PROGRAM_REPOS];

/** 1500 -> "1.5k": rounded, for star counts and table cells (siteStats.ts fmtFull is exact) */
export const fmtCompact = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

export const byStars = (a: { stars: number }, b: { stars: number }) => b.stars - a.stars;

export const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** warm-tinted gradient tile derived from any string.
    Held dark on purpose: the tile always carries white initials, and the old
    55%-lightness ramp put that text at 2.5:1 on the lighter hues - unreadable
    on the leaderboard and every contributor row. At these lightnesses the
    worst case (a yellow hue, where human eyes see the most luminance) still
    measures 7:1 against white. */
export function tileBG(str: string): string {
  const h = hash(str) % 360;
  return `linear-gradient(135deg, hsl(${h} 32% 26%), hsl(${(h + 40) % 360} 40% 15%))`;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return 1;
  const ch = (h: string) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(m[1]) + 0.7152 * ch(m[2]) + 0.0722 * ch(m[3]);
}

/** Ink that is readable on a given fill - used where a colour comes from the
    data (a program's phase band) rather than from the token ramp, so the
    template cannot promise white. */
export function inkOn(fill: string): string {
  const l = luminance(fill);
  const white = 1.05 / (l + 0.05);
  const dark = (l + 0.05) / 0.0586;            /* #0d0d0d on the fill */
  return dark > white ? "#0d0d0d" : "#ffffff";
}

export function initials(full: string): string {
  const name = full.split("/")[1] || full;
  const parts = name.split(/[-_.]/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export const avatarOf = (owner: string, size = 88) => `https://github.com/${owner}.png?size=${size}`;

export const levelOf = (stars: number): Level =>
  stars > 50000 ? "advanced" : stars > 10000 ? "intermediate" : "beginner";

export const LEVEL_LABEL: Record<Level, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export const repoById = (id: string) => CATALOG.find((r) => r.repo.toLowerCase() === id.toLowerCase());
export const orgByLogin = (login: string) => ORGS.find((o) => o.login.toLowerCase() === login.toLowerCase());
export const reposOfOwner = (owner: string): Repo[] => CATALOG.filter((r) => r.repo.split("/")[0].toLowerCase() === owner.toLowerCase());

export const CAT_META: Record<string, { label: string; color: string }> = {
  skills:   { label: "Agent Skills",          color: "honey" },
  cursor:   { label: "Cursor Rules",          color: "denim" },
  agentsmd: { label: "AGENTS.md & Design.md", color: "leaf" },
  mcp:      { label: "MCP Servers",           color: "plum" },
  tools:    { label: "Dev Agents & Programs", color: "accent" },
  programs: { label: "Program Projects",      color: "denim" },
};

export const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#b7a44a", Python: "#3572A5", Rust: "#c08a63",
  Go: "#0d8fa8", HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", "C++": "#b0517a",
  Shell: "#5f9e43", MDX: "#d99a1c", Vue: "#41b883", Ruby: "#a11a2e", Swift: "#F05138",
  Kotlin: "#A97BFF", Dart: "#00B4AB", "Jupyter Notebook": "#DA5B0B",
};

/** deterministic pseudo-random in [0,1) from (seed, index) */
export const rnd = (seed: string, i = 0) => {
  const h = hash(seed + ":" + i);
  return (h % 10000) / 10000;
};

/* ── localStorage-backed state ───────────────────────────── */
/* The prerenderer has no localStorage, so the stored value cannot be read
   during the first render - a server pass that renders the signed-out board
   and a client pass that renders the signed-in one is a hydration mismatch.
   Both passes start at `initial`; the stored value arrives in the first
   effect, and `ready` tells the caller when that swap has happened so a
   gate can show a neutral placeholder instead of flashing "sign in". */
export function useStored<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  /* React runs a child's effects before its parent's, so anything mounted
     inside the provider can write to this store before the load below has
     run. Google sign-in is exactly that case: the tab comes back from
     accounts.google.com and the landing handler signs the user in during
     its own first effect, while localStorage still holds "null" from the
     last sign-out. A read at that moment would erase the session a frame
     after it was created, so the first read only fills in a value nobody
     has touched yet. */
  const touched = useRef(false);
  const set = useCallback((v: SetStateAction<T>) => { touched.current = true; setVal(v); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!touched.current && raw != null) setVal(JSON.parse(raw) as T);
    } catch { /* private mode or a corrupt value: keep the initial */ }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
  }, [key, val, ready]);
  return [val, set, ready] as const;
}

export interface User { name: string; provider: string; email?: string; picture?: string }
export interface ToastFn { (msg: string): void }
