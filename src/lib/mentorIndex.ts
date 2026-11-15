/* ══ mentorIndex.ts — the mentors each program names, from its own record.
   Built by scripts/build-mentor-index.mjs. Two shapes of evidence feed it:
   the comma-separated mentor field on archived project rows (GSoC, Outreachy,
   Summer of Bitcoin), and sources that publish mentors as people - LFX's own
   mentor directory and project records, GSSoC's mentor board, the Mentor line
   on each Season of KDE ideas page. Loaded on demand and cached for the
   session, because a few thousand names have no business being in the bundle.

   What this is not: a headcount of people. Names are strings, so two spellings
   of one person count twice and one person across two programs counts once per
   program. Where a source caps what it exposes - GSSoC serves 200 mentor rows
   and no more - the record says so rather than guessing at the rest. The page
   repeats all of this.                                                 ═ */
import { useEffect, useState } from "react";

export type MentorRow = {
  name: string;
  projects: number;
  years: number[];
  orgs: string[];
  orgCount?: number;
  login?: string;
  skills?: string[];
};

export type MentorProgram = {
  label: string;
  /** the years our record covers for this program, e.g. [2022, 2026] */
  years: number[];
  mentors: number;
  projectsWithMentors: number | null;
  top: MentorRow[];
  note?: string;
  capped?: boolean;
  participants?: number;
  directory?: { registered: number; nameable: number; withProjects: number; source: string; note: string } | null;
};

export type MentorFile = {
  generated: string;
  note: string;
  programs: Record<string, MentorProgram>;
};

export type Mentors = {
  ready: boolean;
  program: MentorProgram | null;
  generated: string;
  note: string;
};

let cache: Promise<MentorFile | null> | null = null;

export function loadMentors(): Promise<MentorFile | null> {
  if (!cache) {
    cache = fetch("/data/mentor-index.json")
      .then((r) => (r.ok ? (r.json() as Promise<MentorFile>) : null))
      .catch(() => null);
  }
  return cache;
}

const EMPTY: Mentors = { ready: false, program: null, generated: "", note: "" };

export function useMentors(id: string): Mentors {
  const [state, setState] = useState<Mentors>(EMPTY);
  useEffect(() => {
    let go = true;
    loadMentors().then((file) => {
      if (!go) return;
      setState({
        ready: true,
        program: file?.programs?.[id] ?? null,
        generated: file?.generated ?? "",
        note: file?.note ?? "",
      });
    });
    return () => { go = false; };
  }, [id]);
  return state;
}

/** every program whose record names mentors: the four project archives plus the
    two programs that publish a mentor list of their own (GSSoC's board, the
    Season of KDE ideas pages). Outreachy names its mentors nowhere. */
export const MENTOR_IDS = ["gsoc", "lfx", "sob", "gssoc", "kde"] as const;
