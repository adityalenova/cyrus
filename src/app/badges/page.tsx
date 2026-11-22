import BadgesPage from "@/views/BadgesPage";
import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Curator Badges & Achievements — Cyrus",
  description: "Explore 20 collectible open-source contributor and mentor achievement badges, tracking velocity, code quality, and peer review honors.",
  alternates: { canonical: canonical("/badges") },
};

export default function Page() {
  return <BadgesPage />;
}
