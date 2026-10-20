import type { Metadata } from "next";
import Hackathons from "@/views/Hackathons";
import { fmt, openHacks, STATS } from "@/lib/siteStats";

export const metadata: Metadata = { title: "Hackathons", description: `${fmt(openHacks())} hackathons open for submission right now, of ${fmt(STATS.hacks)} listed with deadlines, prize pools and prep playbooks.` };

export default function Page() {
  return <Hackathons />;
}
