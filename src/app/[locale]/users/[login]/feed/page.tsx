/* ══ /users/[login]/feed — the full public event feed ═════════════════
   Issue #190. A dynamic route, so `params` is a Promise in Next 16; the
   login is only shape-checked here, and the client feed renders whatever
   the server route answers (200, 400, 404, 429 or 502). Metadata uses
   generateMetadata because the title names the login.                  ═ */
import type { Metadata } from "next";
import GithubFeed from "@/features/github-activity-feed/GithubFeed";
import { canonical } from "@/lib/seo";
import { LOGIN_RE } from "@/features/github-activity-feed/model";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }): Promise<Metadata> {
  const { login } = await params;
  const user = decodeURIComponent(login ?? "").trim();
  if (!LOGIN_RE.test(user)) {
    return { title: "Event feed", description: "A public GitHub event feed.", robots: { index: false, follow: true } };
  }
  return {
    title: `${user} · event feed`,
    description: `Public GitHub events for ${user}: pushes, pull requests, issues, reviews, stars and forks, with a 90-day contribution heatmap built from the events API.`,
    alternates: { canonical: canonical(`/users/${encodeURIComponent(user)}/feed`) },
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = decodeURIComponent(login ?? "").trim();
  return <GithubFeed login={user} />;
}
