import type { Metadata } from "next";
import ProgramDetail from "@/views/ProgramDetail";
import { PROGRAMS } from "@/data/orgs";
import { canonical, clip } from "@/lib/seo";
import { jsonLdScript, programEntity } from "@/lib/jsonLd";

export function generateStaticParams() {
  return PROGRAMS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = PROGRAMS.find((x) => x.id === decodeURIComponent(id ?? "").toLowerCase());
  if (!p) return { title: "Program", robots: { index: false, follow: true } };

  const url = canonical(`/programs/${p.id}`);
  // pay and scale are prose for some programs, so only quote them where they read as figures
  const stipend = p.pay.startsWith("$") ? `${p.pay} ${p.payNote.toLowerCase()}` : p.pay;
  const scale = /\d/.test(p.orgs) && /\d/.test(p.slots) ? `${p.orgs}, ${p.slots}` : "";
  const full = (s: string) => (s ? `${s.replace(/[.]$/, "")}.` : "");
  const description = clip([full(p.tag), full(stipend), full(scale), full(p.window)].filter(Boolean).join(" "));
  return {
    title: p.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${p.name} · cyrus.ai`, description, url },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = PROGRAMS.find((x) => x.id === decodeURIComponent(id ?? "").toLowerCase());
  const data = p ? programEntity(p) : null;
  return (
    <>
      {data && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(data)} />}
      <ProgramDetail />
    </>
  );
}
