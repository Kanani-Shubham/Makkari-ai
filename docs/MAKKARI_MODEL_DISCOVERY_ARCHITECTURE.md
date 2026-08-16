# MAKKARI AI — MODEL DISCOVERY & DYNAMIC REGISTRY ARCHITECTURE

**Specification & Architecture Document**  
**Version**: 1.0  
**Status**: ACTIVE & VERIFIED  

---

## 1. Executive Summary & Core Principle

Makkari AI does not rely on static, hardcoded model arrays that inevitably drift from upstream provider reality. Model discovery is **dynamic**, **credential-validated**, and **locally reactive**.

### The Source of Truth Flow
```text
Provider (Cloud API / Local Runtime)
   │
   ▼
ProviderModelDiscovery Adapter (Gemini / Ollama / Groq / OpenAI / Anthropic / OpenRouter)
   │
   ▼
Dynamic Capabilities Normalization (Text, Vision, Tools, Reasoning, Streaming)
   │
   ▼
Makkari ModelRegistry (Central cache + Invalidation + Credential availability)
   │
   ▼
UI Model Selector / Composer (<ComposerModelPicker />)
   │
   ▼
Chat Stream Request (/api/chat/stream) ──> QueryEngine ──> Exact Model Passthrough
```

---

## 2. Provider Discovery Architecture

### A. Google Gemini Discovery (`GeminiModelDiscovery`)
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
- **Validation**: Filters models supporting `generateContent` and excludes deprecated `gemini-2.0-flash` / `gemini-1.0` endpoints.
- **Flagship Models**:
  - `gemini-2.5-flash`: Fast, multimodal, native function calling.
  - `gemini-2.5-pro`: Deep reasoning, multimodal, complex tasks.
  - `gemini-2.5-flash-lite`: Ultra-fast, cost-effective throughput.
- **Availability Rule**: If API key is missing or unauthorized, models report `availability: "unavailable"` and are disabled in the UI.

### B. Ollama Local Discovery (`OllamaModelDiscovery`)
- **Runtime Endpoint**: `http://127.0.0.1:11434/api/tags` (with fallback to `http://localhost:11434`)
- **Zero Static List**: Only models actually pulled (`ollama pull <model>`) appear in Makkari.
- **Capability Extraction**:
  - `family.includes('qwen2') | family.includes('llama3') | ...` $\rightarrow$ `tools: true`
  - `family.includes('deepseek') | name.includes('r1')` $\rightarrow$ `reasoning: true`
  - `family.includes('vision') | name.includes('llava')` $\rightarrow$ `vision: true`
- **Dynamic Refresh**: Calling `refreshAllModels()` or `scanLocalOllama()` automatically detects newly pulled or removed models without requiring code changes.

### C. Groq Cloud Discovery (`GroqModelDiscovery`)
- **API Endpoint**: `https://api.groq.com/openai/v1/models`
- **Flagship Models**: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`.
- **Tool Support**: Detected on Llama 3.3/3.1 and Mixtral models.

### D. OpenAI Discovery (`OpenAIModelDiscovery`)
- **API Endpoint**: `https://api.openai.com/v1/models`
- **Flagship Models**: `gpt-4o`, `gpt-4o-mini`, `o1-mini`.

### E. Anthropic Discovery (`AnthropicModelDiscovery`)
- **Flagship Models**: `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`, `claude-3-opus-latest`.

### F. OpenRouter Discovery (`OpenRouterModelDiscovery`)
- **API Endpoint**: `https://openrouter.ai/api/v1/models`
- **Curated Filtering**: Focuses on premier models with pricing, architecture, and context window normalization.

---

## 3. Tool Capability Gating

Tools are exposed to the prompt **only** when the selected model supports tool execution:
1. `modelRegistry.getCapabilities(provider, modelId)` evaluates `tools` and `nativeToolCalls`.
2. If `tools === false`, the capability pipeline strictly suppresses `<tool_calling_protocol>` and tool parameter schemas from the system prompt manifest.
3. If `tools === true`, full JSON parameter schemas and `<dots_function_call>` instructions are injected.

---

## 4. Thinking UI & Status Streaming

### Safety Invariants
- **Zero Raw Chain-of-Thought**: Private model thoughts or raw token sequences are never rendered as raw output.
- **Safe Status Flow**:
  - `THINKING_START`
  - `THINKING_STATUS: "Analyzing request & planning response..."`
  - `TOOL_CALL: "Running calculator..."`
  - `TOOL_PROGRESS: "Reading webpage (45%)..."`
  - `TOOL_RESULT: "Processing tool result..."`
  - `THINKING_STATUS: "Preparing final answer..."`
  - `TEXT_DELTA` (Thinking panel automatically collapses on first text chunk).
  - `DONE`

---

## 5. Model Switching & Passthrough Invariant

When the user selects a model in the UI:
1. `useModelStore.setSelectedProvider()` and `setSelectedModel()` update state immediately.
2. `useChatStore.updateChatModel(chatId, provider, model)` persists the choice to the active chat thread.
3. The submit handler directly forwards `provider` and `model` in the request body to `/api/chat/stream`.
4. `TurnState` records `state.model = model`.
5. The Provider Adapter sends the **exact, un-modified model ID** to the upstream API URL/body.
6. If the model is rejected or unavailable, a structured `ERROR` envelope is returned. Silent fallback to another model is strictly prohibited.
