import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

/* English keeps the URLs the site already has (/about, /issues, ...) so no
   existing link, canonical or search result moves. The other languages live
   under a prefix (/es/about). The visitor's choice is kept in a cookie. */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
});
