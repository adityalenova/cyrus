import type { Metadata } from "next";
import About from "@/views/About";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "About", description: "The story, the method and the companies behind the index.", alternates: { canonical: canonical("/about") } };

export default function Page() {
  return <About />;
}
