/* ══ model.test.ts — the catalog is the contract ═══════════════════════
   Issue #188. The three things that silently break an i18n surface are a
   locale missing a key, a translation that drops a {placeholder}, and a
   direction that is assumed rather than derived. All three are checked
   here, on the real catalogs, not on fixtures.                         ═ */
import { describe, expect, it } from "vitest";
import { LOCALE_IDS, LOCALES, MESSAGES, en, type Locale } from "./messages";
import {
  DEFAULT_LOCALE, LOCALE_KEY, RTL_LANGUAGES, alternateLanguages, dirOf, englishName,
  htmlLang, interpolate, isLocale, keyDiff, localeFromSearch, messageOf, nativeName,
  readStoredLocale, resolveLocale, t,
} from "./model";

const keysOf = (catalog: object) => Object.keys(catalog).sort();
const tokensOf = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("catalogs", () => {
  it("ships exactly the six locales the issue asks for", () => {
    expect(LOCALE_IDS).toEqual(["en", "es", "hi", "zh", "pt", "fr"]);
    expect(Object.keys(MESSAGES).sort()).toEqual(["en", "es", "fr", "hi", "pt", "zh"]);
    expect(Object.keys(LOCALES).sort()).toEqual(["en", "es", "fr", "hi", "pt", "zh"]);
  });

  it("gives every locale the English key set, with nothing missing or extra", () => {
    for (const id of LOCALE_IDS) {
      expect(keyDiff(id)).toEqual({ missing: [], extra: [] });
      expect(keysOf(MESSAGES[id])).toEqual(keysOf(en));
    }
  });

  it("has no empty or whitespace-only value in any locale", () => {
    for (const id of LOCALE_IDS) {
      for (const [key, value] of Object.entries(MESSAGES[id])) {
        expect(typeof value, `${id}.${key}`).toBe("string");
        expect(value.trim(), `${id}.${key}`).not.toBe("");
      }
    }
  });

  it("keeps the same {placeholders} in every translation of a key", () => {
    for (const id of LOCALE_IDS) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(tokensOf(MESSAGES[id][key]), `${id}.${key}`).toEqual(tokensOf(en[key]));
      }
    }
  });

  it("really translated the strings, rather than copying English", () => {
    /* a catalog identical to English would pass every structural test
       above, so spot-check the two locales furthest from it */
    expect(MESSAGES.es["page.title"]).not.toBe(en["page.title"]);
    expect(MESSAGES.zh["page.title"]).not.toBe(en["page.title"]);
    expect(MESSAGES.hi["page.title"]).not.toBe(en["page.title"]);
  });
});

describe("interpolate", () => {
  it("fills every named placeholder, strings and numbers alike", () => {
    expect(interpolate("Hello {name}, {count} items", { name: "Ada", count: 3 })).toBe("Hello Ada, 3 items");
    expect(interpolate("{a}{b}", { a: "x", b: "y" })).toBe("xy");
  });

  it("leaves a placeholder with no value visible instead of blanking it", () => {
    expect(interpolate("{count} tracked", {})).toBe("{count} tracked");
    expect(interpolate("{count} tracked", { repos: 2 })).toBe("{count} tracked");
  });

  it("does nothing to a template without tokens", () => {
    expect(interpolate("No tokens here")).toBe("No tokens here");
  });
});

describe("t and fallback", () => {
  it("translates through the current catalog", () => {
    expect(t("es", "page.title")).toBe("Idioma");
    expect(t("fr", "page.title")).toBe("Langue");
    expect(t("en", "preview.greeting", { name: "Sam" })).toBe("Welcome back, Sam.");
    expect(t("es", "preview.summary", { count: 12, repos: 34 })).toBe("12 incidencias seguidas, en 34 repositorios.");
  });

  it("falls back to English for an unknown locale", () => {
    expect(messageOf("de", "page.title")).toBe(en["page.title"]);
    expect(t("zz", "page.lede")).toBe(en["page.lede"]);
  });

  it("falls back to English for a key a catalog is missing", () => {
    const spanish = MESSAGES.es as Record<string, string>;
    const saved = spanish["page.title"];
    delete spanish["page.title"];
    try {
      expect(t("es", "page.title")).toBe(en["page.title"]);
    } finally {
      spanish["page.title"] = saved;
    }
  });

  it("falls back to English for an empty value", () => {
    const french = MESSAGES.fr as Record<string, string>;
    const saved = french["actions.reset"];
    french["actions.reset"] = "   ";
    try {
      expect(t("fr", "actions.reset")).toBe(en["actions.reset"]);
    } finally {
      french["actions.reset"] = saved;
    }
  });
});

