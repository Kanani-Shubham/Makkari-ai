---
name: typescript
description: Strict TypeScript type systems, generics, utility types, discriminating unions, and runtime validation
version: 1.0.0
category: engineering
tools:
  - memory
triggers:
  - typescript
  - ts
  - type
  - interface
  - generic
  - generic type
  - zod
---

# TypeScript Engineering & Strict Typing

## Rules of Type Architecture
1. **No `any`**: Use `unknown` with type guards or discriminating unions instead of `any`.
2. **Discriminating Unions**: Model polymorphic states (e.g. `{ status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T }`) with explicit discriminator keys.
3. **Runtime Schema Validation**: Validate all external I/O (API requests, database reads, environment variables) using Zod or equivalent schemas.
4. **Const Assertions**: Use `as const` for fixed lookup dictionaries and literal enums.
