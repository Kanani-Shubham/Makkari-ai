# Makkari AI — Performance Optimization & Latency Guide

## 1. Latency Bottlenecks & Solutions

| Area | Previous Latency | Optimized Latency | Optimization Mechanism |
|---|---|---|---|
| **Proxy / Middleware Auth** | 8,000ms – 10,000ms | **<50ms** | Skipped remote `auth.getUser()` calls in Next.js middleware for `/api/*` and static routes. API routes validate sessions directly without duplicate roundtrips. |
| **Model Discovery (`/api/models/discovery`)** | ~11,500ms | **<30ms (cached)** / **<1,800ms (cold)** | Implemented in-memory cache-first lookup with `Promise.allSettled()` and independent 2.5s timeouts per cloud provider. |
| **Skill & Tool Manifest Resolution** | Unmeasured | **<10ms** | Cached in-memory parsing of `skill.md` files; compact manifest generation replaces prompt file bloating. |
| **SSE Streaming Delivery** | Buffered delays | **Instant First Token** | Pre-flight generator evaluation with unbuffered SSE chunk flushing and `Cache-Control: no-transform`. |

---

## 2. Request Deduplication & Idempotency Rules

1. **Client Request Locking**: Single submit buttons and Enter-key handlers use `isStreaming` state guards and AbortControllers to prevent concurrent requests.
2. **Single Chat Invariant**: A new conversation thread is created **ONLY** when the user explicitly clicks "New Chat" or submits a message from the initial empty home composer. No secondary chats are created on error or retry.
3. **Database Write Guards**: Messages and `post_chat_jobs` are persisted only when valid assistant content is received (`accumulatedContent.trim().length > 0`). Failed upstream requests never write empty rows to Supabase.
