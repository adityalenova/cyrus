import type { Metadata } from "next";
import OrgProfile from "@/views/OrgProfile";
import { ORGS } from "@/data/orgs";
import { canonical, clip } from "@/lib/seo";
import { jsonLdScript, organizationEntity } from "@/lib/jsonLd";
import { fmt } from "@/lib/siteStats";

export function generateStaticParams() {
  return ORGS.map((o) => ({ login: encodeURIComponent(o.login) }));
}

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }): Promise<Metadata> {
  const { login } = await params;
  const slug = decodeURIComponent(login ?? "").toLowerCase();
  const o = ORGS.find((x) => x.login.toLowerCase() === slug);
  if (!o) return { title: "Organization", robots: { index: false, follow: true } };

  const url = canonical(`/organizations/${o.login}`);
  const description = clip(
    `${o.tagline} - ${fmt(o.repos)} catalogued repositories and ${fmt(o.stars)} stars, with program history and a contribution playbook.`,
  );
  return {
    title: o.name || o.login,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${o.login} · cyrus.ai`, description, url },
  };
}

export default async function Page({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const o = ORGS.find((x) => x.login.toLowerCase() === decodeURIComponent(login ?? "").toLowerCase());
  const data = o ? organizationEntity(o) : null;
  return (
    <>
      {data && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(data)} />}
      <OrgProfile />
    </>
  );
}
