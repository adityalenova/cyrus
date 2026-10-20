/* ══ seo.ts — the origin, canonical URLs and page metadata in one place ══
   Imported by metadata routes and by page files, so it must stay server-safe:
   nothing here may pull in a module that uses React hooks (see lib/util).     */

/** Production origin. sitemap.ts, robots.ts and every canonical tag share it. */
export const SITE_ORIGIN = "https://cyrus-agent.vercel.app";

/** Absolute URL for an in-site path, e.g. canonical("/projects"). */
export function canonical(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return SITE_ORIGIN + p;
}

/** Search results and social cards want a short line; data blurbs are not. */
export function clip(text: string, max = 155): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(";")))}…`;
}
