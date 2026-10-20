import type { Metadata } from "next";
import RepoDetail from "@/views/RepoDetail";
import { REPOS } from "@/data/repos";
import { PROGRAM_REPOS } from "@/data/programRepos";
import { canonical, clip } from "@/lib/seo";
import { fmt } from "@/lib/siteStats";

/** the same union the client view resolves /repo/:id against */
const CATALOG = [...REPOS, ...PROGRAM_REPOS];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // the URL carries "owner%2Fname"; the view decodes it the same way
  const slug = decodeURIComponent(id ?? "").toLowerCase();
  const r = CATALOG.find((x) => x.repo.toLowerCase() === slug);
  if (!r) return { title: "Repo", robots: { index: false, follow: true } };

  const url = canonical(`/repo/${encodeURIComponent(r.repo)}`);
  // stats first: clip() trims the tail, and the description is the part that can spare it
  const description = clip(
    `${fmt(r.stars)} stars, ${fmt(r.forks)} forks, ${fmt(r.issues)} open issues in ${r.lang}, ${r.license} license. ${r.desc}`,
  );
  return {
    title: `${r.repo.split("/")[0]}/${r.repo.split("/")[1]}`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${r.repo} · cyrus.ai`, description, url },
  };
}

export default function Page() {
  return <RepoDetail />;
}
