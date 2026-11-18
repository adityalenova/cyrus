import type { Metadata } from "next";
import UserActivity from "@/views/UserActivity";
import { canonical } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* The username is only validated for shape here; the route decides whether
   GitHub knows the account, and the view renders that answer. An unknown or
   typo'd login shows the empty state rather than a server error. */
export async function generateMetadata({ params }: { params: Promise<{ login: string }> }): Promise<Metadata> {
  const { login } = await params;
  const user = decodeURIComponent(login ?? "").trim();
  if (!user) return { title: "Activity", robots: { index: false, follow: true } };
  return {
    title: `${user} · activity`,
    description: `${user}'s recent public commits, pull requests, issues and reviews on GitHub.`,
    alternates: { canonical: canonical(`/users/${encodeURIComponent(user)}`) },
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  return <UserActivity login={decodeURIComponent(login ?? "").trim()} />;
}
