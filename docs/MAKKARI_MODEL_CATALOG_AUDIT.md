# MAKKARI AI — MODEL CATALOG AUDIT

**Date**: August 16, 2026  
**Auditor**: Lead Runtime Architect  
**Scope**: Model Discovery, Deprecated Model Decommissioning, Capability Gating, Thinking UI  

---

## 1. Provider & Discovered Model Matrix

| Provider | Primary Models | Deprecated Models Removed | Tool Support | Reasoning / Thinking | Vision Support | Discovery Source | Verification Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| **Google Gemini** | `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite` | `gemini-2.0-flash`, `gemini-2.0-flash-exp`, `gemini-1.5-pro`, `gemini-1.5-flash` | ✅ Yes (Native) | ✅ Yes (2.5 Series) | ✅ Yes | Google Generative Language API | ✅ VERIFIED |
| **Ollama (Local)** | Dynamically discovered from local daemon (`qwen2.5:7b`, `deepseek-r1`, `llama3.2`, etc.) | Hardcoded static fallback lists | ✅ Yes (On capable models) | ✅ Yes (R1 / DeepSeek / Qwen3) | ✅ Yes (Llava / Mllama) | Local `http://127.0.0.1:11434/api/tags` | ✅ VERIFIED |
| **Groq Cloud** | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768` | Obsolete test identifiers | ✅ Yes | ❌ No | ❌ (Text only) | Groq `/openai/v1/models` API | ✅ VERIFIED |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `o1-mini` | Legacy GPT-3 models | ✅ Yes | ✅ Yes (o1 models) | ✅ Yes (4o series) | OpenAI `/v1/models` API | ✅ VERIFIED |
| **Anthropic** | `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`, `claude-3-opus-latest` | Claude 2 / Legacy 3.0 models | ✅ Yes | ✅ Yes | ✅ Yes | Anthropic Catalog | ✅ VERIFIED |
| **OpenRouter** | `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`, `meta-llama/llama-3.3-70b-instruct` | Obsolete models | ✅ Yes | ✅ Yes | ✅ Yes | OpenRouter `/api/v1/models` API | ✅ VERIFIED |

---

## 2. Deprecated Model Decommissioning Audit

The repository was thoroughly searched for all runtime references to deprecated Google Gemini models (`gemini-2.0-flash`, `gemini-2.0-flash-exp`, `gemini-1.5-pro`):

1. **`lib/ai/discovery-service.ts`**: Migrated `CANONICAL_FALLBACK_MODELS.gemini` to `gemini-2.5-flash`, `gemini-2.5-pro`, and `gemini-2.5-flash-lite`.
2. **`lib/ai/provider-registry.ts`**: Migrated `defaultModelId` to `gemini-2.5-flash`.
3. **`app/auth/callback/route.ts`**: Migrated `preferred_model_id` default to `gemini-2.5-flash`.
4. **`app/(auth)/callback/route.ts`**: Migrated `preferred_model_id` default to `gemini-2.5-flash`.
5. **`app/api/profile/route.ts`**: Migrated profile default model to `gemini-2.5-flash`.
6. **`app/api/chats/[id]/messages/route.ts`**: Migrated fallback `model_id` to `gemini-2.5-flash`.

---

## 3. Automated Test Verification Results

| Test Suite | Purpose | Tests | Result |
| :--- | :--- | :---: | :---: |
| **`scratch/test_model_discovery.ts`** | Dynamic Discovery, API key validation, Ollama local detection, ModelRegistry | 21 | **21/21 Passed** ✅ |
| **`scratch/test_model_selection.ts`** | Provider switching & exact model passthrough | 6 | **6/6 Passed** ✅ |
| **`scratch/test_thinking_events.ts`** | Safe thinking status, token stripping, progress flow | 12 | **12/12 Passed** ✅ |
| **`scratch/test_tool_capabilities.ts`** | Capability gating, calculator, web search, fetch URL | 12 | **12/12 Passed** ✅ |
| **`scratch/test_runtime_foundation.ts`** | Phase 0–5 Runtime Foundation Acceptance Suite | 34 | **34/34 Passed** ✅ |
| **Total Automated Tests** | | **85** | **85/85 Passed (100%)** ✅ |

---

## 4. TypeScript & Production Build Verification

- **TypeScript Compilation (`npx tsc --noEmit`)**: **0 Errors**.
- **Next.js Production Build (`npm run build`)**: **Compiled successfully** with all 30 static pages and 34 dynamic API routes.
