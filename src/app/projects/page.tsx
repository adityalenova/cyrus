import type { Metadata } from "next";
import Projects from "@/views/Projects";
import { fmt, STATS } from "@/lib/siteStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Projects", description: `${fmt(STATS.repos)} GitHub projects for AI coding agents: skills, Cursor rules, AGENTS.md files, MCP servers and dev tools, ranked by stars.`, alternates: { canonical: canonical("/projects") } };

export default function Page() {
  return <Projects />;
}
