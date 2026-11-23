import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DashboardFeature from "@/views/DashboardFeature";
import { FEATURES } from "@/lib/dash/shared";
import { canonical } from "@/lib/seo";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ feature: f.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ feature: string }> }): Promise<Metadata> {
  const { feature } = await params;
  const f = FEATURES.find((x) => x.id === feature);
  if (!f) return {};
  return { title: `Dashboard: ${f.title}`, description: f.desc, alternates: { canonical: canonical(`/dashboard/${f.id}`) } };
}

export default async function Page({ params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params;
  const f = FEATURES.find((x) => x.id === feature);
  if (!f) notFound();
  return <DashboardFeature feature={f.id} />;
}
