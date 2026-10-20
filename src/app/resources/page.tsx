import type { Metadata } from "next";
import Resources from "@/views/Resources";
import { fmt, STATS } from "@/lib/siteStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Resources", description: `${fmt(STATS.resources)} first-party learning resources for agents, open source and hackathons.`, alternates: { canonical: canonical("/resources") } };

export default function Page() {
  return <Resources />;
}
