import type { Metadata } from "next";
import OrgStats from "@/views/OrgStats";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Organization statistics",
  description:
    "Every organization named by an open-source program's own record, folded into one list: fields, seasons, "
    + "programs each host ran, logos and live GitHub numbers.",
  alternates: { canonical: canonical("/organizations/stats") },
};

export default function Page() {
  return <OrgStats />;
}
