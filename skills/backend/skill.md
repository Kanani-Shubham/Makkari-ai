---
name: backend
description: Node.js, REST & GraphQL APIs, microservices, background job queues, rate limiting, and caching
version: 1.0.0
category: engineering
tools:
  - memory
  - fetch_url
triggers:
  - backend
  - api
  - rest
  - database
  - server
  - queue
  - cache
  - redis
---

# Backend Engineering & System Architecture

## Architectural Standards
1. **Resilience & Idempotency**: Design write endpoints to accept idempotency keys (`Idempotency-Key` header) to handle retries without duplicate data.
2. **Error Normalization**: Always return consistent JSON error objects containing `{ error: string, code: string, message: string, retryable?: boolean }` with standard HTTP status codes (400, 401, 403, 404, 429, 500, 502).
3. **Database Transactions**: Group dependent database operations into transactions or atomic functions with advisory locking where concurrency conflicts can occur.
4. **Background Jobs**: Offload operations taking >500ms to durable background queues with leasing and exponential backoff retry policies.
