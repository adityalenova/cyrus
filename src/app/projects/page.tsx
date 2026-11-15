import type { Metadata } from "next";
import Projects from "@/views/Projects";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Projects", description: "The open-source project archive from every program cyrus tracks, filterable by difficulty, year, org and tech.", alternates: { canonical: canonical("/projects") } };

export default function Page() {
  return <Projects />;
}
