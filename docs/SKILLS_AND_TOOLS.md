# Makkari AI — Skills & Tools Developer Guide

## 1. How Skills Work

Skills in Makkari are reusable, modular domain capabilities. Each skill is encapsulated in a directory inside `skills/` containing a `skill.md` file with YAML frontmatter.

### Skill File Format Example (`skills/nextjs/skill.md`)

```markdown
---
name: nextjs
description: Expert workflow for Next.js App Router applications
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
---

# Next.js Expert Workflow
Instructions on how the model should reason about Next.js components...
```

### The Manifest Pattern (Zero Context Bloat)
Instead of injecting all 13 skill files into every prompt (which would consume thousands of tokens and slow down generation), Makkari generates a compact manifest:

```xml
<available_skills>
- **nextjs**: Expert workflow for Next.js App Router applications
- **react**: React 19 architecture and custom hooks
- **research**: Real-time web investigation and multi-source synthesis
</available_skills>
```

When a user prompt includes keywords or semantic intent matching a skill's triggers, Makkari dynamically injects the targeted workflow instructions inside `<active_skill>` tags.

---

## 2. Universal Tool Engine

Makkari uses a canonical internal `ToolDefinition` representation:

```typescript
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: ToolInputSchema;
  permissions: 'read' | 'write' | 'delete' | 'external_action';
  requiresConfirmation: boolean;
  enabled: boolean;
  handler: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}
```

### Built-in Native Tools

| Tool ID | Name | Category | Permissions | Description |
|---|---|---|---|---|
| `memory` | `makkari_memory` | `memory` | `write` | Store, update, search, and delete user preferences and project knowledge. |
| `web_search` | `web_search` | `search` | `read` | Live web search engine for current documentation, news, and technical references. |
| `calculator` | `calculator` | `computation` | `read` | Safe mathematical and formula evaluator. |
| `fetch_url` | `fetch_url` | `web` | `read` | Clean text content extractor from HTTP/HTTPS URLs. |
| `code_runner` | `code_runner` | `coding` | `write` | Sandboxed JavaScript code execution for data transformations. |
