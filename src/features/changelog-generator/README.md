# Add automated changelog generator from conventional commit history

Parses conventional commit messages (feat, fix, chore, docs, refactor, perf) and generates structured changelogs grouped by type with version headers, breaking change highlights, and Markdown export.

## Architecture
- `model.ts` — Pure logic, no React, no side effects
- `model.test.ts` — Unit tests (vitest)
- `README.md` — This file

## Labels
NSOC, Level 3
