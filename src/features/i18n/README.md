# feat(i18n): multi-language internationalization foundation

**Issue:** [#188](https://github.com/cyrus-ai/cyrus/issues/188)
**Labels:** Level 3
**Branch:** `feat/188-i18n`

## Problem
The product had no translation layer at all: every string was an English
literal. #188 asks for the infrastructure — typed catalogs, a `t()` with
placeholder interpolation and English fallback, a stored locale, direction
support — so pages can be migrated over time without a rewrite.

## What was built
- **Typed catalogs** for `en`, `es`, `hi`, `zh`, `pt`, `fr`. English defines
  the key set (`MessageKey`); every other catalog is typed `Catalog`, so a
  missing or extra key is a compile error, and the test suite checks the same
  invariant on the real data.
- **`t(locale, key, vars)`** — key-typed, `{placeholder}` interpolation, and a
  fallback to English for an unknown locale, a missing key or a blank value.
- **`dirOf(locale)`** returns `"ltr" | "rtl"` from the language subtag, with
  Arabic, Hebrew, Persian, Urdu and friends already mapped to `rtl`, so an RTL
  catalog drops in without touching call sites.
- **`I18nProvider` / `useI18n`** — reads `?lang=`, then
  `localStorage["cyrus.locale.v1"]`; writes `document.documentElement.lang`
  and `.dir` while mounted and restores the values it found on unmount. A
  choice the visitor makes is persisted; merely opening a `?lang=` link is
  not written over their stored preference.
- **`/settings/language`** — a new settings namespace with a switcher (native
  name plus English name, `aria-pressed`), a live preview built from the
  current catalog, the persisted choice, and "reset to English". This page is
  the one surface that is **fully** translated; metadata advertises each
  catalog as a `?lang=` alternate plus `x-default`.

## File map
| Path | Role |
| --- | --- |
| `src/features/i18n/messages.ts` | locale metadata, the six catalogs, `MessageKey` |
| `src/features/i18n/model.ts` | pure `t`, `interpolate`, `dirOf`, resolution, alternates |
| `src/features/i18n/model.test.ts` | vitest, node env |
| `src/features/i18n/provider.tsx` | client context: storage, document lang/dir |
| `src/features/i18n/LanguageSettings.tsx` | the translated switcher surface |
| `src/app/settings/language/page.tsx` | route + metadata with `?lang=` alternates |

## Data sources
No external data. The catalogs are hand-written in this repository; the stored
choice is a plain string in `localStorage` under `cyrus.locale.v1`. As-of:
catalogs as committed on this branch (2026-11-22).

## Honest scope
- **This is infrastructure plus one translated surface.** `/settings/language`
  is fully translated. The rest of the site still renders English literals;
  moving a page over means replacing its literals with catalog keys, one page
  at a time. Neither the README nor the page claims the app as a whole is
  translated.
- **No `next-intl` (or any dependency) was added.** This repository's PRs do
  not add dependencies, and the requirement is small enough to own: a typed
  record, one replace pass, and a context provider. If pluralisation, ICU
  message syntax or route-based locale segments are needed later, that is the
  point to adopt a library, not before.
- No locale-aware number or date formatting is included yet; `Intl` is
  available when a page needs it.
- The provider is mounted per surface, not in the root layout, so setting
  `<html lang>` never implies untranslated pages are in another language.

## Tests
`node ../../node_modules/vitest/vitest.mjs run src/features/i18n`

Covers: six locales, identical key sets against English, no empty values,
identical placeholder sets per key (catches a translation dropping `{count}`),
non-copy translation spot-checks, interpolation (strings, numbers, missing
token left visible), fallback for unknown locale / missing key / blank value,
locale resolution from case/region tags and quoted storage values, `?lang=`
parsing, `dirOf` for shipped and RTL languages, native/English names,
`<html lang>` tags, alternate-link shape and key-drift reporting.

## Limitations
- Catalog strings are author-written translations; a native-speaker review is
  still owed before they are presented as final copy.
- Pluralisation is not handled ("{count} issues" reads the same at 1 and 12).
- `?lang=` variants are query strings on one URL: good for sharing, but only
  the canonical URL is indexable, by design.
- Direction is derived and applied to `<html dir>`, but no shipped catalog is
  RTL yet, so RTL layout has not been visually exercised.
