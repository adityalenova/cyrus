import type { Metadata } from "next";
import Sponsors from "@/views/Sponsors";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sponsors",
  description: "A directory of the catalog's most-starred open-source projects that publish a FUNDING.yml, read live from the GitHub contents API: who is on GitHub Sponsors, Open Collective, Patreon or their own page, with the links they declared.",
  alternates: { canonical: canonical("/sponsors") },
};

export default function Page() {
  return <Sponsors />;
}
