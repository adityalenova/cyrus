import ProposalStudio from "@/views/ProposalStudio";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proposal Studio — Cyrus Open Source Workspace",
  description: "A focused proposal workspace for open-source program applicants — structured builder, annotated examples, readiness scoring rubric, and Markdown export.",
};

export default function ProposalStudioPage() {
  return <ProposalStudio />;
}
