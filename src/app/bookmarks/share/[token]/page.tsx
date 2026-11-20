import type { Metadata } from "next";
import SharedBookmarkCollection from "@/views/SharedBookmarkCollection";
import { canonical } from "@/lib/seo";
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  return { title: "Shared bookmarks", robots: { index: false, follow: false }, alternates: { canonical: canonical(`/bookmarks/share/${encodeURIComponent((await params).token)}`) } };
}
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <SharedBookmarkCollection token={(await params).token} />;
}
