import type { Metadata } from "next";
import ToolsBrowse from "@/views/Tools/ToolsBrowse";
import { TOOLS_TOTAL } from "@/lib/tools/data";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Browse all artifacts",
  description: `All ${TOOLS_TOTAL} artifacts in one filterable list - by area, shelf, level, tag or plain words.`,
  alternates: { canonical: canonical("/tools/browse") }
};

export default function Page() {
  return <ToolsBrowse />;
}
