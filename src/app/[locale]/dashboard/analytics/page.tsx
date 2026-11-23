import type { Metadata } from "next";
import OrgAnalytics from "@/views/OrgAnalytics";
import { canonical } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* A board surface over a public dataset: worth linking from the organization
   pages, not worth a search result of its own, so it carries its canonical
   and stays out of the index. */
export async function generateMetadata(): Promise<Metadata> {
  const url = canonical("/dashboard/analytics");
  const description = "Organization engagement analytics: participation by season, top organizations, sector and stack mix, period comparison and CSV export.";
  return {
    title: "Organization analytics · Board",
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: { title: "Organization analytics · cyrus.ai", description, url },
  };
}

export default function Page() {
  return <OrgAnalytics />;
}
