import type { Metadata } from "next";
import { HackathonDetail } from "@/views/Hackathons";
import { ALL_HACKS } from "@/lib/siteStats";
import { canonical, clip } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const h = ALL_HACKS.find((x) => x.id === decodeURIComponent(id ?? ""));
  if (!h) return { title: "Hackathon", robots: { index: false, follow: true } };

  const url = canonical(`/hackathons/${h.id}`);
  const closes = new Date(h.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const description = clip(
    `${h.org} hackathon: ${h.theme}. ${h.format}, prizes ${h.prize}, submissions ${h.status} - closes ${closes}. Prep playbook, rules and project ideas inside.`,
  );
  return {
    title: h.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${h.name} · cyrus.ai`, description, url },
  };
}

export default function Page() {
  return <HackathonDetail />;
}
