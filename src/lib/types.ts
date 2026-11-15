/* ══ shared domain types ═══════════════════════════════════ */

export interface Repo {
  cat: string;
  repo: string;
  stars: number;
  forks: number;
  issues: number;
  lang: string;
  license: string;
  updated: string;
  home: string;
  url: string;
  desc: string;
  tags: string[];
}

export interface Category { id: string; label: string }

export interface Phase { label: string; s: number; e: number; c: string; active?: boolean }

export interface Program {
  id: string; name: string; owner: string; img: string; url: string;
  tag: string; pay?: string; payNote?: string;
  status: "live" | "upcoming" | "closed";
  window?: string; orgs?: string; slots?: string;
  phases: Phase[];
}

export type Level = "beginner" | "intermediate" | "advanced";

export interface Org {
  login: string; name: string; domain: string; level: Level;
  tagline: string; tags: string[]; repos: number; stars: number; issues: number;
}

export type ProgramStatus = Program["status"];
