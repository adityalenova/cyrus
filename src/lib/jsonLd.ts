/* ══ jsonLd.ts — the machine-readable layer under the pages that
   already hold the facts ═══════════════════════════════════════════════
   Server-safe: no React, no browser APIs, nothing imported from lib/util.
   The page components call these and inline the result as
   <script type="application/ld+json">.

   The rule this module obeys is the one the issue set: a field is emitted
   only when the dataset carries it. Program records state a window in
   prose rather than as two ISO dates, so they publish as Course, not
   Event - nothing is guessed to make a validator happy.
   ═══════════════════════════════════════════════════════════════════ */
import { PROGRAM_DETAILS } from "@/data/programDetails";
import { SITE_ORIGIN, canonical } from "@/lib/seo";
import type { Org, Program } from "@/lib/types";
import { statsLine } from "@/lib/siteStats";
import { isPublished } from "@/lib/programFields";

export type JsonLd = Record<string, unknown>;

/** Escape the two characters that could close the script tag early: the
 * data is full of prose written by other people. */
export function jsonLdScript(data: JsonLd): { __html: string } {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return { __html: json };
}

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;

const githubOrg = (login: string) => `https://github.com/${login}`;
const avatar = (login: string, size = 168) => `${githubOrg(login)}.png?size=${size}`;
const absolute = (path: string) => (path.startsWith("http") ? path : `${SITE_ORIGIN}${path}`);

export function webSite(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: "cyrus.ai",
    url: canonical("/"),
    description: `The developer-program platform: ${statsLine()} in one catalog.`,
    publisher: { "@id": ORG_ID },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${canonical("/skills")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function programEntity(p: Program): JsonLd {
  const detail = PROGRAM_DETAILS[p.id];
  const url = canonical(`/programs/${p.id}`);
  const body: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": url,
    name: p.name,
    url,
    description: p.tag,
    // a tracked program without cover art must not emit an empty image URL
    ...(p.img ? { image: absolute(p.img) } : {}),
    provider: {
      "@type": "Organization",
      name: p.owner,
      url: githubOrg(p.owner),
    },
    sameAs: p.url,
    // the program pages describe an application, not a paid product
    isAccessibleForFree: true,
  };
  if (detail) {
    if (isPublished(detail.eligibility)) body.coursePrerequisites = detail.eligibility;
    body.educationalLevel = detail.level;
    if (isPublished(detail.about[0])) body.abstract = detail.about[0];
  }
  return body;
}

export function organizationEntity(o: Org): JsonLd {
  const url = canonical(`/organizations/${o.login}`);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": url,
    name: o.name || o.login,
    alternateName: o.login,
    url,
    description: o.tagline,
    logo: avatar(o.login),
    // realOrgs stores the bare hostname, so the scheme is added here
    sameAs: [githubOrg(o.login), ...(o.domain ? [`https://${o.domain}`] : [])],
    knowsAbout: o.tags,
  };
}
