import type { Metadata } from "next";
import Skills from "@/views/Skills";
import { fmtFull, STATS } from "@/lib/siteStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Skills", description: `${fmtFull(STATS.repos)} GitHub projects for AI coding agents: skills, Cursor rules, AGENTS.md files, MCP servers and dev tools, ranked by stars.`, alternates: { canonical: canonical("/skills") } };

export default function Page() {
  return <Skills />;
}
