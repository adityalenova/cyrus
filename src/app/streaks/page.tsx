import StreaksPage from "@/views/StreaksPage";
import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Streaks & Milestones — Cyrus Contributor Habits",
  description: "Track consecutive contribution days, unlock golden hexagon streak badges at 7, 30, 50, 100, 150, 500, and 1000 days, and manage streak freeze protection.",
  alternates: { canonical: canonical("/streaks") },
};

export default function Page() {
  return <StreaksPage />;
}
