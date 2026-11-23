import type { Metadata } from "next";
import Dashboard from "@/views/Dashboard";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Dashboard", description: "Your board: tracked issues in four stages, the repositories and organizations you follow, and a way to delete everything it remembers.", alternates: { canonical: canonical("/dashboard") } };

export default function Page() {
  return <Dashboard />;
}
