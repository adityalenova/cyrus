# Database Schema and Migration Guidelines

## Drizzle ORM
- Define schemas in `drizzle/schema.ts`.
- Run `npm run db:generate` to produce SQL migration files.
- Run `npm run db:push` to apply migrations in development.

## Neon Serverless Postgres
- Use `@neondatabase/serverless` for connection pooling across serverless functions.
- Keep indexes aligned with high-frequency query filters.
