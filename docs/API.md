# MAKKARI AI — API Documentation

Makkari implements serverless API routes using Next.js 15 App Router endpoints for streaming, key encryption/validation, and Ollama integration.

---

## 📡 API Endpoints

### 1. `POST /api/chat/stream`
Proxies AI generation streaming requests to selected local (Ollama) or cloud (Gemini, Groq, OpenRouter, OpenAI, Anthropic) models.

#### Request Body
```json
{
  "providerId": "gemini",
  "modelId": "gemini-2.5-flash",
  "messages": [
    { "role": "user", "content": "Explain quantum computing in simple terms." }
  ],
  "systemPrompt": "You are Makkari AI...",
  "temperature": 0.7
}
```

#### Response
- `Content-Type`: `text/event-stream`
- Streaming Server-Sent Events (SSE) emitting chunks in real time.

---

### 2. `POST /api/keys/validate`
Validates an API key against a cloud provider without persisting it.

#### Request Body
```json
{
  "provider": "openai",
  "apiKey": "sk-proj-..."
}
```

#### Response
```json
{
  "valid": true,
  "provider": "openai",
  "keyHint": "...a1b2",
  "message": "Key successfully validated"
}
```

---

### 3. `GET /api/ollama/tags`
Discovers locally installed models running on the user's local Ollama instance (`http://localhost:11434`).

#### Response
```json
{
  "online": true,
  "models": [
    { "id": "llama3.2", "name": "Llama 3.2", "size": "2.0GB" },
    { "id": "deepseek-r1:8b", "name": "DeepSeek R1 8B", "size": "4.9GB" }
  ]
}
```
