# fix(templates): point the issue forms at live surfaces

**Issue:** [#96 — The bug report template asks contributors to reproduce against /hackathons, which isn't a page anymore](https://github.com/adityalenova/cyrus/issues/96)
**Level:** 3

## Problem

The issue forms still described the retired hackathon board: the bug report's
example bug was "the hackathon filter returns nothing", the data correction form
offered "hackathon information", and the enhancement form's model example was
"rank hackathons by overlap". None of that exists — there is no
`src/app/hackathons` route, and `src/lib/db/seed.ts` records that the hackathons
table is cleared and left empty.

One stale link was outside the hackathon topic as well: the data correction form
asked "Where does it appear on **cyrus.ai**?" — README.md states no custom domain
is attached, so the only live host is `cyrus-agent.vercel.app`.

## Route audit

Every route cited below was checked against `src/app` (page files found with
`find src/app -name page.tsx`):

| Route | Evidence |
| --- | --- |
| `/issues` | `src/app/issues/page.tsx`; the finder exposes a "Language" facet list and a "Search" box (`src/views/IssueFinder.tsx`), and writes both to the URL as `?q=` / `?lang=` so a filtered link is shareable. |
| `/skills` | `src/app/skills/page.tsx`; has its own search + filter rail. |
| `/programs` | `src/app/programs/page.tsx`. |
| `/organizations` | `src/app/organizations/page.tsx`. |
| `/dashboard` | `src/app/dashboard/page.tsx` (plus `dashboard/[feature]`). |
| `/hackathons` | **absent** — the premise of the issue checks out. |

## Exact old → new, line by line

`.github/ISSUE_TEMPLATE/bug_report.yml`

1. `      placeholder: The hackathon filter returns nothing for "AI".`
   → `      placeholder: The TypeScript language filter on the Issue Finder returns nothing.`
2. `      placeholder: https://cyrus-agent.vercel.app/issues`
   → `      placeholder: "https://cyrus-agent.vercel.app/issues?q=memory+leak&lang=typescript"`
3. Steps to reproduce (block scalar, two lines):
   ```
        1. Open /issues
        2. Search or filter the issues
   ```
   →
   ```
        1. Open https://cyrus-agent.vercel.app/issues
        2. Choose TypeScript under Language, then search for "memory leak"
   ```

`.github/ISSUE_TEMPLATE/data_correction.yml`

4. `description: Report incorrect program or hackathon information with a reliable source`
   → `description: Report incorrect program or organization information with a reliable source`
5. `      label: Where does it appear on cyrus.ai?`
   → `      label: Where does it appear on cyrus-agent.vercel.app?`
6. `      placeholder: https://cyrus-agent.vercel.app/issues`
   → `      placeholder: https://cyrus-agent.vercel.app/programs`

`.github/ISSUE_TEMPLATE/enhancement.yml`

7. `      description: Concrete behaviour, not a category. "The hero search should accept a stack and rank hackathons by overlap" beats "better search".`
   → `      description: Concrete behaviour, not a category. "The /skills search should accept a stack and rank results by overlap" beats "better search".`

`.github/ISSUE_TEMPLATE/config.yml` — audited, **no change**: its two links are a
CONTRIBUTING.md path that exists on `main` and GitHub's own
`security/advisories/new` endpoint (not a site route, and not verifiable
offline).

## YAML shape

Only scalar values changed; no key, `id`, element `type`, indentation level or
line order was touched, so every form keeps its `name` / `description` /
`labels` / `body` structure and the element ids (`what-happened`, `url`,
`steps`, `env`, `policy`, `page-url`, …) are unchanged. The one URL containing
`?` and `&` is double-quoted so it stays an unambiguous plain string. No tabs
were introduced.

## Deliberately left alone

- `body[].id` values, element types, validations and labels other than the ones quoted above.
- The bug report markdown note about star counts, deadlines, prizes and eligibility — those fields still exist for programs (`eligibility`, `pay`), and it is prose, not a route.
- The `[skip ci]`-era history that first touched this file (commit `026e611` had already swapped `/hackathons` for `/issues` in the URL field and steps); this branch fixes what was still wrong rather than redoing that edit.

## Verification

No TypeScript was touched, so `tsc --noEmit` is unaffected (it passed on the
neighbouring branches of this worktree). YAML was reviewed as a diff: seven
scalar substitutions, zero structural edits.
