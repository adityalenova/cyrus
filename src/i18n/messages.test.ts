/* ══ messages.test.ts — every language has every string ═════════════════
   English is the source. A locale that misses a key, adds one English does not
   have, leaves one empty or drops a {placeholder} fails here, so a half
   translated page cannot ship. ══ */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, directionOf, isLocale } from "./locales";

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree => JSON.parse(readFileSync(join(__dirname, "..", "..", "messages", `${l}.json`), "utf8"));

function flatten(t: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}
const placeholders = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(",");

const source = flatten(load(DEFAULT_LOCALE));

describe("message files", () => {
  it("has a file for every locale and English is the default", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toContain("en");
    expect(Object.keys(source).length).toBeGreaterThan(0);
  });

  for (const locale of LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
    describe(locale, () => {
      const flat = flatten(load(locale));
      it("has exactly the keys English has", () => {
        expect(Object.keys(flat).sort()).toEqual(Object.keys(source).sort());
      });
      it("has no empty string", () => {
        expect(Object.entries(flat).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
      });
      it("keeps every {placeholder} of the English string", () => {
        const bad = Object.keys(source).filter((k) => placeholders(flat[k] ?? "") !== placeholders(source[k]));
        expect(bad).toEqual([]);
      });
    });
  }
});

describe("locales", () => {
  it("lists the six languages the issue asks for", () => {
    expect([...LOCALES].sort()).toEqual(["en", "es", "fr", "hi", "pt", "zh"]);
  });
  it("is left-to-right for all of them, and right-to-left is one table entry away", () => {
    for (const l of LOCALES) expect(directionOf(l)).toBe("ltr");
    expect(isLocale("es")).toBe(true);
    expect(isLocale("xx")).toBe(false);
  });
});
