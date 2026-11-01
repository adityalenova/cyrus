/* ══ layout.tsx — root server layout: metadata, fonts, shell ═══════════ */
import type { Metadata, Viewport } from "next";
import { Dancing_Script, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Shell from "@/components/Shell";
import { statsLine } from "@/lib/siteStats";
import { SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

const SITE = SITE_ORIGIN;

/* Self-hosted at build time by next/font: the CSS is inlined into the
 * bundle and the woff2 files ship from our own origin, so first paint
 * waits on no third-party round trip. The variables are what globals.css
 * binds --font-display, --font-sans and --font-mono to. Each weight list
 * mirrors, exactly, what the old Google Fonts URL asked for, so no element
 * on the site loses the face it rendered in before. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jbmono",
  display: "swap",
});
/* The hand that signs the testimonial cards. One face, used at one size, in
   one place - everywhere else on the site stays in the three above. */
const sign = Dancing_Script({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-signature",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  title: {
    default: "cyrus.ai - find your open-source contribution",
    template: "%s · cyrus.ai",
  },
  description:
    `${statsLine()} - every issue is the real GitHub one, with its labels, its age and the repository it belongs to, so a contribution can be picked on evidence rather than on a wishlist.`,
  keywords: ["open source", "good first issues", "GSoC", "MLH Fellowship", "Hacktoberfest", "NSOC", "GitHub contributors", "open source programs"],
  openGraph: {
    type: "website",
    siteName: "cyrus.ai",
    title: "cyrus.ai - the developer-program platform",
    description: `${statsLine()} in one self-refreshing index.`,
    url: SITE,
  },
  twitter: { card: "summary_large_image", title: "cyrus.ai", description: "The developer-program platform." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  /* dark graphite is the default mode now, so the browser chrome follows
     it; a visitor who switches to light gets the cool paper on next paint. */
  themeColor: "#0e0f10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} ${mono.variable} ${sign.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* dark is the default, so only an explicit stored "light" adds a class;
           this keeps the stored choice out of the first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("agenthub.theme");if(t&&JSON.parse(t)==="light")document.documentElement.classList.add("light");}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
        <Analytics />
      </body>
    </html>
  );
}
