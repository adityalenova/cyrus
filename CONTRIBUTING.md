# Contributing to cyrus.ai

cyrus.ai is a catalog of open-source programs, company hackathons and agent
skills. It is small, live and maintained by one person, so the process below
exists to protect review time rather than to gatekeep.

**Please read the assignment rule before you write any code.**

## The one rule that matters

**Do not create a branch or write code for an issue until a maintainer has
assigned it to you.**

Unassigned pull requests are placed on hold or closed. This is not a
judgement of your work: an unreviewed PR costs the maintainer more time than
no PR at all, and design directions that look good in isolation have been
rejected here more than once. Claiming an issue first takes ten seconds and
saves everyone an afternoon.

### Claiming an issue

1. Pick an [open issue](https://github.com/adityalenova/cyrus/issues). If
   nothing fits, [open one](https://github.com/adityalenova/cyrus/issues/new/choose)
   and wait for it to be accepted before asking to work on it.
2. Comment `/assign` on the issue. A maintainer assigns it to you or explains
   why it is not a good fit.
3. Start work only after the assignment appears.

### Time windows

- Once assigned, you have **48 hours** to open a pull request.
- Need longer? Comment before the window closes and it is extended to
  **72 hours**, or to whatever the work genuinely needs if you say so.
- Silence past the window releases the issue back to the pool. Nothing is lost
  and no one is penalised; partial work is still welcome as a draft PR once
  you re-claim.
- **One issue at a time.** Finish or hand back before claiming the next.

## What we are looking for

Issues labelled [`enhancement`](https://github.com/adityalenova/cyrus/labels/enhancement),
[`seo`](https://github.com/adityalenova/cyrus/labels/seo),
[`performance`](https://github.com/adityalenova/cyrus/labels/performance)
and [`accessibility`](https://github.com/adityalenova/cyrus/labels/accessibility)
are all good places to start. Data corrections are the most useful contribution
of all: if a star count, deadline, prize or eligibility line is wrong, say so
on the issue with a link to the primary source.

## Design constraints

The visual language is settled: a warm coffee-and-honey system, Plus Jakarta
Sans, cream paper surfaces and terracotta accents. Several palette and hero
directions have been explored and reverted, so please treat these as fixed:

- **No new colour palettes or theme experiments.** Colour changes need a
  maintainer decision, not a PR.
- **The hero stays calm.** No parallax, no heavy animation, no star fields.
  Motion is functional, never decorative, and everything must respect
  `prefers-reduced-motion`.
- **No emoji in the interface.** Use the existing inline SVG icons.
- **No arrows in copy.** Use `›` or `✦` where a marker is genuinely needed.
- **Hyphens, never em-dashes.**
- Page intros are one or two short, plain sentences. Do not stuff counts into
  button labels.
- Reuse the card type classes in `src/app/globals.css` (`.card-title`,
  `.card-desc`, `.panel-h`) instead of ad-hoc font combinations.

If your change touches visuals, attach before and after screenshots to the PR.

## Setting up

```bash
npm ci
npm run dev        # http://localhost:5330
```

Node 20.9 or newer is required (`engines` in `package.json`), and `.nvmrc` pins
22 for `nvm use`. CI builds and tests on 20.x and 22.x but does not run the data
scripts.

The data scripts that import TypeScript (`build-org-class.mjs`,
`contribo-summary.mjs`, `org-stats.mjs`) run through tsx, for example
`npx tsx scripts/org-stats.mjs`. Plain `node` fails on Node 20 through 24 with
`ERR_MODULE_NOT_FOUND` (`ERR_UNKNOWN_FILE_EXTENSION` before Node 22.18), and
neither error mentions tsx.

Optional local services, only when your issue needs them:

```bash
npm run gh-relay   # GitHub OAuth token exchange relay on :8787
npm run refresh    # refresh hackathon and program datasets
```

Never commit `.env` or `.github-secret`. Both are ignored, and secrets do not
belong in an issue, a PR or a comment either.

## Before you open a pull request

The whole gate has to pass locally. CI runs the build and the tests on every
pull request.

```bash
npm run typecheck
npm test
npm run build
```

TypeScript is strict and `noUnusedLocals` is on, so a leftover import fails the
build. Add or update a Vitest test when you change behaviour, not only when it
is convenient.

## Pull request checklist

- The PR body names the issue it closes with `Closes #123`, and that issue is
  assigned to you.
- One issue per PR. Unrelated cleanups belong in their own branch.
- `npm run typecheck`, `npm test` and `npm run build` all pass.
- Screenshots attached for any visual change, light and dark.
- No new tracked build output: `.next/` and `.shots/` are not source.
- Description says what changed and why, in plain sentences.

## Review

A maintainer reviews when time allows and will say so on the PR. Expect
questions rather than rejections. Once approved, the maintainer merges with
squash commits, so keep your branch history readable but do not worry about
tidying it yourself. Rebase onto `main` if your branch falls behind.

Merging to `main` deploys to production automatically, so anything that changes
a route, an API response or the build needs a careful look before it lands.

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Found a problem with how the repo is run?
[SECURITY.md](SECURITY.md) covers vulnerabilities; anything else can go to the
maintainer through GitHub.

Program question, or an idea you want to talk through before it becomes an
issue? Open a thread on [r/Cyrusagent](https://www.reddit.com/r/Cyrusagent/),
or ask in the [Discord server](https://discord.gg/8S6z2Thczd) if you want an
answer sooner.


## Workflow quick reference

### Labels and issue types

Check the labels on an issue before volunteering. Common areas to look for include `bug`, `enhancement`, `seo`, `performance`, and `accessibility`. Use the data correction form for inaccurate catalog information and include a primary source. Use a blank issue if none of the available forms fits.

### Claim comment

When asking to be assigned, describe your proposed approach as well as your availability. For example, copy and adapt this comment:

> Hi! I would like to work on this issue. My proposed approach is to reproduce the problem, inspect the relevant code, make a focused change, and run the appropriate checks. Does this approach fit the scope? If so, please assign it to me.
>
> /assign

Do not start work until the assignment appears on the issue.

### Branch and commit naming

Create a branch only after assignment. Use a short, descriptive name with a type prefix, such as `fix/platform-dropdown`, `feat/program-filter`, `docs/contributor-workflow`, `chore/issue-template-cleanup`, or `test/search-regression`.

Format commit messages as `<type>: <short description>`. Allowed examples include `feat` for features, `fix` for bug fixes, `docs` for documentation, `chore` for maintenance, `test` for tests, and `refactor` for internal restructuring. Examples:

- `docs: clarify the contributor workflow`
- `chore: add a data correction issue form`
- `fix: correct program filter behavior`

### Code and accessibility standards

Keep changes focused and follow existing code patterns. Prefer semantic HTML, give form controls accessible labels, ensure interactive elements work with a keyboard and have visible focus indicators, maintain sufficient text contrast, and never rely on color alone to communicate meaning. Respect `prefers-reduced-motion`. Add or update Vitest tests when behavior changes.

### Draft pull requests

A draft pull request is appropriate for incomplete work or early feedback. Explain what is done, what remains, and how to test it. Draft status does not replace the requirement to get assigned before starting work. Keep one issue per pull request, reference it with `Closes #123`, and follow the repository pull request template and required checks.
