# Makkari AI — Provider Runtime Capability Matrix
## Phase 4 Audit
**Date:** 2026-08-16 | **Scope:** 6 provider adapters

---

## Capability Matrix

| Capability | Gemini | OpenAI | Anthropic | Groq | OpenRouter | Ollama |
|---|---|---|---|---|---|---|
| **Text streaming** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Text tool protocol** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Native tool calls** | ⚠️ Stub | ⚠️ Stub | ⚠️ Stub | ⚠️ Stub | ⚠️ Stub | ❌ |
| **Tool results in messages** | Via text | Via text | Via text | Via text | Via text | Via text |
| **AbortSignal** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vision (image input)** | ✅ | ✅ | ✅ | ⚠️ Model-dep | ✅ | ⚠️ Model-dep |
| **Reasoning/thinking** | ✅ gemini-2.5 | ✅ o1/o3 | ✅ claude-3.7 | ❌ | ⚠️ Model-dep | ❌ |
| **Structured output** | ✅ | ✅ | ❌ | ⚠️ Partial | ⚠️ Partial | ⚠️ Model-dep |
| **Error normalization** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Key:** ✅ Verified · ⚠️ Partial/model-dependent · ❌ Not supported

---

## Tool Protocol Strategy (Phase 3)

All 6 providers use the **text tool protocol** — model emits `<dots_function_call>` XML tags
in the text stream, parsed by `StatefulToolProtocolParser`. This is consistent and working.

**Native tool calls** (structured `tool_calls` JSON): not yet wired in the adapters. The
`ChatChunk.type === 'tool_call'` variant exists in the type union but no adapter emits it.
Phase 4.5+: wire native tool calls for providers that support them.

---

## Tool Result Message Format (Phase 3 vs Future)

**Phase 3 (current):** Tool results appended as a `role: 'user'` message containing
`<tool_result>` XML. This works across all providers without format negotiation.

**Phase 5+ (future):** Provider-native formats:
- **OpenAI**: `role: 'tool'` messages with `tool_call_id`
- **Anthropic**: `role: 'user'` with `content: [{ type: 'tool_result', tool_use_id }]`
- **Gemini**: `role: 'function'` with `functionResponse` parts
- **Groq**: Same as OpenAI (OpenAI-compatible)
- **OpenRouter**: Passes through to underlying model's native format

---

## AbortSignal (Phase 0.5 audit result)

All 6 adapters wire `abortSignal` to their underlying `fetch()` calls. ✅

The signal is also checked in the stream loop before each chunk:
```typescript
if (abortSignal?.aborted) return;
```

Phase 3 addition: `TurnState.abortController.signal` is also checked at every loop
iteration and before each tool execution.

---

## Provider-Specific Notes

### Gemini
- Uses `@google/generative-ai` SDK
- Supports `reasoningEffort` via thinking config
- Vision via `inlineData` parts
- Rate limits: Gemini 1.5 Flash = 1500 req/min free tier

### OpenAI
- Uses `fetch()` to `api.openai.com/v1/chat/completions`
- o1/o3 models require `max_completion_tokens` not `max_tokens`
- Vision via `image_url` content parts

### Anthropic
- Uses `fetch()` to `api.anthropic.com/v1/messages`
- Tool results require `user` role with `tool_result` blocks — NOT a `tool` role
- Extended thinking via `thinking.budget_tokens`

### Groq
- OpenAI-compatible API
- Tool calls only on certain models (llama-3.3-70b-versatile, mixtral-8x7b)
- Lower rate limits than OpenAI

### OpenRouter
- Routes to underlying models — capabilities depend on selected model
- Returns model-specific errors

### Ollama
- Local execution — no API key required
- Tool call support model-dependent (llama3, qwen2.5, mistral support it)
- No AbortSignal in underlying `ollama` package call for streamed responses (workaround in adapter: polls signal)

---

## Phase 4 Normalizer Status

A `lib/ai/providers/normalizer.ts` stub has been created to house future provider
normalization logic. Current Phase 3 approach (text protocol + user-role tool results)
is consistent and requires no normalization.

Full normalization (RuntimeMessage → provider-native format) scheduled for Phase 4.5.

---

## Recommended Phase 4.5 Work (after Phase 5)

1. Wire native tool calls for OpenAI + Groq (structured `tool_calls` JSON)
2. Wire Anthropic tool_result blocks
3. Wire Gemini functionResponse parts
4. Create provider capability detection at startup
5. Route to text protocol as fallback for unsupported models
