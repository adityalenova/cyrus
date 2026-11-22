import type { Metadata } from "next";
import Trust from "@/views/Trust";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Trust centre", description: "Where the data comes from, how it is refreshed and what we never do with your account.", alternates: { canonical: canonical("/platform/trust") } };

export default function Page() {
  return <Trust />;
}
