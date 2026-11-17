/* ══ src/types/programs.ts — Program catalog TypeScript types ═══════ */
export interface ProgramSeason {
  year: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface OpenSourceProgram {
  id: string;
  name: string;
  slug: string;
  organizer: string;
  website: string;
  description: string;
  category: "mentored" | "hackathon" | "fellowship";
  stipendAvailable: boolean;
  seasons: ProgramSeason[];
}
