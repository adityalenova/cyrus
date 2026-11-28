import type { Metadata } from "next";
import ProjectCompare from "@/features/project-compare/ProjectCompare";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Compare repositories",
  description:
    "Line up to three repositories from the Cyrus catalog side by side - stars, forks, open issues, language, licence, GitHub topics, published program stack and last push - with missing values marked, not zeroed.",
  alternates: { canonical: canonical("/projects/compare") },
};

export default function Page() {
  return <ProjectCompare />;
}
