import type { Metadata } from "next";
import Features from "@/views/Features";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Features", description: "Everything cyrus.ai does: catalog, calendar, matcher, recommender and self-refreshing data.", alternates: { canonical: canonical("/platform/features") } };

export default function Page() {
  return <Features />;
}