describe("resolveLocale", () => {
  it("accepts the shipped ids in any case and matches a region tag", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("ES")).toBe("es");
    expect(resolveLocale("es-MX")).toBe("es");
    expect(resolveLocale("pt_BR")).toBe("pt");
    expect(resolveLocale('"fr"')).toBe("fr");
    expect(resolveLocale(" en ")).toBe("en");
  });

  it("returns null rather than guessing an unshipped language", () => {
    expect(resolveLocale("de")).toBeNull();
    expect(resolveLocale("ar")).toBeNull();
    expect(resolveLocale("")).toBeNull();
    expect(resolveLocale(null)).toBeNull();
    expect(resolveLocale(42)).toBeNull();
    expect(isLocale("es")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  it("reads the stored value and the ?lang= parameter", () => {
    expect(readStoredLocale("hi")).toBe("hi");
    expect(readStoredLocale(null)).toBeNull();
    expect(readStoredLocale("")).toBeNull();
    expect(localeFromSearch("?lang=fr")).toBe("fr");
    expect(localeFromSearch("?utm=1&lang=zh")).toBe("zh");
    expect(localeFromSearch("")).toBeNull();
    expect(localeFromSearch("?lang=de")).toBeNull();
    expect(LOCALE_KEY).toBe("cyrus.locale.v1");
  });
});

describe("dirOf", () => {
  it("reads the six shipped locales left-to-right", () => {
    for (const id of LOCALE_IDS) expect(dirOf(id)).toBe("ltr");
  });

  it("already knows the right-to-left languages a future catalog would use", () => {
    for (const code of RTL_LANGUAGES) expect(dirOf(code)).toBe("rtl");
    expect(dirOf("ar-EG")).toBe("rtl");
    expect(dirOf("he_IL")).toBe("rtl");
    expect(dirOf("FA")).toBe("rtl");
    expect(dirOf("ur-PK")).toBe("rtl");
  });

  it("treats anything it does not know, including empty input, as ltr", () => {
    expect(dirOf("")).toBe("ltr");
    expect(dirOf("de")).toBe("ltr");
    expect(dirOf(undefined as unknown as string)).toBe("ltr");
  });
});

describe("names and documents", () => {
  it("shows the native name and the English name", () => {
    expect(nativeName("es")).toBe("Español");
    expect(englishName("es")).toBe("Spanish");
    expect(nativeName("hi")).toBe("हिन्दी");
    expect(nativeName("de")).toBe("de");
  });

  it("writes a usable <html lang> tag", () => {
    expect(htmlLang("zh")).toBe("zh-Hans");
    expect(htmlLang("en")).toBe("en");
    expect(htmlLang("unknown")).toBe("en");
  });

  it("advertises every locale as a ?lang= alternate, plus x-default", () => {
    const alt = alternateLanguages("/settings/language");
    expect(Object.keys(alt).sort()).toEqual(["en", "es", "fr", "hi", "pt", "x-default", "zh"]);
    expect(alt.es).toBe("/settings/language?lang=es");
    expect(alt["x-default"]).toBe(`/settings/language?lang=${DEFAULT_LOCALE}`);
  });

  it("names the catalogs that drift, so a new locale fails loudly", () => {
    expect(keyDiff(LOCALE_IDS[0])).toEqual({ missing: [], extra: [] });
    expect(keyDiff("de").missing.slice().sort()).toEqual(keysOf(en));
    expect(keyDiff("de").extra).toEqual([]);
  });
});

describe("the catalogs' own metadata", () => {
  it("gives every locale a native name, an English name and a tag", () => {
    for (const id of LOCALE_IDS) {
      const meta: { native: string; english: string; tag: string } = LOCALES[id as Locale];
      expect(meta.native.length).toBeGreaterThan(0);
      expect(meta.english.length).toBeGreaterThan(0);
      expect(meta.tag.length).toBeGreaterThanOrEqual(2);
    }
  });
});
