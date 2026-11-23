/* ══ /organizations/analytics — admin analytics dashboard ══════════════
   Issue #187. The page is a thin server shell; the dashboard reads this
   browser's stores and the shipped crawl snapshot on the client, so the
   metadata stays static and honest: what the page shows, and from where. ═ */
import type { Metadata } from "next";
import OrgAnalytics from "@/features/org-analytics/OrgAnalytics";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Organization analytics",
  description:
    "A dashboard over two real sources: events this browser recorded for you (7, 30 or 90 days, "
    + "with period comparison and CSV export) and the crawl snapshot of open issues by organisation "
    + "and repository. No sampled traffic and no invented trends.",
  alternates: { canonical: canonical("/organizations/analytics") },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <OrgAnalytics />;
}
