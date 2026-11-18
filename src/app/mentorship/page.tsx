import type { Metadata } from "next";
import Mentorship from "@/views/Mentorship";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mentorship Directory",
  description:
    "Explore 6,100+ verified open source mentors across Google Summer of Code, LFX Mentorship, Summer of Bitcoin, and Season of KDE. Filter by technology stack, programming language, and organization.",
  alternates: { canonical: canonical("/mentorship") },
  openGraph: {
    title: "Open Source Mentorship Directory · cyrus.ai",
    description:
      "Explore 6,100+ verified open source mentors across Google Summer of Code, LFX Mentorship, Summer of Bitcoin, and Season of KDE.",
    url: canonical("/mentorship"),
  },
};

export default function Page() {
  return <Mentorship />;
}
