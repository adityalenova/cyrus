import type { Metadata } from "next";
import Features from "@/views/Features";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Features", description: "Everything cyrus.ai does: the open-issue index, organization profiles, the program calendar and a board that keeps your own record.", alternates: { canonical: canonical("/platform/features") } };

export default function Page() {
  return <Features />;
}
