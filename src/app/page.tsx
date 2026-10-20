import type { Metadata } from "next";
import Home from "@/views/Home";
import { statsLine } from "@/lib/siteStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: { absolute: "cyrus.ai - find your open-source contribution" }, description: `The developer-program platform: ${statsLine()} in one warm, self-refreshing catalog.`, alternates: { canonical: canonical("/") } };

export default function Page() {
  return <Home />;
}
