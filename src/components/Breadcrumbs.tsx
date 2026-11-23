"use client";
/* ══ Breadcrumbs.tsx — auto-generated breadcrumb navigation ═════════ */
import { Link, usePathname } from "@/i18n/navigation";

const LABEL_MAP: Record<string, string> = {
  programs: "Programs",
  organizations: "Organizations",
  projects: "Projects",
  issues: "Issues",
  skills: "Skills",
  sponsors: "Sponsors",
  leaderboard: "Leaderboard",
  about: "About",
  dashboard: "Dashboard",
  platform: "Platform",
  features: "Features",
  trust: "Trust Centre",
  how: "How It Works",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  settings: "Settings",
  repos: "Repositories",
};

function segmentLabel(segment: string): string {
  return LABEL_MAP[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Breadcrumbs({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, idx) => ({
    label: segmentLabel(seg),
    href: "/" + segments.slice(0, idx + 1).join("/"),
    isLast: idx === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
      <ol className="flex items-center gap-1.5 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
          <Link href="/" className="text-cocoa/60 hover:text-coffee transition-colors" itemProp="item">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="sr-only" itemProp="name">Home</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>

        {crumbs.map((crumb, idx) => (
          <li key={crumb.href} className="flex items-center gap-1.5" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <span className="text-cocoa/30" aria-hidden>›</span>
            {crumb.isLast ? (
              <span className="text-ink font-medium" aria-current="page" itemProp="name">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-cocoa/60 hover:text-coffee transition-colors" itemProp="item">
                <span itemProp="name">{crumb.label}</span>
              </Link>
            )}
            <meta itemProp="position" content={String(idx + 2)} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
