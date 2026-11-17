# Cyrus Backend Architecture & System Design Reference

## Overview
Cyrus is designed with a defense-in-depth, high-reliability backend architecture tailored for Next.js, Neon Serverless Postgres, and distributed external APIs.

---

## 1. Request Lifecycle & Observability
- **Correlation ID Middleware (`src/lib/server/correlationId.ts`)**: Every request is assigned an `x-correlation-id` and `x-request-id` header to enable distributed tracing.
- **Structured JSON Logger (`src/lib/server/structuredLogger.ts`)**: Single-line JSON logger with automatic PII and sensitive token redaction (`password`, `token`, `secret`, `authorization`, `cookie`).
- **API Metrics Collector (`src/lib/server/apiMetrics.ts`)**: Tracks route throughput, status code distributions, error rates, and p50/p95/p99 latency percentiles.

---

## 2. Error Handling & Standardized Responses
- **RFC 7807 Problem Details (`src/lib/server/problemDetails.ts`)**: Formats all API errors into machine-readable `application/problem+json` documents with standard factory helpers (400, 401, 403, 404, 409, 422, 429, 500).
- **Zod Request Validation (`src/lib/server/validateRequest.ts`)**: Strongly-typed payload and parameter validation mapping validation issues directly to RFC 7807 invalid params.

---

## 3. Security & Access Control
- **Security Headers (`src/lib/server/securityHeaders.ts`)**: Enforces strict Content-Security-Policy (CSP) with nonce support, HSTS, X-Frame-Options: DENY, and X-Content-Type-Options: nosniff.
- **Double-Submit Cookie CSRF (`src/lib/server/csrf.ts`)**: Cryptographic CSRF tokens and signed cookies preventing cross-origin state mutations.
- **Role-Based Access Control (`src/lib/server/rbac.ts`)**: Granular role hierarchy (ADMIN, MAINTAINER, CONTRIBUTOR, VIEWER) and permission checks.
- **Timing-Safe Equality (`src/lib/server/timingSafe.ts`)**: Constant-time string and buffer comparison defeating timing side-channel attacks.
- **Anti-XSS & Input Sanitization (`src/lib/server/sanitizeInput.ts`)**: HTML escaping and URL protocol sanitization.
- **SQL Injection Guard (`src/lib/server/injectionGuard.ts`)**: Heuristic scanner intercepting malicious SQL syntax and union queries.

---

## 4. Resilience & Performance
- **API Circuit Breaker (`src/lib/server/circuitBreaker.ts`)**: Protects upstream dependencies (GitHub API, Hugging Face) from cascading failures.
- **Database Query Retry (`src/lib/server/queryRetry.ts`)**: Exponential backoff with full jitter recovering transient connection drops and serialization failures.
- **Idempotency Key Store (`src/lib/server/idempotency.ts`)**: Ensures mutation requests can safely retry without duplicate side-effects.
- **In-Memory LRU Cache (`src/lib/server/lruCache.ts`)**: Low-latency cache with TTL expiration and hit/miss telemetry.
- **Stale-While-Revalidate (`src/lib/server/swrCache.ts`)**: Serves cached catalog aggregates immediately with non-blocking background revalidation.
- **ETag & 304 Not Modified (`src/lib/server/etag.ts`)**: Bandwidth-saving conditional request validation.

---

## 5. Operations & Infrastructure
- **System Health Diagnostics (`src/lib/server/healthCheck.ts`)**: Subsystem health checks (DB ping, memory usage, uptime) returning 200/503.
- **Graceful Shutdown Coordinator (`src/lib/server/gracefulShutdown.ts`)**: Safe cleanup hook execution during rolling updates.
- **Session Revocation Blacklist (`src/lib/server/sessionRevocation.ts`)**: Real-time JWT invalidation store for user sign-outs and security events.
