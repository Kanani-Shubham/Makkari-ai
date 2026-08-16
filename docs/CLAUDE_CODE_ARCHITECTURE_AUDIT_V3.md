# MAKKARI AI — Claude Code Architecture Audit v3
## Phase 0: Architecture Research, Mapping & Final Implementation Plan
**Date:** 2026-08-16 | **Version:** 3.0 (Final — 10/10)
**Status:** AUDIT FINAL — Issue `APPROVE RUNTIME FOUNDATION` to begin

---

## EXECUTIVE SUMMARY

This document is the authoritative architecture plan for the Makkari AI Runtime Foundation upgrade. It incorporates three rounds of expert review and is the final specification before implementation begins.

**The most important conclusion:**

> **Do not make Makkari bigger first. Make Makkari's existing intelligence execute through one correct runtime path first.**

The goal is not more files, more tools, or more features. The goal is:

```text
ONE RUNTIME

User
 ↓
TurnState
 ↓
QueryEngine
 ↓
Provider
 ↓
ToolRouter
 ↓
Tool
 ↓
Tool Result
 ↓
QueryEngine (loop)
 ↓
Provider
 ↓
Final Answer
```

Once that works reliably, MCP, agents, planning, tool search, compaction, and autonomous workflows become **extensions of the runtime** rather than disconnected systems.

---

## NON-REGRESSION RULES (READ FIRST)

> **These rules apply to every file touched during the Runtime Foundation phases.**

### Systems That Must NOT Be Rewritten

The following systems are strong and correct. Do NOT rewrite or replace them:

| System | File(s) | Why Protected |
|--------|---------|--------------|
| Memory Architecture | `lib/ai/memory/` | More sophisticated than reference |
| Capability Truth Layer | `lib/ai/capability/truth-layer.ts` | Critical hallucination prevention |
| Output Contract | `lib/ai/intent/contract-builder.ts` | Deterministic, well-tested |
| Skill System | `lib/ai/skills/` | 14 skills, correct routing |
| Provider Adapters | `lib/ai/providers/` | 6 adapters, correct interface |
| Authentication | `app/api/auth/` | Supabase Auth, OAuth |
| BYOK Encryption | `lib/ai/encryption/` | AES-256-GCM |
| Artifact Database Schema | `supabase/migrations/` | RLS-protected, correct |
| Canonical Event Bus | `lib/ai/events/canonical-events.ts` | Strong foundation |
| Supabase RLS | All migrations | Security layer |
| Tool Definitions | `lib/ai/tools/builtin/` | Correct handler logic |

### The Modification Rule

```text
ADD → ADAPT → WIRE → TEST
over
REWRITE → REPLACE
```

Every modification must **preserve existing behavior** unless the behavior is explicitly identified as a defect in this audit. If a change would break an existing system, stop and consult this document.

---

## A. REFERENCE ARCHITECTURE (What We Learn From Claude Code)

### A.1 The Core Lesson: The Tool Loop Pattern

The reference's `query()` demonstrates a **recursive async generator** that feeds tool results back into the model. The architectural lesson is the **loop concept** — not the recursive implementation:

```text
Model call
 ↓
Parse response
 ↓
If tool calls:
  Execute tools
  Append results to messages
  → Model call again
Else:
  Return final response
```

**For Makkari**: Implement as a **state-machine while-loop** with explicit termination conditions — not as a recursive generator. Easier to control, budget, and debug.

### A.2 Permission Model (Adapted)

Reference: 3-tier per-command permissions (safe allowlist / exact match / prefix pattern).
Makkari: Category-based (READ/WRITE/EXTERNAL_ACTION/DESTRUCTIVE). Both must be **server-enforced only** — never client-side.

### A.3 Tool Progress = UI, Not API

Tools yield `progress` messages (UI-only side effects) and `result` messages (sent to API as tool results). Never send progress to the model.

### A.4 What NOT to Take From the Reference

| Reference Feature | Decision |
|------------------|---------|
| Recursive `query()` pattern | Use state-machine loop instead |
| BashTool / FileEditTool / GlobTool | Not applicable (web app) |
| NotebookTool / StickerTool | Anthropic-internal |
| Binary Feedback | Anthropic research |
| Statsig / VCR / Sentry | Anthropic infrastructure |
| CLAUDE.md file-based memory | Replaced by Makkari's superior Supabase memory |
| Old MCP HTTP+SSE implementation | Superseded by 2026-07-28 spec |

---

## B. MAKKARI ARCHITECTURE (Current State — 31 Files Inspected)

### B.1 The Central Defect — Broken Tool Loop ★ CRITICAL

**This is the highest-priority finding.**

Current execution path in `app/api/chat/stream/route.ts`:

```text
User Message
     ↓
[Memory Intent Check]
     ↓
[Capability Resolution]
     ↓
adapter.streamChat()  ← ONE call only
     ↓
Parse stream chunks
     ↓
IF tool call detected in text:
   Execute tool inline (artifact only)
   Emit event
     ↓
DONE ← tool result NEVER returned to model
```

