"use client"
/* ══ provider.tsx — the locale the surface renders in ═══════════════════
   Issue #188. While mounted this provider:
     · reads ?lang= from the URL, then the stored choice from
       localStorage `cyrus.locale.v1`, and keeps the URL choice as a view
       (not a saved preference);
     · writes document.documentElement.lang and .dir for the current
       locale, and puts back the values it found when it unmounts;
     · persists a choice the visitor makes, and only then.

   It wraps one surface at a time today - /settings/language - so setting
   the document language does not claim the rest of the site is translated
   when it is not.                                                      ═ */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE, LOCALE_KEY, dirOf, htmlLang, localeFromSearch, readStoredLocale,
  resolveLocale, t,
  type Locale, type MessageKey,
} from "./model";

type I18nValue = {
  locale: Locale;
  /** true once storage and the URL have been read; before that the page
      renders the default catalog without claiming it is the stored one */
  ready: boolean;
  dir: "ltr" | "rtl";
  setLocale: (next: Locale | string) => void;
  reset: () => void;
  /** translate a key in the current locale, with {placeholder} values */
  tr: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);
  /* only a choice the visitor makes is written back; opening a ?lang= link
     shows that language without overwriting the stored preference */
  const persist = useRef(false);
  const previous = useRef<{ lang: string; dir: string } | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    if (previous.current === null) previous.current = { lang: el.lang, dir: el.dir };

    const fromUrl = localeFromSearch(window.location.search);
    let stored: Locale | null = null;
    try {
      stored = readStoredLocale(localStorage.getItem(LOCALE_KEY));
    } catch { /* private mode: the URL choice still works */ }
    const next = fromUrl ?? stored;
    if (next) setLocaleState(next);
    setReady(true);

    return () => {
      const root = document.documentElement;
      if (previous.current) {
        root.lang = previous.current.lang;
        root.dir = previous.current.dir;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    el.lang = htmlLang(locale);
    el.dir = dirOf(locale);
  }, [locale, ready]);

  useEffect(() => {
    if (!ready || !persist.current) return;
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch { /* private mode: the choice lasts for this page only */ }
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale | string) => {
    const known = resolveLocale(next);
    if (!known) return;
    persist.current = true;
    setLocaleState(known);
  }, []);

  const reset = useCallback(() => {
    persist.current = true;
    setLocaleState(DEFAULT_LOCALE);
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    ready,
    dir: dirOf(locale),
    setLocale,
    reset,
    tr: (key, vars) => t(locale, key, vars),
  }), [locale, ready, setLocale, reset]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
