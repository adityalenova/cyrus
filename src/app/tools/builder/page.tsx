import type { Metadata } from "next";
import ToolsBuilder from "@/views/Tools/ToolsBuilder";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Master prompt builder",
  description:
    "Combine a style, layout, typography, palette, backend, sign-in and hosting choice into one ready-to-paste prompt for Cursor, Claude, ChatGPT or Lovable.",
  alternates: { canonical: canonical("/tools/builder") }
};

export default function Page() {
  return <ToolsBuilder />;
}