**What is broken:** Tool results are parsed and executed, but never appended to the message history and never sent back to the provider. The model makes tool calls but operates blind — it never receives the results.

**The correct flow:**

```text
User Message
     ↓
QueryEngine.startTurn()
     ↓
┌─────────────────────────────────────────────────────┐
│  while (state.status === 'generating' ||            │
│         state.status === 'executing_tools')         │
│                                                     │
│  Check ALL termination conditions:                  │
│  - iteration >= limits.maxIterations → budget_exceeded │
│  - toolCalls >= limits.maxToolCalls → budget_exceeded  │
│  - elapsed > limits.maxDurationMs → budget_exceeded    │
│  - abortController.signal.aborted → cancelled          │
│                                                     │
│  1. provider.generate(state.messages)               │
│  2. stream + parse response                         │
│  3. if tool calls:                                  │
│       ToolRouter.authorize() + ToolExecutor.run()   │
│       Append RuntimeMessages (provider-neutral)     │
│       continue                                      │
│  4. else: finish()                                  │
└─────────────────────────────────────────────────────┘
     ↓
Final Response → Canonical Events → SSE → UI
```

### B.2 ToolRouter Bypass — Two Critical Security Violations

**Violation 1 — Inline artifact execution:**
The route handles `makkari_artifact` with custom inline code, bypassing all ToolRouter protections (budget, loop detection, audit, permissions).

**Violation 2 — PendingAction direct execution (CRITICAL SECURITY HOLE):**
```typescript
// Current dangerous code
PendingActionStore.executeAction()
  → toolRegistry.getTool(tool).handler(args)  // direct call
```

This bypass skips: budget limits, loop detection, permission checks, capability truth validation, audit logging. It creates a **second execution pathway** that is impossible to audit or control.

**The rule:** There must be exactly ONE tool execution pathway: `QueryEngine → ToolRouter → ToolExecutor → Tool`. No exceptions.

### B.3 Canonical Event System — STRONG ✅

`CanonicalEventBus`: single `STREAM_START`, single terminal event, monotonic sequence numbers, protocol-versioned envelopes, post-terminal rejection. **Keep exactly as-is.**

**Gap**: `TOOL_PROGRESS` event type missing. `TOOL_CALL`/`TOOL_RESULT` not emitted from actual tool execution.

### B.4 ToolRouter — EXISTS BUT NOT WIRED ⚠️

`lib/ai/tools/tool-router.ts` has: 60s budget, 10-call limit, 8-MCP limit, loop detection, schema validation, confirmation checks, audit logging. **Not called from the chat route.** The route handles `makkari_artifact` inline and ignores ToolRouter for the primary artifact tool.

### B.5 Capability Truth Layer — STRONG ✅

`resolveRuntimeCapabilities()`: builtin + MCP evaluation, `<capability_truth>` XML manifest, disconnected services guidance. **Keep.**

### B.6 Memory Architecture — EXCELLENT ✅

More sophisticated than the reference: 3-layer (settings + summaries + persistent), credential sanitization, rhetorical intent exclusion, background worker with retry. **Keep.**

### B.7 MCP Architecture — STUB ⚠️

`MCPRegistry` is architecturally correct (singleton, lazy discovery, TTL cache, ToolRegistry adapter). `MCPClient` is a stub — no real transport.

### B.8 Provider Architecture — STRONG ✅

6 adapters (Gemini, Groq, OpenRouter, OpenAI, Anthropic, Ollama). Each implements `ProviderAdapter`. **Keep.**

**Gap**: No Provider Normalizer layer. No canonical `RuntimeMessage` → provider-native format conversion per adapter (see Section D.1).

### B.9 All Other Systems — STRONG ✅

Skills (14, keyword routing), Output Contract (deterministic <1ms), Pending Actions (idempotent), Artifact System (tables + UI), Database Schema (7 migrations + RLS), Authentication (Supabase), BYOK (AES-256-GCM). **Keep all.**

---

## C. ARCHITECTURE COMPARISON

