import type { ReactNode } from "react";
import { bookmarkHref, type Bookmark } from "@/lib/bookmarks";
import { Link } from "@/lib/router";

export function BookmarkLink({ item, children }: { item: Bookmark; children: ReactNode }) {
  const href = bookmarkHref(item);
  if (!href) return children;
  return href.startsWith("https:") ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <Link to={href}>{children}</Link>;
}
