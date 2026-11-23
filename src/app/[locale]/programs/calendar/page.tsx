import type { Metadata } from "next";
import ProgramCalendar from "@/features/hackathon-calendar/ProgramCalendar";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Program calendar",
  description:
    "A month, week and day calendar of the dated windows open-source programs publish - with .ics export, filters by program, status and difficulty, and dates you add yourself.",
  alternates: { canonical: canonical("/programs/calendar") },
};

export default function Page() {
  return <ProgramCalendar />;
}