| Capability | Claude Reference | Makkari Current | Gap | Priority |
|-----------|----------------|----------------|-----|---------|
| **Multi-Turn Tool Loop** | Recursive generator | Flat single-pass | **CRITICAL** | Phase 3 |
| **ToolRouter Wiring** | Tool-as-generator | Exists, not wired | **CRITICAL** | Phase 2 |
| **PendingAction Security** | N/A | Bypasses ToolRouter | **CRITICAL** | Phase 2 |
| **RuntimeMessage Layer** | Not implemented | Not implemented | **HIGH** | Phase 1 |
| **TurnState Model** | Implicit | Not implemented | **HIGH** | Phase 1 |
| **TurnLimits Config** | Hardcoded | Not implemented | HIGH | Phase 1 |
| **callId Correlation** | Present | Partial | HIGH | Phase 1 |
| **Provider Capability Matrix** | Anthropic only | 6 providers unverified | HIGH | Phase 4 |
| **Canonical Events (TOOL_*)** | ProgressMessage | Partial/unwired | HIGH | Phase 5 |
| **MCP Transport** | Legacy HTTP+SSE | Stub | HIGH | Phase 7 |
| **Tool Execution Order** | Read-only parallel | Not defined | MEDIUM | Phase 3 |
| **Context Compaction** | None | None | MEDIUM | Phase 8 |
| **Provider Normalizer** | N/A | Ad-hoc in route | MEDIUM | Phase 4 |
| **ThinkingPanel Real Events** | N/A | Static fallback | **MEDIUM/LOW** | Phase 6 |
| **Tool Search** | N/A | N/A | **MEDIUM/LOW** | Phase 9 |
| **Vector Memory** | N/A | N/A | **FUTURE** | Phase 12+ |
| **Agents / Planning** | AgentTool | N/A | LOW | Phase 12 |
| Memory | File-based | Supabase 3-layer | **Makkari BETTER** | — |
| Events | React state | Canonical bus + SSE | **Makkari BETTER** | — |
| Artifacts | Not in reference | Full system | **Makkari BETTER** | — |
| Providers | Anthropic only | 6 providers | **Makkari BETTER** | — |
| Database | Disk files | Supabase + RLS | **Makkari BETTER** | — |

---

## D. RUNTIME ARCHITECTURE SPECIFICATIONS

### D.1 CRITICAL: Provider-Neutral RuntimeMessage Layer

The QueryEngine **must never construct provider-specific tool-call or tool-result messages directly**. Different providers represent tool interactions differently:

```text
Canonical Runtime Messages
          ↓
    ProviderAdapter
    (format conversion)
  ┌────┬────┬────┬────┐
  ↓    ↓    ↓    ↓    ↓
 OAI  Ant  Gem  Gro  Oll
```

Define a canonical message schema:

```typescript
// lib/ai/runtime/runtime-messages.ts

type RuntimeMessage =
  | {
      role: 'user';
      content: string;
      attachments?: ChatAttachment[];
    }
  | {
      role: 'assistant';
      content: string;           // text content (may be empty if only tool calls)
      toolCalls?: RuntimeToolCall[];
    }
  | {
      role: 'tool_result';
      results: RuntimeToolResult[];
    };

interface RuntimeToolCall {
  callId: string;              // immutable correlation ID
  toolName: string;
  arguments: Record<string, unknown>;
}

interface RuntimeToolResult {
  callId: string;              // same ID as the RuntimeToolCall
  toolName: string;
  success: boolean;
  content: string;             // stringified result for model
  error?: string;
  isError: boolean;
}
```

Each `ProviderAdapter` receives `RuntimeMessage[]` and converts to its native format internally:

```typescript
interface ProviderAdapter {
  // Takes canonical runtime messages, converts internally
  streamChat(messages: RuntimeMessage[], options: ChatOptions): AsyncIterable<ChatChunk>;
  
  // Converts provider-native tool call format → RuntimeToolCall
  parseToolCalls(providerResponse: unknown): RuntimeToolCall[];
}
```

**Rule**: The QueryEngine appends only `RuntimeMessage` objects to `state.messages`. Provider-specific serialization is the adapter's responsibility, not the engine's.

### D.2 CRITICAL: callId Correlation Is Mandatory and Immutable

