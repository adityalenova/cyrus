# Developer Troubleshooting Guide

## Port 3000 In Use
If port 3000 is occupied:
```bash
npx kill-port 3000
# or run on alternative port:
npm run dev -- -p 3001
```

## Database Connection Failures
- Ensure `DATABASE_URL` is configured in `.env.local`.
- Neon Postgres requires SSL connection parameters (`?sslmode=require`).
