/* ══ i18n/locales.ts — the locale list, in one pure module ═════════════
   No Next or next-intl import here, so tests, the sitemap and client code can
   all read it. Adding a language is one entry in each table below plus a
   messages/<locale>.json file; the key test fails until the file is complete. */
export const LOCALES = ["en", "es", "hi", "zh", "pt", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language in its own words, so a visitor can find theirs. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  es: "Español",
  hi: "हिन्दी",
  zh: "中文",
  pt: "Português",
  fr: "Français",
};

/* Writing direction per locale. Every shipped locale is left-to-right; an
   Arabic or Hebrew entry would say "rtl" here and the layout follows. */
const RTL = new Set<string>([]);

export function directionOf(locale: string): "ltr" | "rtl" {
  return RTL.has(locale) ? "rtl" : "ltr";
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
