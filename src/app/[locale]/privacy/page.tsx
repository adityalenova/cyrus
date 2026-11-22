import type { Metadata } from "next";
import Legal from "@/views/Legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: canonical("/privacy") } };

export default function Page() {
  return <Legal kind="privacy" />;
}
