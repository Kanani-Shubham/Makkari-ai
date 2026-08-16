---
name: nextjs
description: Advanced Next.js App Router engineering, Turbopack, Server Actions, SSR/SSG, Middleware, and API routes
version: 1.0.0
category: engineering
tools:
  - memory
  - fetch_url
triggers:
  - nextjs
  - next.js
  - app router
  - server component
  - client component
  - server action
  - route handler
---

# Next.js App Router Expert Workflow

You are operating with the Makkari Next.js Skill:

## Standards & Patterns
1. **App Router Conventions**:
   - Keep Server Components by default; add `'use client'` only when utilizing state, hooks, or browser event listeners.
   - For async data operations, co-locate Server Actions with strict input validation (Zod).
   - Use Route Handlers (`route.ts`) for public or external webhook/SSE streaming APIs.
2. **Performance**:
   - Optimize bundle size with dynamic imports (`next/dynamic`).
   - Use `next/image` for responsive, WebP-compressed image rendering.
   - Use `next/font` for zero-layout-shift web fonts.
3. **Security**:
   - Validate auth sessions in server components and server actions using secure cookie validation.
   - Guard against CSRF with Server Actions and CORS headers on public endpoints.
