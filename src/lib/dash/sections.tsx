"use client"
/* == sections.tsx - the /dashboard/<feature> router ==============
   The three board pages live in issues.tsx, repos.tsx and settings.tsx;
   the working tools live in tools.tsx, calendar.tsx, drafts.tsx,
   analyser.tsx and demand.tsx. This file only picks one and renders it. == */
import { Link } from "@/lib/router";
import { btn } from "../../components/ui";
import { Card } from "./shell";
import { DP, featureBy } from "./shared";
import { IssuesSection } from "./issues";
import { ReposSection } from "./repos";
import { SettingsSection } from "./settings";
import { CalendarSection } from "./calendar";
import { DraftsSection } from "./drafts";
import { AnalyserSection } from "./analyser";
import { DemandSection } from "./demand";
import { TOOL_SECTIONS } from "./tools";
import type { Dash } from "./useDash";
import { BookmarksSection } from "./bookmarks";
import BadgesPage from "@/views/BadgesPage";
import StreaksPage from "@/views/StreaksPage";

export { AttentionList, IssuesSection } from "./issues";
export { ReposSection } from "./repos";
export { SettingsSection } from "./settings";

/* the board's own tool pages, in the order the sidebar shows them */
const OWN: Record<string, (p: { d: Dash }) => React.ReactNode> = {
  bookmarks: BookmarksSection,
  badges: () => <BadgesPage />,
  streaks: () => <StreaksPage />,
  calendar: CalendarSection,
  drafts: DraftsSection,
  analyser: AnalyserSection,
  demand: DemandSection,
};

export function FeaturePage({ d, id }: { d: Dash; id: string }) {
  const f = featureBy(id);
  if (!f) return <MissingFeature id={id} />;
  if (f.id === "issues") return <IssuesSection d={d} />;
  if (f.id === "repos") return <ReposSection d={d} />;
  if (f.id === "settings") return <SettingsSection d={d} />;
  if (f.id === "bookmarks") return <BookmarksSection key={d.serverUser?.id ?? "local"} />;
  const Own = OWN[f.id];
  if (Own) return <Own d={d} />;
  const Tool = TOOL_SECTIONS[f.id];
  if (Tool) return <Tool d={d} />;
  return <SettingsSection d={d} />;
}

function MissingFeature({ id }: { id: string }) {
  return (
    <Card className="text-center py-14">
      <p className="eyebrow mb-3 flex items-center justify-center gap-2">
        <IcMark /> Not on the board
      </p>
      <h1 className="font-display font-extrabold text-[26px] tracking-[-.02em]">
        There is no page called “{id}”.
      </h1>
      <p className="text-cocoa text-[13.5px] mt-2">The board holds your issues, your repositories, eight working tools and settings.</p>
      <Link to="/dashboard" className={btn("primary", "md") + " mt-6"}>Back to the overview</Link>
    </Card>
  );
}

const IcMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d={DP.x} />
  </svg>
);
