/* ══ /settings/language — the i18n surface ═════════════════════════════
   Issue #188. A new settings namespace. The page itself is a client surface
   (it reads localStorage and sets document.lang); the metadata advertises
   every shipped catalog as a ?lang= alternate so a link can open directly
   in one language without a separate route per locale.                 ═ */
import type { Metadata } from "next";
import LanguageSettings from "@/features/i18n/LanguageSettings";
import { canonical } from "@/lib/seo";
import { alternateLanguages } from "@/features/i18n/model";

const PATH = "/settings/language";

export const metadata: Metadata = {
  title: "Language",
  description:
    "Choose the language for this page: English, Spanish, Hindi, Chinese, Portuguese or French. "
    + "The choice is stored in this browser under cyrus.locale.v1; one surface is fully translated today.",
  alternates: {
    canonical: canonical(PATH),
    languages: alternateLanguages(PATH),
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LanguageSettings />;
}
