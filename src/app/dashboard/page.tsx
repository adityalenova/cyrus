import type { Metadata } from "next";
import Dashboard from "@/views/Dashboard";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = { title: "Dashboard", description: "Your board: saved projects, followed orgs, watchlist, deadlines and next steps.", alternates: { canonical: canonical("/dashboard") } };

export default function Page() {
  return <Dashboard />;
}
