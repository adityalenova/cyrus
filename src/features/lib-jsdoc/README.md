# docs(lib): JSDoc for the exported utility modules

**Issue:** [#206 — Add JSDoc comments to utility functions in src/lib](https://github.com/adityalenova/cyrus/issues/206)
**Level:** 2

## Problem

`src/lib` is the shared half of the app, but its small helper modules ship
without any contract: no statement of what a blank query does, which helpers
need a DOM, which "no database" means, or what a cache miss looks like. Reading
a call site cannot tell you whether `exportToCsv([])` downloads an empty file or
whether `getDb()` throws without `DATABASE_URL`.

## What changed

Documentation only — no behaviour, no renames, no signature changes, no
reformatting of code lines.

| File | Added |
| --- | --- |
| `src/lib/fuzzySearch.ts` | Module header; JSDoc for `fuzzySearch<T>` with `@typeParam`, `@param`, `@returns` and two `@example`s (one match, one blank query). |
| `src/lib/exportCsv.ts` | Expanded module header; JSDoc for `CsvColumn<T>` and `exportToCsv<T>` with `@typeParam`, `@param`, `@returns`, `@throws {TypeError}` for the SSR case and a runnable `@example`. |
| `src/lib/cacheManager.ts` | Module header (process-local, not shared between instances); class-level doc for `DataCache`; JSDoc for `DataCache.set` and `DataCache.get`. |
| `src/lib/analyticsTracker.ts` | Module header; JSDoc for `trackEvent` including the server-side no-op and the emitted event shape. |
| `src/lib/db/index.ts` | JSDoc for the `Db` type, `getDb` (null = backend offline, client cached on `globalThis`) and `dbReady`. |
| `src/lib/db/seed.ts` | JSDoc for `seedRbac` (`@param`, `@returns`, `@throws`, `@example`); one-line docs on `PREDEFINED_ROLES`, `PREDEFINED_PERMISSIONS`, `PREDEFINED_ROLE_PERMISSIONS`. |

Every example was written against the signature in the file next to it, so the
`@example` blocks are call sites a reader can paste into a REPL or a handler.

## Paths the issue named that do not exist

| Requested | Reality |
| --- | --- |
| `src/lib/utils.ts` | **Not present.** The real module is `src/lib/util.ts`. |
| `src/lib/auth/**` | **Not present.** There is no `src/lib/auth/` directory. The auth helpers live in `src/lib/server/auth.ts`, and the only auth-adjacent client module is `src/lib/rbac/context.tsx`. |

## Deliberately left alone

- **`src/lib/util.ts`** — owned by #101, including its comments. A second edit
  there would conflict, so nothing in this branch touches it.
- **`src/lib/server/**`** — outside the paths assigned to this branch;
  `src/lib/server/auth.ts` is therefore undocumented here rather than borrowed
  from another worktree's file set.
- **`src/lib/rbac/context.tsx`** — a React provider/hook module. JSDoc on
  JSX-heavy hooks is noise, which the issue explicitly excludes.
- **`src/lib/mark.ts`** — the module exists and is already the best-documented
  file in `src/lib` (module header plus a doc on every export). It exports only
  the data constants `PETALS`, `PETAL_OUT`, `RADIUS` and `COUNT`; it exports no
  functions, so there was nothing to add.
- **`src/lib/db/schema.ts`** — exports 20 Drizzle table objects and their
  inferred row types, not functions, and already carries a module header that
  explains the catalog/account split. Per-table JSDoc would have been a
  several-hundred-line diff of comments over declarations whose column comments
  already say what each field is.

## Verification

```
node ../../node_modules/typescript/bin/tsc --noEmit   # exit 0
node ../../node_modules/vitest/vitest.mjs run src/lib # 43 files pass, 2 fail
```

Both failures are pre-existing on `fc388d4` and unrelated to this branch (they
reproduce with the same two files untouched):

- `src/lib/seo.test.ts` — "canonical URLs is emitted by every route in the app router"
- `src/lib/siteStats.test.ts` — "view copy has no thousands-separated count literal outside the allowed views" (`ProposalStudio.tsx` hard-codes `6,199`)
