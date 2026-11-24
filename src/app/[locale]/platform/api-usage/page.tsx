import type { Metadata } from "next";
import ApiUsageDashboard from "@/features/api-usage/ApiUsageDashboard";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "API usage",
  description: "Rate-limit status, usage over time and per-endpoint breakdown measured from real same-origin requests in this browser. No simulated traffic.",
  alternates: { canonical: canonical("/platform/api-usage") },
};

export default function Page() {
  return <ApiUsageDashboard />;
}
