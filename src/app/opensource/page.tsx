import type { Metadata } from "next";
import OpenSource from "@/views/OpenSource";
import { fmt, STATS } from "@/lib/siteStats";

export const metadata: Metadata = { title: "Open Source", description: `${fmt(STATS.archive)} mentored open-source projects across GSoC, LFX, Outreachy, Hacktoberfest and Nexus Spring of Code, filterable by year, org and tech.` };

export default function Page() {
  return <OpenSource />;
}
