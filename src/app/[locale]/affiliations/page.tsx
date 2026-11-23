import type { Metadata } from "next";
import Legal from "@/views/Legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Affiliations", alternates: { canonical: canonical("/affiliations") } };

export default function Page() {
  return <Legal kind="affiliations" />;
}
