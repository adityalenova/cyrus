import type { Metadata } from "next";
import ProgramOrgs from "@/views/ProgramOrgs";
import { PROGRAMS } from "@/data/orgs";
import { canonical, clip } from "@/lib/seo";

export function generateStaticParams() {
  return PROGRAMS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = PROGRAMS.find((x) => x.id === decodeURIComponent(id ?? "").toLowerCase());
  if (!p) return { title: "Program organizations", robots: { index: false, follow: true } };

  const url = canonical(`/programs/${p.id}/organizations`);
  const description = clip(
    `Every organization that has taken part in ${p.name}, with its logo, field, technologies, the years it joined ` +
    `and how many projects it hosted. Filterable by year, sector and technology.`
  );
  return {
    title: `${p.name} organizations`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${p.name} organizations · cyrus.ai`, description, url },
  };
}

export default async function Page() {
  return <ProgramOrgs />;
}
