/* ══ src/app/mentorship/page.tsx — automated mentorship matching route ══ */

import type { Metadata } from "next";
import MentorshipView from "@/views/Mentorship";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mentorship",
  description: "Automated mentorship matching for aspiring open-source contributors based on skills, domain interests, timezone, and availability.",
  alternates: { canonical: canonical("/mentorship") },
};

export default function Page() {
  return <MentorshipView />;
}
