# Repo link — one canonical GitHub repository identity

Issue: [adityalenova/cyrus#144](https://github.com/adityalenova/cyrus/issues/144)

## Problem

The same repository reaches the site as `owner/name`, an `https://` URL, a
protocol-relative URL, an `ssh://` URL and a copied `git@github.com:` remote,
each with its own `.git` suffix and trailing slash. Every consumer used to
carry its own regex, and the regexes disagreed: some trimmed a pull-request or
branch link down to its repository, some kept the `.git` in the key, one
lowercased the display name. A repository keyed two ways is counted twice; a
link built from the wrong spelling points at a path GitHub does not serve.

## What was built

`src/lib/repoLink.ts` is now the only place that decides what a repository
link is.

```ts
normalizeRepoUrl(input: string): { owner, name, key, url } | null
repoKey(input: string): string | null
```

- `key` is the lowercased `owner/name`, the value to key on. GitHub treats
  owner and repository names as case-insensitive.
- `owner` and `name` keep the spelling that arrived, for display and
  provenance. `url` is `https://github.com/<owner>/<name>` built from that
  spelling, so a canonical link never guesses a case.
- Nothing throws. Anything unrecognized is `null`, so a crawler keeps going
  and a page renders a message instead of a stack.

Accepted, each with optional `.git` and trailing slashes:

| form | example |
| --- | --- |
| bare | `owner/name` |
| http(s) URL | `https://github.com/Owner/Name` (also `www.`, either scheme case) |
| protocol-relative | `//github.com/owner/name` |
| schemeless host | `github.com/owner/name` |
| ssh URL | `ssh://git@github.com/owner/name.git` |
| scp remote | `git@github.com:owner/name.git` |

Rejected: any other host (`gitlab.com`, `github.com.evil.io`, `notgithub.com`),
non-ASCII or zero-width characters, percent-encoded paths, query strings,
fragments, backslashes, ports, userinfo other than `git` on `ssh:`, a path that
is not exactly two segments, GitHub site pages that sit where an owner would
(`/topics/…`, `/orgs/…`), and every deep link (`/issues/1`, `/pull/7`,
`/tree/main`, `/blob/…`).

Deep links are rejected on purpose. A link to an issue names something inside
a repository, not the repository; silently trimming it would attribute a row
to a repository the input never pointed at. Callers that genuinely want "the
repository this PR belongs to" keep their own trimming and say so.

## File map

| file | role |
| --- | --- |
| `src/lib/repoLink.ts` | the normalizer (`normalizeRepoUrl`, `repoKey`, `RepoLink`) |
| `src/features/repo-link/repoLink.test.ts` | table of 20 accepted and 40 rejected spellings, plus hostile input |

The feature folder holds this README and the test. The issue asked for the
module at `src/lib/repoLink.ts`; there is no UI and therefore no `.tsx`.

## Call sites migrated

Each of these receives a repository URL from an API or an HTML card grid and
needs exactly `owner/name`:

| file | line | before |
| --- | --- | --- |
| `scripts/fetch-24pr.mjs` | 90 | local `repoOf` regex, first two segments |
| `scripts/fetch-gssoc.mjs` | 48 | local `ownerRepo`, seed regex then `repo_url` regex |
| `scripts/fetch-lfx-alltime.mjs` | 68–78 | inline `repoLink` regex, kept case |
| `scripts/fetch-vercel-oss.mjs` | 72 | lowercased full URL as key, prefix stripped for `repo` |

Call sites deliberately left alone, because their behaviour would change:

- `scripts/build-program-projects.mjs` (local `repoKey`, lines 134–139, used at
  226, 315, 373). Its Summer of Bitcoin input contains links to pull requests
  (49 in the current `public/data/otherProjects.json`), and the existing code
  deliberately collapses those to the repository before the GitHub API call.
  The new helper rejects deep links, so migrating this file would drop those
  rows.
- `scripts/build-program-roster.mjs` line 40 and `scripts/audit-login-matches.mjs`
  line 46 extract an *organization login*, not a repository; a two-segment
  parser would reject their one-segment input.
- `src/lib/dash/analyser.tsx` uses `src/lib/repoRef.mjs`, which accepts pasted
  deep links on purpose, because the analyser reads the repository a pasted
  issue or PR lives in.
- `src/lib/bookmarks.ts` parses issue URLs, not repositories.
- `src/lib/repoRef.mjs` is unchanged: its documented contract trims refs and
  query strings, which is the opposite of this module's contract.

## Data sources and as-of

No data is fetched and no network request was made. The accepted and rejected
forms are GitHub's documented URL shapes. The claim that the four migrated
call sites only see repository roots was checked against the snapshots already
on disk: `public/data/lfx-archive.json` (generated 2026-10-24),
`public/data/24pr-archive.json`, `public/data/gssoc-archive.json` and
`public/data/program-projects/vercel-oss.json` (2026-10-25 crawl) carry no
deep repository links.

## Limitations

- github.com and www.github.com only. GitHub Enterprise hosts are out of scope.
- A repository named `foo.git` cannot be expressed: one `.git` suffix is always
  read as the suffix.
- The reserved-owner list is a fixed set of GitHub site routes. A real account
  whose login is one of those words would be rejected rather than guessed at.
- The four migrated `.mjs` scripts import a `.ts` file, which needs Node's
  native type stripping (Node 24 here, and the same pattern
  `scripts/build-org-class.mjs` and `scripts/org-stats.mjs` already use). They
  are build-time scripts, not part of the Next.js bundle.
