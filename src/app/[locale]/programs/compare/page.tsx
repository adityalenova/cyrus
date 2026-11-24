import ProgramCompare from "@/views/ProgramCompare";
import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Compare Program Eligibility & Application Windows — Cyrus",
  description: "Side-by-side comparison of published eligibility and application windows for Google Summer of Code, LFX Mentorship, Outreachy, Summer of Bitcoin and nine more programs, plus regional PPP stipend cards. Fields an organizer does not publish read \"Not published\".",
  alternates: { canonical: canonical("/programs/compare") },
};

export default function ProgramComparePage() {
  return <ProgramCompare />;
}
