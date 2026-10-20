import type { Metadata } from "next";
import Nova from "@/views/Nova";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Co-pilot", description: "Co-pilot is the one AI on cyrus: describe your stack, get matched hackathons, skills and programs - or just ask it anything.", alternates: { canonical: canonical("/nova") } };

export default function Page() {
  return <Nova />;
}
