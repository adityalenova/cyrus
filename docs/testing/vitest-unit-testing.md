# Vitest Unit Testing Standards

## Running Unit Tests
```bash
npm run test
npm run test:coverage
```

## Guidelines
- Co-locate unit tests alongside their modules (e.g., `rateLimit.test.ts`).
- Mock timer intervals and external API endpoints.
- Aim for high branch coverage on business logic in `src/lib/`.
