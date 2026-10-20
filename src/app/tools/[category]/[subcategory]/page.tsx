import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolsSubcategory from "@/views/Tools/ToolsSubcategory";
import { TOOL_CATEGORIES } from "@/lib/tools/types";
import { countOfSub } from "@/lib/tools/data";
import { canonical } from "@/lib/seo";

export function generateStaticParams() {
  return TOOL_CATEGORIES.flatMap((c) => c.subcategories.map((s) => ({ category: c.id, subcategory: s.id })));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; subcategory: string }> }): Promise<Metadata> {
  const { category, subcategory } = await params;
  const cat = TOOL_CATEGORIES.find((c) => c.id === category);
  const sub = cat?.subcategories.find((s) => s.id === subcategory);
  if (!cat || !sub) return {};
  return {
    title: `${sub.label} artifacts`,
    description: `${sub.blurb} ${countOfSub(cat.id, sub.id)} plain-English guides with live demos, copy-paste code and AI prompts.`,
    alternates: { canonical: canonical(`/tools/${cat.id}/${sub.id}`) },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string; subcategory: string }> }) {
  const { category, subcategory } = await params;
  const cat = TOOL_CATEGORIES.find((c) => c.id === category);
  const sub = cat?.subcategories.find((s) => s.id === subcategory);
  if (!cat || !sub) notFound();
  return <ToolsSubcategory catId={cat.id} subId={sub.id} />;
}
