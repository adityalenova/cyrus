/* ══ model.ts — translation lookup, direction, and the stored choice ══
   Issue #188. Pure functions only: no React, no DOM, no localStorage call.
   The provider reads and writes storage; this module decides what a stored
   value means, what a missing key falls back to, and which way a locale
   reads. That split is what the vitest suite can exercise in node.      ═ */
import {
  LOCALES, LOCALE_IDS, MESSAGES,
  type Catalog, type Locale, type MessageKey,
} from "./messages";

export { LOCALES, LOCALE_IDS, MESSAGES };
export type { Catalog, Locale, LocaleMeta, MessageKey } from "./messages";

export const DEFAULT_LOCALE: Locale = "en";

/** the one localStorage key the choice lives under */
export const LOCALE_KEY = "cyrus.locale.v1";

/* ISO 639-1 codes written right-to-left. None of the six catalogs ship
   today; the list exists so `dirOf("ar")` is already correct and an Arabic
   or Hebrew catalog only has to be added to messages.ts. */
export const RTL_LANGUAGES = ["ar", "arc", "ckb", "dv", "fa", "he", "ks", "ps", "sd", "ug", "ur", "yi"] as const;

/** "rtl" | "ltr" for a BCP 47 tag, script subtag ignored: "ar-EG" is rtl. */
export function dirOf(locale: string): "ltr" | "rtl" {
  const base = String(locale ?? "").toLowerCase().split(/[-_]/)[0];
  return (RTL_LANGUAGES as readonly string[]).includes(base) ? "rtl" : "ltr";
}

/** true only for a locale this build has a catalog for. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_IDS as string[]).includes(value);
}

/**
 * Normalise anything a URL, storage or a caller's guess can produce into a
 * shipped locale. "ES", "es-MX" and "es_419" all resolve to "es"; an unknown
 * language returns null so the caller keeps its current choice instead of
 * silently pretending the request was understood.
 */
export function resolveLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^["']|["']$/g, "");
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/_/g, "-");
  if (isLocale(lower)) return lower;
  const base = lower.split("-")[0];
  return isLocale(base) ? base : null;
}

/** `?lang=es` from a page's search string, or null. The provider treats a
    URL choice as a view, not a stored preference. */
export function localeFromSearch(search: string): Locale | null {
  const raw = new URLSearchParams(search).get("lang");
  return resolveLocale(raw);
}

/** What a localStorage value means. Plain text, but a quoted JSON string
    written by an older attempt is accepted rather than thrown away. */
export function readStoredLocale(raw: string | null | undefined): Locale | null {
  if (typeof raw !== "string") return null;
  return resolveLocale(raw);
}

/**
 * Fill `{token}` placeholders from `vars`. A token with no value is left
 * visible on purpose: a translated sentence with a literal {count} is a
 * caller bug that should be seen, not a blank that hides it.
 */
export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/** The message for a key, falling back to English when the catalog has
    nothing usable for it. Exported so tests can prove the fallback without
    going through interpolation. */
export function messageOf(locale: Locale | string, key: MessageKey): string {
  const known = resolveLocale(locale);
  const catalog = known ? (MESSAGES[known] as Partial<Catalog>) : undefined;
  const value = catalog?.[key];
  if (typeof value === "string" && value.trim() !== "") return value;
  return MESSAGES.en[key];
}

/** Translate `key` for `locale`, interpolating `{placeholders}`. */
export function t(
  locale: Locale | string,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  return interpolate(messageOf(locale, key), vars);
}

/** The language's own name, e.g. "Español". Falls back to the tag itself so
    a future locale without metadata still shows something true. */
export function nativeName(locale: Locale | string): string {
  const known = resolveLocale(locale);
  return known ? LOCALES[known].native : String(locale ?? "");
}

/** The English name of the language, for a reader who cannot read it. */
export function englishName(locale: Locale | string): string {
  const known = resolveLocale(locale);
  return known ? LOCALES[known].english : String(locale ?? "");
}

/** The BCP 47 tag written to <html lang>. */
export function htmlLang(locale: Locale | string): string {
  const known = resolveLocale(locale);
  return known ? LOCALES[known].tag : "en";
}

/**
 * hreflang alternates for a path: one entry per shipped catalog, plus
 * x-default pointing at English. Query variants, not new routes, so the
 * page keeps one canonical URL. Used by the page's metadata.
 */
export function alternateLanguages(pathname: string, extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of LOCALE_IDS) out[id] = `${pathname}?lang=${id}`;
  out["x-default"] = `${pathname}?lang=${DEFAULT_LOCALE}`;
  return { ...out, ...extra };
}

/** The key set is identical across catalogs; this returns the ones that
    are not, so a test (or a future locale loader) can name them. */
export function keyDiff(locale: Locale | string): { missing: string[]; extra: string[] } {
  const known = resolveLocale(locale);
  const english = Object.keys(MESSAGES.en);
  if (!known) return { missing: english, extra: [] };
  const keys = Object.keys(MESSAGES[known]);
  return {
    missing: english.filter((k) => !keys.includes(k)),
    extra: keys.filter((k) => !english.includes(k)),
  };
}