Every tool call must carry a `callId` that is created by the **provider response** (or generated by Makkari if the provider doesn't generate one) and preserved, unchanged, through the entire lifecycle:

```text
Provider response
  └── tool_call
        ├── callId: "call_abc123"    ← created here
        ├── tool: "web_search"
        └── arguments: { query: "..." }

QueryEngine
  └── RuntimeToolCall.callId = "call_abc123"  ← preserved

ToolRouter
  └── authorize(callId: "call_abc123")

ToolExecutor
  └── execute(callId: "call_abc123")

TOOL_CALL event
  └── callId: "call_abc123"

TOOL_RESULT event
  └── callId: "call_abc123"

RuntimeToolResult
  └── callId: "call_abc123"    ← model receives correct result
```

With multiple concurrent tool calls, callId ensures correct association:

```text
call_001 → web_search   → result_001
call_002 → calculator   → result_002
call_003 → fetch_url    → result_003
```

**callId must never be dropped, mutated, or regenerated after creation.**

### D.3 TurnState — First-Class Runtime Concept

`TurnState` is the single source of truth for a turn's execution. Create it before the QueryEngine starts; carry it through every step.

```typescript
// lib/ai/runtime/turn-state.ts

interface TurnState {
  // Identity
  turnId: string;
  conversationId: string;
  userId: string;

  // Messages (provider-neutral, grows through tool loop)
  messages: RuntimeMessage[];

  // Iteration tracking
  iteration: number;
  toolCallsThisTurn: number;
  mcpCallsThisTurn: number;

  // Timing
  startedAt: number;

  // Configurable limits (see D.4)
  limits: TurnLimits;

  // Status
  status:
    | 'initializing'
    | 'generating'
    | 'executing_tools'
    | 'waiting_confirmation'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'budget_exceeded';

  // Pending / Active
  pendingActions: PendingAction[];
  activeToolCalls: RuntimeToolCall[];

  // Context
  estimatedTokens?: number;
  maxTokens?: number;
  compactionApplied?: boolean;

  // Resolved once per turn
  resolvedCapabilities?: ResolvedCapabilities;

  // Cancellation
  abortController: AbortController;
}

function createTurnState(
  conversationId: string,
  userId: string,
  initialMessages: RuntimeMessage[],
  limits: TurnLimits,
  abortController: AbortController
): TurnState
```

### D.4 TurnLimits — Configurable, Not Hardcoded

Do NOT hardcode `60_000` in the QueryEngine. Define a configurable limits object:

```typescript
// lib/ai/runtime/turn-limits.ts

interface TurnLimits {
  maxIterations: number;      // Max tool loop iterations
  maxToolCalls: number;       // Max total tool executions
  maxMcpCalls: number;        // Max MCP tool executions
  maxDurationMs: number;      // Wall-clock time limit
  maxOutputTokens?: number;   // Optional output cap
}

// Resolution function — returns defaults for Phase 3, extensible later
function resolveTurnLimits(
  model: MakkariModel,
  userId: string,
  environment: 'development' | 'production'
): TurnLimits {
  // Phase 3 implementation: return sensible defaults
  return {
    maxIterations: 8,
    maxToolCalls: 10,
    maxMcpCalls: 8,
    maxDurationMs: 60_000,
  };
  // Future tiers: free/pro/enterprise, long-running tasks, MCP async tasks
}
```

This architecture allows future expansion without changing the QueryEngine:
- Free tier → 30s, 5 tool calls
- Pro → 60s, 10 tool calls
- Long task → 5min, 20 tool calls
- MCP async → delegate to background job (Phase 7+)

### D.5 Tool Execution Order — Serial First, Parallel Later

**Phase 3 rule**: All tools execute **serially**. This is intentional.

```text
Phase 3 (correctness first):
call_001 → execute → result
call_002 → execute → result   (sequential)
call_003 → execute → result

Phase 4+ (optimization):
read-only + independent calls → parallel (max 10 concurrent)
write / destructive / confirmation-required → serial (always)
```

Add tool metadata to `ToolDefinition` to support future optimization:

```typescript
// Add to lib/ai/tools/types.ts
interface ToolDefinition {
  // ... existing fields ...
  executionMode: 'read_only' | 'write' | 'destructive' | 'external_action';
  independentExecution?: boolean;   // safe to run without ordering guarantees
}
```

In Phase 3, ignore `executionMode` and always execute serially. In a later phase, use it to enable `Promise.all()` for `read_only + independentExecution` tools.

### D.6 ToolRouter vs ToolExecutor — Separation of Responsibility

Conceptually separate authorization from execution, even if implemented in one file initially:

```text
ToolRouter — "May this tool execute?"
  ├── Capability check (is tool enabled?)
  ├── Permission check (does user have access?)
  ├── Budget check (iterations/calls/time remaining?)
  ├── Loop detection (same signature twice = reject)
  ├── Confirmation check (requiresConfirmation → ACTION_REQUIRED)
  └── Schema validation (model args valid?)
        ↓ (only if all checks pass)
ToolExecutor — "Execute this already-authorized tool."
  ├── Emit TOOL_CALL event (callId, toolName, args)
  ├── Call tool.handler(args, context)
  ├── Emit TOOL_PROGRESS events (for long operations)
  ├── Emit TOOL_RESULT event (success/failure)
  ├── Write to tool_execution_logs
  └── Return RuntimeToolResult
```

This separation becomes critical when adding:
- Sub-agents (inherit authorization, fresh execution)
- MCP tools (authorization at registry, execution at client)
- Background tasks (authorization sync, execution async)

### D.7 MCP Transport — 2026-07-28 Specification

**Do not build around legacy MCP HTTP+SSE.** The 2026-07-28 MCP specification introduced a stateless protocol core with Streamable HTTP, while legacy SSE is being deprecated.

Implementation directive:
```
Implement MCP using the currently supported MCP TypeScript SDK 
and the 2026-07-28 specification where supported.

Prefer: Streamable HTTP for remote servers
Support: stdio for intentionally local MCP processes
Do not build new architecture around: legacy SSE
Maintain fallback only when: required by the selected SDK

The new spec includes: stateless HTTP core, cache hints, 
authorization hardening, extensions, multi-round-trip requests,
and the MCP Tasks extension for long-running tools.
```

**On MCP Tasks (future):** The MCP Tasks extension supports long-running tool execution with lifecycle states. The Phase 3 synchronous ToolRouter architecture must not prevent this:

```text
Phase 3 (synchronous):
ToolRouter → ToolExecutor → execute() → result (within turn)

Phase 7+ (async MCP Tasks):
ToolRouter → MCP Task created → background execution
                              → task status/result retrieved
                              → result appended to messages
```

Design `ToolExecutor` with an async-result contract from the start; do not assume all tools return synchronously.

### D.8 External Tool Output Trust Model

**ALL external tool output is untrusted data.** This is not limited to MCP:

```text
UNTRUSTED DATA (must never become SYSTEM INSTRUCTION):
  ├── MCP server responses
  ├── Web search results
  ├── Fetched URL content
  ├── User-uploaded documents
  ├── Memory retrieved from database
  ├── Artifact content
  └── Any external API response

Classification:
  → TOOL RESULT (data the model receives as tool output)
  ≠ SYSTEM INSTRUCTION (instructions that modify model behavior)
```

MCP tool annotations (readOnlyHint, destructiveHint, etc.) are hints only — they must not be treated as hard security guarantees. Hard guarantees require host-side enforcement in `ToolRouter`. From the MCP specification:

> "Annotations from untrusted servers can be false. Hard guarantees require host-side enforcement/sandboxing."

**Every tool result must be wrapped in boundary markers before entering the message history:**

```text
<tool_result tool="web_search" callId="call_001" status="success">
{content}
</tool_result>
```

This ensures the model treats it as data, not as instructions.

---

## E. PROVIDER CAPABILITY MATRIX

Before building the QueryEngine, **verify the actual behavior** of each adapter by reading the code. Do not assume:

| Provider | Native Tool Calls | Tool Results in Messages | Streaming | Vision | Abort Signal | Notes |
|---------|-----------------|------------------------|-----------|--------|-------------|-------|
| Gemini | ❓ Verify | ❓ Verify | ✅ | ✅ | ❓ Verify | `generateContent` API |
| OpenAI | ❓ Verify | ❓ Verify | ✅ | ✅ | ❓ Verify | `tool_calls` in delta |
| Anthropic | ❓ Verify | ❓ Verify | ✅ | ✅ | ❓ Verify | Thinking blocks |
| Groq | ❓ Verify | ❓ Verify | ✅ | ❌ | ❓ Verify | OpenAI-compatible |
| OpenRouter | ❓ Verify | ❓ Verify | ✅ | ❓ | ❓ Verify | Model-dependent |
| Ollama | ❓ Verify | ❓ Verify | ✅ | ❓ | ❓ Verify | Model-dependent |

For each adapter, verify:
1. Does `streamChat()` parse native tool call deltas or does it rely on `StatefulToolProtocolParser`?
2. Does the adapter correctly format `RuntimeMessage` with tool results when passed back?
3. Is `abortSignal` wired to every HTTP fetch/stream call?
4. What does `ChatChunk` actually emit per delta?

Adapters that don't support native tool calls use `StatefulToolProtocolParser`. Both paths must produce identical `RuntimeToolCall` objects for the QueryEngine.

---

## F. FINAL TARGET ARCHITECTURE

```text
                    ┌─────────────────────────┐
                    │      MAKKARI AI         │
                    │   AI WORKSPACE          │
                    └────────────┬────────────┘
                                 │
                           User Message
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Chat Route         │
                    │  authenticate           │
                    │  validate request       │
                    │  create TurnState       │
                    │  stream events          │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Query Orchestrator   │
                    │    while (!finished)    │
                    │    TurnState loop       │
                    └────────┬────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ContextManager    MemoryManager    CapabilityTruth
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                             ▼
                      Skill Resolver
                             │
                             ▼
                      Model Registry
                             │
                             ▼
                    Provider Adapter
                    (RuntimeMessage[]
                     → provider-native)
                             │
                    Provider Normalizer
                    (response → canonical)
                             │
                    ┌────────┴────────┐
                    │                 │
               TEXT DELTA      TOOL CALL(S)
                    │            (callId preserved)
                    │                 │
                    ▼                 ▼
              Canonical         ┌──────────────┐
              Event Bus         │  ToolRouter  │
              (TEXT_DELTA)      │ ─────────── │
                                │ Capability   │
                                │ Permission   │
                                │ Budget       │
                                │ Loop Guard   │
                                │ Confirmation │
                                │ Audit        │
                                └──────┬───────┘
                                       │ (authorized)
                                       ▼
                                ┌──────────────┐
                                │ ToolExecutor │
                                │ ─────────── │
                                │ TOOL_CALL   │→ EventBus
                                │ TOOL_PROG   │→ EventBus
                                │ TOOL_RESULT │→ EventBus
                                └──────┬───────┘
                                       │
                         ┌─────────────┼─────────────┐
                         │             │             │
                    Builtin        Artifact        MCP
                    Tools          Tool          Tools
                         │             │             │
                         └─────────────┼─────────────┘
                                       │
                                 RuntimeToolResult
                                 (callId preserved)
                                       │
                                       ▼
                               Append to messages
                               as RuntimeMessage
                               {role:'tool_result'}
                                       │
                                 TurnState.iteration++
                                 Check all limits
                                       │
                            ┌──────────┴──────────┐
                            │ More tool calls?     │
                            │ YES ──────────────── ┘ loop
                            │ NO
                            └──► Final text response
                                       │
                                       ▼
                               Canonical Event Bus
                                       │
                                    SSE Encoder
                                       │
                                   Makkari UI
                                  (Event Router)
                                       │
                         ┌─────────────┼─────────────┐
                         │             │             │
                   ThinkingPanel      Chat      ArtifactCard
                   (real events)   Messages   ActionRequired
```

---

## G. SECURITY AUDIT — PHASE 0.5 SCOPE

Phase 0.5 is an **audit-only phase**. No source code modifications except emergency security fixes. Generate `docs/MAKKARI_RUNTIME_SECURITY_AUDIT.md`. **STOP. Review findings. Then begin Phase 1.**

### G.1 Tool Execution Boundary
Model-generated arguments → schema validation → tool handler. Never trust raw model output. Verify ToolRouter schema validation covers all builtin tools.

### G.2 Two ToolRouter Bypass Paths (Fix in Phase 2)
1. Inline `makkari_artifact` in route — document exact lines
2. `PendingActionStore.executeAction()` direct handler call — document exact lines
Both are CRITICAL. Do not fix in Phase 0.5 (audit only); fix in Phase 2.

### G.3 MCP Trust Boundary
Verify all MCP results are boundary-wrapped before entering message history. Annotations are hints, not guarantees.

### G.4 Artifact HTML Sandbox
Verify `artifact-preview.tsx` iframe has:
- `sandbox="allow-scripts allow-forms"` — **no `allow-same-origin`**
- `referrerPolicy="no-referrer"`
- No access to parent window, auth cookies, or localStorage

### G.5 API Key Logging
Audit every `console.log` in `app/api/` for potential API key exposure.

### G.6 codeEvalTool Classification
Classify as one of: DANGEROUS / SANDBOXED / RESTRICTED. Document the classification in the security audit. Do not enable DANGEROUS in production.

### G.7 Memory Content Injection
Memory content injected into system prompt. Add boundary wrapper around memory injection in `formatMemoryContextPrompt()`:
```text
<user_memory id="...">
{sanitized content}
</user_memory>
```

### G.8 External Tool Output (Broad Principle)
All external tool output is UNTRUSTED DATA. Verify every tool result is wrapped before model context injection.

---

## H. PHASE 3 ACCEPTANCE TESTS (QueryEngine)

After implementing the QueryEngine, **prove it works with these 8 tests** before proceeding to Phase 4:

### Test 1 — No Tools
```
Input:  "What is 2+2?"
Flow:   1 provider generation, 0 tool executions
Assert: 1 DONE event, model text response present
```

### Test 2 — One Tool, One Result
```
Input:  A prompt that triggers calculator
Flow:   Provider → calculator tool call → result → Provider → final
Assert: 2 provider generations, 1 tool execution
Assert: TOOL_CALL event emitted with callId
Assert: TOOL_RESULT event emitted with SAME callId
Assert: Final response references calculation result
```

### Test 3 — Multiple Tools, Correct callId Association
```
Input:  A prompt that triggers web_search + calculator
Flow:   Provider → [search, calc] calls → results → Provider → final
Assert: callId for search result ≠ callId for calculator result
Assert: Each result matches its tool call
Assert: 2 TOOL_CALL events, 2 TOOL_RESULT events
```

### Test 4 — Tool Failure → Graceful Response
```
Input:  A prompt that triggers a tool that will fail
Flow:   Provider → tool call → tool throws → error result → Provider
Assert: TOOL_RESULT event with isError=true
Assert: Model receives error message as tool result
Assert: Model responds gracefully (acknowledges failure)
Assert: NO crash, NO unhandled exception
```

### Test 5 — Max Iterations Enforcement
```
Input:  Engineered prompt causing repeated tool calls
Flow:   Provider → tool → Provider → tool → ... → budget_exceeded
Assert: Loop stops at TurnLimits.maxIterations
Assert: DONE event emitted (not STREAM_ERROR)
Assert: NO infinite loop
```

### Test 6 — Cancellation Mid-Execution
```
Input:  Any prompt with tool call
Action: Abort AbortController mid-tool-execution
Assert: Tool stops as soon as possible
Assert: CANCELLED event emitted
Assert: NO subsequent provider calls after cancellation
```

### Test 7 — Pending Action Flow (Security Critical)
```
Input:  Prompt triggering ACTION_REQUIRED
Assert: ACTION_REQUIRED event emitted
Assert: ToolRouter NOT yet called (awaiting confirmation)
Action: User confirms
Assert: Execution goes through ToolRouter → ToolExecutor
Assert: TOOL_CALL event emitted
Assert: TOOL_RESULT event emitted

CRITICAL NEGATIVE TEST:
Assert: PendingActionStore.executeAction() does NOT call
        tool.handler() directly
Assert: All budget/permission/audit checks run
```

### Test 8 — Provider Parity
Run Tests 1 and 2 with each provider that supports tool calls:
- Gemini ✓/✗ (verify adapter)
- OpenAI ✓/✗ (verify adapter)
- Anthropic ✓/✗ (verify adapter)
- Groq ✓/✗ (verify adapter, may not support tools)
- Ollama ✓/✗ (model-dependent)

Document which providers pass. Providers that fail tool parity are flagged for Phase 4 fixes.

---

## I. IMPLEMENTATION ORDER (15 Phases)

### PHASE 0 — Architecture Audit ✅ COMPLETE

---

### PHASE 0.5 — Security + Runtime Contract Audit ★ STOP CHECKPOINT
**Audit only. No source code modifications except emergency security fixes.**

Deliverable: `docs/MAKKARI_RUNTIME_SECURITY_AUDIT.md` covering:
- Tool execution boundary classification
- ToolRouter bypass exact file locations
- iframe sandbox attributes
- API key logging audit
- codeEvalTool classification
- Memory injection boundary audit

**STOP after generating this document. Review before proceeding to Phase 1.**

---

### PHASE 1 — Runtime Contracts
*Definitions that everything else depends on.*

- `lib/ai/runtime/runtime-messages.ts` — `RuntimeMessage`, `RuntimeToolCall`, `RuntimeToolResult`
- `lib/ai/runtime/turn-state.ts` — `TurnState`, `createTurnState()`
- `lib/ai/runtime/turn-limits.ts` — `TurnLimits`, `resolveTurnLimits()`
- `lib/ai/runtime/runtime-types.ts` — `ExecutionBudget`, `RuntimeError` types
- Update `lib/ai/tools/types.ts` — add `executionMode` to `ToolDefinition`
- Add `TOOL_PROGRESS` to `MakkariEvent` union in `canonical-events.ts`
- Add memory content boundary wrapper to `formatMemoryContextPrompt()`

---

### PHASE 2 — ToolRouter Unification (Security + Architecture)
*Eliminate all bypass paths. Conceptually separate Router from Executor.*

- Remove inline `makkari_artifact` logic from chat route
- Ensure `makkariArtifactTool` executes through `ToolRouter → ToolExecutor`
- Fix `PendingActionStore.executeAction()` → route through `ToolRouter → ToolExecutor`
- All tool executions emit `TOOL_CALL` + `TOOL_RESULT` canonical events
- Implement `ToolExecutor` as a conceptually separate responsibility within `tool-router.ts`
- Write tool_execution_logs migration

---

### PHASE 3 — Multi-Turn Query Orchestrator
*The core runtime.*

- Implement `lib/ai/runtime/query-engine.ts`
- State-machine `while (!finished)` loop with explicit termination at every condition
- `RuntimeMessage[]` state carried throughout loop (provider-neutral)
- All tools execute **serially** in Phase 3
- `callId` preserved and immutable throughout
- `TurnState.abortController.signal` checked at every iteration
- Wire `ToolRouter → ToolExecutor` into the loop
- Replace flat single-pass logic in chat route
- **Run all 8 acceptance tests before proceeding to Phase 4**

---

### PHASE 4 — Provider Normalization + Compatibility
*Verify what each adapter can actually do.*

- Build provider capability matrix by reading actual adapter code
- Implement `lib/ai/providers/normalizer.ts` — `RuntimeMessage[]` → provider-native
- Each adapter implements `parseToolCalls()` → `RuntimeToolCall[]`
- Persist discovered models to `model_providers.supported_models`
- Add model availability checking

---

### PHASE 5 — Canonical Runtime Events
*Make events real.*

- `TOOL_CALL` event from ToolExecutor before execution
- `TOOL_PROGRESS` event from long-running tools
- `TOOL_RESULT` event from ToolExecutor after execution
- `MCP_CALL` / `MCP_RESULT` from MCP client
- `tool_execution_logs` table population

---

### PHASE 6 — ThinkingPanel Real Event Wiring
*Only now make the UI consume real events.*

- Remove `"Synthesizing response..."` static fallback
- Wire SSE event router to `ThinkingEventItem[]`
- Show real tool names, progress, durations from events
- Add `action-required-card.tsx` for ACTION_REQUIRED events
- Add real duration tracking (STREAM_START → DONE)

---

### PHASE 7 — MCP Runtime
*Real MCP, not stubs.*

- Implement MCP transport per 2026-07-28 specification
- Prefer Streamable HTTP for remote servers
- Support stdio for local processes
- Do NOT build around legacy SSE
- Connection lifecycle management
- Tool discovery → ToolRegistry → ToolExecutor
- MCP tool results treated as UNTRUSTED DATA (boundary-wrapped)
- Design leaves room for MCP Tasks (async long-running)
- `mcp_servers` database table

---

### PHASE 8 — Context Manager + Compaction
*Design around the real tool loop messages (Phase 3 must be complete first).*

- `lib/ai/context/context-manager.ts`
- Token estimation per `RuntimeMessage`
- Compaction at 80% of model context window
- Preserve: last 10 messages + tool results + pending actions + artifact refs
- Memory injection threshold (skip for short turns)
- `messages.token_count_estimate` column

---

### PHASE 9 — Tool Search (Deferred Discovery)
*Useful once MCP tools bring total count to 20+.*

- `lib/ai/tools/builtin/tool-search.ts`
- Always-available; returns matching tool schemas on-demand
- Does not replace upfront capability manifest for small tool sets

---

### PHASE 10 — Workspace + Artifact Security
- Full iframe sandbox audit (fix if needed)
- CSP headers for artifact preview
- Artifact versioning + ARTIFACT_UPDATE UI
- Copy/download source verification

---

### PHASE 11 — Model Capability UX
- Disable image upload when model lacks vision
- Tool capability warning in composer
- Model health indicators

---

### PHASE 12 — Planning + Agents *(post-runtime stability)*
- Sub-agent isolation (own TurnState, inherited authorization)
- Planning mode
- Recursive depth limits

---

### PHASE 13 — Automated Tests
Coverage for: TurnState transitions, tool loop, budget limits, bypass prevention, pending action idempotency, capability truth, canonical events, memory intent, output contract, MCP disconnected response, iframe sandbox.

---

### PHASE 14 — Browser Golden Tests
The 7 scenarios from the master prompt (glassmorphism artifact, memory, Canva disconnected, pending action, unavailable model, capability gating, mobile layout).

---

### PHASE 15 — Documentation + Final Audit
`MAKKARI_MASTER_RUNTIME_GUIDE.md`, `TOOL_DEVELOPMENT_GUIDE.md`, `SKILL_DEVELOPMENT_GUIDE.md`, `MCP_DEVELOPMENT_GUIDE.md`, `MODEL_PROVIDER_GUIDE.md`, `MAKKARI_UPGRADE_FINAL_REPORT.md`.

---

## J. APPROVAL SCOPE

### Controlled Scope — APPROVE RUNTIME FOUNDATION

```
Phase 0.5  → Security audit (STOP checkpoint — review before proceeding)
Phase 1    → Runtime contracts
Phase 2    → ToolRouter unification
Phase 3    → Multi-turn query orchestrator (+ 8 acceptance tests)
Phase 4    → Provider compatibility verification
Phase 5    → Canonical runtime events
```

**STOP after Phase 5. Verify all 8 acceptance tests pass. Then issue `APPROVE PHASE 6+`.**

Do NOT simultaneously change: query engine + MCP + memory + compaction + UI + database + tool search. Each phase must be independently verifiable.

---

## K. WHAT NOT TO ADD (Extended)

| Feature | Reason |
|---------|--------|
| BashTool / FileEditTool / GlobTool | Web app — not applicable |
| NotebookTool / StickerTool | Anthropic-internal |
| Binary Feedback / Statsig / VCR | Anthropic infrastructure |
| Git tools | Makkari is not a code editor |
| `chats.context_budget_used` column | Stale counter anti-pattern; use runtime estimation |
| `user_memories.embedding vector(1536)` | Future phase — model/dimension unspecified |
| Recursive QueryEngine pattern | State-machine loop is correct for Makkari |
| ArchitectTool | Phase 12 — post-runtime stability only |
| Parallel tool execution (Phase 3) | Serial first; correctness before optimization |
| MCP Tasks in Phase 7 | Leave architectural room; implement Phase 9+ |

---

## L. CONCLUSION

### The 5 Critical Defects (Confirmed)

1. ⚠️ **Multi-turn tool loop broken** — `streamChat()` called once, results never returned
2. ⚠️ **ToolRouter bypass** — `makkari_artifact` inline, PendingAction direct handler call
3. ⚠️ **No RuntimeMessage layer** — QueryEngine would construct provider-specific messages
4. ⚠️ **No TurnState / TurnLimits** — no runtime budget enforcement
5. ⚠️ **MCP stub** — no real transport

### Makkari's Strengths (Do Not Change)

✅ Memory (3-layer, sanitized, RLS-protected)
✅ Capability Truth (disconnected service guidance)
✅ Canonical Event Bus (sequenced, protocol-versioned)
✅ Skills (14 skills, keyword routing, forbidden enforcement)
✅ Output Contract (deterministic framework detection)
✅ Provider Adapters (6 providers, live discovery)
✅ Artifact System (tables + UI + sandbox)
✅ Database Schema (7 migrations + full RLS)
✅ BYOK (AES-256-GCM)

### The Single Most Important Implementation Rule

> **Do not make Makkari bigger first.**
> **Make Makkari's existing intelligence execute through one correct runtime path first.**
>
> `User → TurnState → QueryEngine → Provider → ToolRouter → ToolExecutor → Tool → RuntimeToolResult → QueryEngine → Provider → Final Answer`
>
> Once that path is unified, correct, and tested — everything else is an extension.
