import { z } from "zod";
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { PROGRAMS } from "@/data/orgs";
import { KIND_LABEL, KINDS, type Activity } from "@/lib/activity";

const size = z.enum(["A4", "LETTER"]).default("A4");
export const reportRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("projects"), ids: z.array(z.string().min(1).max(200)).min(1).max(10), size }).strict(),
  z.object({ kind: z.literal("programs"), ids: z.array(z.string().min(1).max(80)).min(1).max(20).optional(),
    status: z.enum(["all", "live", "upcoming", "closed"]).default("all"), size }).strict(),
  z.object({ kind: z.literal("activity"), size }).strict(),
]);
export type ReportRequest = z.input<typeof reportRequest>;
export type ReportSection = {
  title: string; subtitle: string; notes: string[]; fields: [string, string][];
  chart?: { title: string; rows: { label: string; value: number }[] };
  entries?: { title: string; detail: string; url: string }[];
};
export type PdfReport = { title: string; size: "A4" | "LETTER"; createdAt: string; sections: ReportSection[] };
export class ReportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const catalog = [...REPOS, ...PROGRAM_REPOS];
const unique = (ids: string[]) => [...new Set(ids.map((id) => id.toLowerCase()))];
// Bounds keep both the layout and renderer work finite; omitted text is explicitly marked.
export const reportText = (value: string, max = 1600) => {
  const text = value.normalize("NFC").replace(/\p{Cc}/gu, " ").replace(/[\u2010-\u2015]/g, "-");
  return text.length > max ? `${text.slice(0, max)} [truncated]` : text;
};

export function catalogReport(input: Exclude<z.output<typeof reportRequest>, { kind: "activity" }>, now = new Date()): PdfReport {
  const report: PdfReport = { title: input.kind === "projects" ? "Project report" : "Program catalog", size: input.size,
    createdAt: now.toISOString(), sections: [] };
  if (input.kind === "projects") {
    report.sections = unique(input.ids).map((id) => {
      const repo = catalog.find((row) => row.repo.toLowerCase() === id);
      if (!repo) throw new ReportError("A selected project is not in the current catalog. Refresh your selection.", 404);
      return {
        title: repo.repo, subtitle: "Repository catalog snapshot",
        notes: [reportText(repo.desc), "Counts are saved catalog data, not live GitHub totals. Live contributor and language breakdowns are not included."],
        fields: [["Source", repo.url], ["Last updated in snapshot", repo.updated], ["Primary language", repo.lang || "Not published"],
          ["License", repo.license || "Not published"], ["Tags", repo.tags.join(", ") || "None"]],
        chart: { title: "Recorded repository counts", rows: [{ label: "Stars", value: repo.stars }, { label: "Forks", value: repo.forks }, { label: "Open issues", value: repo.issues }] },
      };
    });
  } else {
    const ids = input.ids ? unique(input.ids) : null;
    if (ids?.some((id) => !PROGRAMS.some((p) => p.id === id))) throw new ReportError("A selected program is not in the current catalog.", 404);
    const programs = PROGRAMS.filter((p) => (!ids || ids.includes(p.id)) && (input.status === "all" || p.status === input.status));
    if (!programs.length) throw new ReportError("No programs match this filter.", 422);
    const filter = `Status: ${input.status}. ${ids ? "Selected programs only." : "All matching catalog programs."}`;
    report.sections.push({ title: "Program catalog", subtitle: filter, fields: [["Programs exported", String(programs.length)]],
      notes: ["Published catalog information, not a live application-status check. Confirm dates and eligibility with each organizer."],
      chart: { title: "Programs by recorded status", rows: ["live", "upcoming", "closed"].map((label) => ({ label, value: programs.filter((p) => p.status === label).length })) } });
    for (const p of programs) report.sections.push({
      title: p.name, subtitle: `Program information - ${p.status}`, notes: [p.tag],
      fields: [["Official source", p.url], ["Application window", p.window || "Not published"], ["Stipend", p.pay || "Not published"],
        ["Organizations", p.orgs || "Not published"], ["Projects", p.slots || "Not published"],
        ["Country eligibility", p.eligibilityCountries?.note || "Not published"], ["Participant eligibility", p.eligibilityStatus?.note || "Not published"]],
      chart: { title: "Published phase durations (months)", rows: p.phases.map((phase) => ({
        label: `${phase.label} (${phase.s}-${phase.e})`, value: Math.max(0, Math.min(12, phase.e - phase.s)),
      })) },
    });
  }
  return report;
}

export function activityReport(login: string, feed: { events: Activity[]; fetchedAt: number }, size: PdfReport["size"], now = new Date()): PdfReport {
  const events = feed.events.slice(0, 100);
  const report: PdfReport = { title: "Recent public activity", size, createdAt: now.toISOString(), sections: [{
    title: login, subtitle: "Recent public GitHub activity",
    notes: ["Source: the first page of GitHub's public Events API (at most 100 source events). This is a partial recent window, not all-time history, commit totals or a contribution score.",
      "Counts below describe normalized events returned in this response; private activity is not included."],
    fields: [["GitHub profile", `https://github.com/${encodeURIComponent(login)}`], ["Feed fetched at", new Date(feed.fetchedAt).toISOString()],
      ["Events in this response", String(events.length)], ["Newest event", events[0]?.time || "No recent events"], ["Oldest event", events.at(-1)?.time || "No recent events"]],
    chart: { title: "Events in this response by kind", rows: KINDS.map((kind) => ({ label: KIND_LABEL[kind], value: events.filter((a) => a.kind === kind).length })).filter((row) => row.value > 0) },
  }] };
  for (let i = 0; i < events.length; i += 15) report.sections.push({
    title: "Recent event details", subtitle: `${login} - events ${i + 1}-${Math.min(i + 15, events.length)} of ${events.length}`, notes: [], fields: [],
    entries: events.slice(i, i + 15).map((a) => ({ title: reportText(a.title, 140), detail: reportText(`${a.time} | ${KIND_LABEL[a.kind]} | ${a.repo}`, 180), url: reportText(a.url, 200) })),
  });
  return report;
}
