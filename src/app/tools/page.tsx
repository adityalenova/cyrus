import type { Metadata } from "next";
import ToolsHome from "@/views/Tools/ToolsHome";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Artifacts",
  description:
    "Plain-English guides to design and build techniques: live demos, generated code and ready-made AI prompts for Cursor, Claude, ChatGPT and Lovable.",
  alternates: { canonical: canonical("/tools") }
};

export default function Page() {
  return <ToolsHome />;
}
