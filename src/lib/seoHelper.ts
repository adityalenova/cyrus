/* ══ seoHelper.ts — Structured Data & OpenGraph metadata helpers ══════ */
import type { Metadata } from "next";
import { SITE_ORIGIN } from "./seo";

export interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
}

export function constructMetadata({
  title,
  description,
  path = "",
  image = "/og-image.png",
  type = "website",
}: PageMetaOptions): Metadata {
  const url = `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
  const fullTitle = `${title} · cyrus.ai`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: "cyrus.ai",
      images: [
        {
          url: image.startsWith("http") ? image : `${SITE_ORIGIN}${image}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.startsWith("http") ? image : `${SITE_ORIGIN}${image}`],
      creator: "@cyrus_ai",
    },
  };
}

export function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "cyrus.ai",
    url: SITE_ORIGIN,
    description: "Open-source contribution discovery platform and program archive",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_ORIGIN}/issues?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
