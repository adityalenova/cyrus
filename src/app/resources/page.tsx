import type { Metadata } from "next";
import Resources from "@/views/Resources";
import { fmt, STATS } from "@/lib/siteStats";

export const metadata: Metadata = { title: "Resources", description: `${fmt(STATS.resources)} first-party learning resources for agents, open source and hackathons.` };

export default function Page() {
  return <Resources />;
}
