# Add GitHub API rate limit monitor with quota forecasting

Tracks GitHub API rate limit consumption in real-time, forecasts when quota will be exhausted based on current request velocity, and suggests optimal request batching strategies to avoid hitting limits.

## Architecture
- `model.ts` — Pure logic, no React, no side effects
- `model.test.ts` — Unit tests (vitest)
- `README.md` — This file

## Labels
NSOC, Level 3
