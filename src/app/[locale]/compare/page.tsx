import type { Metadata } from "next";
import Compare from "@/views/Compare";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Compare projects", description: "Line up to three open-source projects side by side - program, timeline, organisation, language, stack and mentors - and read off where they genuinely differ.", alternates: { canonical: canonical("/compare") } };

/* The canonical is the bare /compare on purpose: a ?c= selection is the
   visitor's own state, and pointing every variation at one address is what
   keeps a pasted comparison out of the search index. */
export default function Page() {
  return <Compare />;
}
