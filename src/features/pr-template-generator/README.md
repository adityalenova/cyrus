# Add pull request description template generator with context-aware sections

Generates structured PR description templates based on the type of change (bugfix, feature, refactor, docs, chore).

## Architecture
- `model.ts` — Pure logic, no React, no side effects
- `model.test.ts` — Unit tests (vitest)
- `README.md` — This file

## Labels
NSOC, Level 3
