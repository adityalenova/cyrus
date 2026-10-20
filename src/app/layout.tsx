/* ══ layout.tsx — root server layout: metadata, fonts, shell ═══════════ */
import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import { fmt, statsLine, STATS } from "@/lib/siteStats";
import { SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

const SITE = SITE_ORIGIN;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "cyrus.ai - find your open-source contribution",
    template: "%s · cyrus.ai",
  },
  description:
    `${statsLine()} - skills, Cursor rules, AGENTS.md configs and MCP servers ranked by stars, ${STATS.programs} tracked open-source programs with a timeline of every contribution window, and ${fmt(STATS.orgs)} organization profiles.`,
  keywords: ["open source", "GSoC", "NSOC", "hackathons", "AI agents", "MCP servers", "Cursor rules", "AGENTS.md", "agent skills"],
  openGraph: {
    type: "website",
    siteName: "cyrus.ai",
    title: "cyrus.ai - the developer-program platform",
    description: `${statsLine(new Date())} in one self-refreshing catalog.`,
    url: SITE,
  },
  twitter: { card: "summary_large_image", title: "cyrus.ai", description: "The developer-program platform." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#221a13" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* keep the stored theme out of the first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("agenthub.theme");if(t&&JSON.parse(t)==="dark")document.documentElement.classList.add("dark");}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
