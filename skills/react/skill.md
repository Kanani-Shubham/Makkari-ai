---
name: react
description: React 19 architecture, custom hooks, state management (Zustand, Context), concurrent features, and component composition
version: 1.0.0
category: engineering
tools:
  - memory
triggers:
  - react
  - useState
  - useEffect
  - useMemo
  - useCallback
  - custom hook
  - zustand
  - component
---

# React Engineering Architecture

Adhere to state-of-the-art React standards:

## Key Guidelines
1. **State Ownership**: Place state as close as possible to the consumers. Use global stores (Zustand) for true application-level state.
2. **Hook Hygiene**: Keep dependency arrays comprehensive and exact. Avoid unnecessary `useEffect` chains for derived state; compute derived values directly during render or with `useMemo`.
3. **Component Composition**: Prefer clean composition patterns (slots, compound components) over massive multi-prop monolithic components.
4. **Performance**: Avoid inline arrow functions inside heavy lists where memoized children are re-rendering.
