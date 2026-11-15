import type { Metadata } from "next";
import Programs from "@/views/Programs";
import { fmtFull, STATS } from "@/lib/siteStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Programs",
  description: `${STATS.programs} tracked open-source programs - stipends, calendars, eligibility - plus ${fmtFull(STATS.archive)} project records read out of ${STATS.archivePrograms} of their own archives.`,
  alternates: { canonical: canonical("/programs") },
};

export default function Page() {
  return <Programs />;
}
