import type { Metadata } from "next";
import Organizations from "@/views/Organizations";
import { fmt, STATS } from "@/lib/siteStats";

export const metadata: Metadata = { title: "Organizations", description: `${fmt(STATS.orgs)} real GitHub organizations with live stats, program participation and contribution playbooks.` };

export default function Page() {
  return <Organizations />;
}
