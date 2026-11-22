import BadgesPage from "@/views/BadgesPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Curator Badges & Achievements — Cyrus",
  description: "Explore 20 collectible open-source contributor and mentor achievement badges, tracking velocity, code quality, and peer review honors.",
};

export default function Page() {
  return <BadgesPage />;
}
