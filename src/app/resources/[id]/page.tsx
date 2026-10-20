import type { Metadata } from "next";
import { ResourceDetail } from "@/views/Resources";
import { RESOURCES } from "@/data/resources";
import { canonical, clip } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = RESOURCES.find((x) => x.id === decodeURIComponent(id ?? ""));
  if (!r) return { title: "Resource", robots: { index: false, follow: true } };

  const url = canonical(`/resources/${r.id}`);
  const description = clip(
    `${r.desc} ${r.brand}, ${r.cat.toLowerCase()}, ${r.level}${r.time ? ` - ${r.time}` : ""}${r.free ? ", free" : ""}.`,
  );
  return {
    title: r.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${r.title} · cyrus.ai`, description, url },
  };
}

export default function Page() {
  return <ResourceDetail />;
}
