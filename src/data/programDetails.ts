/* ══ programDetails.ts — deep-dive content for the tracked programs ══
   One entry per /programs/:id route. Anything numeric here comes from the
   organizer's own published page or from the project archive already in
   public/data; where a program publishes no figures we say so in the copy
   instead of filling the gap with an estimate.                        ══ */
import type { Level } from "../lib/types";

export interface ProgramYear { year: number; n: number }

/* The application window as the organizer's published copy states it.
   `label` and `period` are quoted from that copy, not rewritten into a
   calendar: a program that names a stage but publishes no dates carries the
   stage and omits `period`, and the comparison prints "Not published" for the
   date instead of guessing one. */
export interface ApplicationWindow {
  label: string;
  period?: string;
  note?: string;
  source: string;
}

export interface ProgramDetailData {
  level: Level;
  duration: string;
  tier: string;
  difficulty: string;
  /* only set where the organizer states a rule; when they publish none the
     field is absent and the surfaces read "Not published", never "no rule" */
  eligibility?: string;
  /* only set where the published copy states an application or registration
     window; the comparison reads this instead of inferring dates from the
     program's season */
  applicationWindow?: ApplicationWindow;
  tags: string[];
  about: string[];
  howItWorks: [string, string][];
  whoFor: string[];
  outcomes: string[];
  stack: string[];
  focus: string[];
  chartTitle: string;
  chartUnit: string;
  /* only set where the organizer publishes real per-cycle figures; a program
     with no numbers omits it and the page drops the chart rather than inventing one */
  projectsPerYear?: ProgramYear[];
}

/* name -> program id used in /programs/:id routes */
export const PROGRAM_ID_BY_NAME: Record<string, string> = {
  GSoC: "gsoc",
  GSSoC: "gssoc",
  LFX: "lfx",
  Outreachy: "outreachy",
  "Eclipse SoC": "esoc",
  "Season of KDE": "kde",
  "MLH Fellowship": "mlh",
  Hacktoberfest: "oct",
  "Summer of Bitcoin": "sob",
  "Nexus Spring of Code": "nsoc",
  "24 Pull Requests": "24pr",
  "FOSSEE Summer Fellowship": "fossee",
  "Vercel Open Source Program": "vercel-oss",
};

export const programLink = (name: string): string =>
  PROGRAM_ID_BY_NAME[name] ? `/programs/${PR}