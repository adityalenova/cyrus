import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolDetail from "@/views/Tools/ToolDetail";
import { ALL_TOOLS } from "@/lib/tools/data";
import { toolById } from "@/lib/tools/data";
import { canonical } from "@/lib/seo";

export function generateStaticParams() {
  return ALL_TOOLS.map((t) => ({ category: t.category, subcategory: t.subcategory, tool: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool } = await params;
  const t = toolById(tool);
  if (!t) return {};
  const alias = t.aliases[0] ? ` (also known as ${t.aliases[0]})` : "";
  return {
    title: `${t.name}${alias}`,
    description: `${t.summary} Live demo, copy-paste code and ready-made prompts for Cursor, Claude, ChatGPT and Lovable.`,
    alternates: { canonical: canonical(`/tools/${t.category}/${t.subcategory}/${t.id}`) },
  };
}

export default async function Page({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!toolById(tool)) notFound();
  return <ToolDetail toolId={tool} />;
}
