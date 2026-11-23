import type { Metadata } from "next";
import How from "@/views/How";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "How it works", description: "Three steps from browsing the catalog to shipping a merged PR.", alternates: { canonical: canonical("/platform/how") } };

export default function Page() {
  return <How />;
}
