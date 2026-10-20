import type { Metadata } from "next";
import Organizations from "@/views/Organizations";
import { fmt, STATS } from "@/lib/siteStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Organizations", description: `${fmt(STATS.orgs)} real GitHub organizations with live stats, program participation and contribution playbooks.`, alternates: { canonical: canonical("/organizations") } };

export default function Page() {
  return <Organizations />;
}
