# Add intelligent client-side cache manager with TTL and eviction policies

Implements an in-memory + localStorage cache with configurable TTL per key prefix, LRU eviction when size limits are exceeded, stale-while-revalidate support, and cache hit/miss ratio monitoring.

## Architecture
- `model.ts` — Pure logic, no React, no side effects
- `model.test.ts` — Unit tests (vitest)
- `README.md` — This file

## Labels
NSOC, Level 3
