import type { Metadata } from "next";
import { canonical } from "@/lib/seo";
import Unsubscribe from "@/views/Unsubscribe";

/* The link carries a signed token in its query string, so it is kept out of
   search results and never leaves the site in a Referer header. */
export const metadata: Metadata = {
  title: "Unsubscribe",
  alternates: { canonical: canonical("/unsubscribe") },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <Unsubscribe />;
}
