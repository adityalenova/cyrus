import type { Metadata } from "next";
import Legal from "@/views/Legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: canonical("/terms") } };

export default function Page() {
  return <Legal kind="terms" />;
}
