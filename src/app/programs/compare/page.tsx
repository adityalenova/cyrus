import ProgramCompare from "@/views/ProgramCompare";
import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Compare Open Source Programs & Regional Stipends — Cyrus",
  description: "Side-by-side comparison matrix for Google Summer of Code, LFX Mentorship, Outreachy, Summer of Bitcoin and more. Compare regional PPP stipends, eligibility rules, and timeline overlaps.",
  alternates: { canonical: canonical("/programs/compare") },
};

export default function ProgramComparePage() {
  return <ProgramCompare />;
}
