/* ══ llms.txt — the plain-text index agents are pointed at ════════════
   A screenful, and every number and path in it comes from the same
   modules the pages use, so this file cannot drift from the site.
   Rebuilt on deploy: the crawl counts are as fresh as the last run. ══ */
import { PROGRAMS, ORGS } from "@/data/orgs";
import { canonical } from "@/lib/seo";
import { STATS, fmtFull } from "@/lib/siteStats";

const line = (path: string, what: string) => `- ${canonical(path)} - ${what}`;

const body = `# cyrus.ai

> The developer-program platform. ${fmtFull(STATS.issues)} open issues across ${fmtFull(STATS.issueRepos)} repositories, ${fmtFull(STATS.catalog)} indexed repositories, ${fmtFull(STATS.orgs)} organization profiles (${fmtFull(STATS.orgRoster)} organizations named across the program records), ${fmtFull(STATS.archive)} archived program projects from ${STATS.archivePrograms} archives and ${STATS.programs} tracked open-source programs, crawled from GitHub on ${STATS.crawledAt}. Humans browse the pages below; agents can read the same data without parsing markup.

## Pages

${line("/", "the platform overview and starting points for contributors")}
${line("/skills", `the ${fmtFull(STATS.catalog)}-repository catalog, ranked by stars, each entry linked to its live GitHub record`)}
${line("/projects", `${fmtFull(STATS.archive)} program projects across ${STATS.archivePrograms} programs (GSoC, LFX, Outreachy, Summer of Bitcoin, GSSoC, Season of KDE, MLH, NSOC, Hacktoberfest, 24 Pull Requests, FOSSEE, Vercel OSS), filterable by year, org and tech`)}
${line("/issues", `search ${fmtFull(STATS.issues)} open issues by keyword, language, organization, label, beginner-friendly and unassigned`)}
${line("/organizations", `${fmtFull(STATS.orgs)} real GitHub organizations with stats, program history and how to contribute to each`)}
${line("/programs", "the tracked open-source program index, with timelines and eligibility")}
${line("/organizations/stats", "cross-program organization statistics and participation history")}
${line("/leaderboard", "contributor rankings and contribution activity")}
${line("/sponsors", "catalog projects with declared funding and sponsorship links")}
${line("/about", "the platform's purpose and background")}
${line("/platform/features", "the platform's tools and capabilities")}
${line("/platform/how", "how the platform works")}
${line("/platform/trust", "data sources, verification and trust information")}
- ${canonical("/programs/gsoc")} and one page like it per tracked program: ${PROGRAMS.map((p) => p.id).join(", ")}

## Object URLs

- Repo detail: ${canonical("/repo/n8n-io%2Fn8n")} - the slash in owner/name is percent-encoded
- Program detail: ${canonical("/programs/gsoc")}
- Organization detail: ${canonical(`/organizations/${ORGS[0].login}`)}

## Machine-readable

- ${canonical("/sitemap.xml")} - every indexable URL, generated from the same datasets
- ${canonical("/robots.txt")} - crawl rules; /dashboard and /api are not for indexing
- ${canonical("/api/health")} - reports {"ok":true,"db":boolean,"auth":boolean}
- ${canonical("/api/catalog/counts")} - live row counts per catalog table
- ${canonical("/api/catalog/repos")}?cat=skills|cursor|agentsmd|mcp|tools&q=&domain=&model=&format=&framework=&page=&per= - filtered rows, per caps at 60
- ${canonical("/api/issues")}?q=&lang=&org=&label=&repo=&beginner=1&unassigned=1&sort=relevance|stars|updated|comments|oldest&page=&per= - paged JSON over the same issue snapshot the finder uses, 60 requests/minute per address

The two catalog endpoints above answer 503 while no database is attached, and
/api/health tells you whether one is. Everything else here is static content
built from the checked-in datasets: no key, session or cookie is needed to read it.
Issue counts come from the public GitHub search API; a number here is a crawl
snapshot, and the page carrying it states the date it was taken.
`;

export function GET() {
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
