import type { Metadata } from "next";
import Home from "@/views/Home";
import { statsLine } from "@/lib/siteStats";

export const metadata: Metadata = { title: { absolute: "cyrus.ai - find your open-source contribution" }, description: `The developer-program platform: ${statsLine()} in one warm, self-refreshing catalog.` };

export default function Page() {
  return <Home />;
}
