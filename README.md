# MAKKARI AI

> **Next-Generation High-Performance AI Workspace & Unified Multi-Model Canvas**

Makkari AI is a modern, responsive, and intelligent AI chat & canvas workspace built with Next.js App Router, Supabase, and Tailwind CSS. It supports multiple AI providers (Gemini, Groq, OpenRouter, OpenAI, Anthropic, Ollama), live artifact rendering, event-driven reasoning, memory persistence, and tool integrations.

---

## ✨ Key Features

- **Multi-Model & Multi-Provider Ecosystem**: Seamlessly switch between Gemini 2.0, Groq, OpenRouter, OpenAI, Anthropic, and local Ollama instances.
- **Capability & Tool Truth Layer**: Absolute runtime verification ensuring the model never hallucinates unavailable tools or fake reasoning.
- **Interactive Artifact Workspace**: Live sandboxed HTML/CSS/JS preview, code editing, multi-viewport testing (Desktop, Tablet, Mobile), file downloads, and ZIP packaging.
- **Canonical Event Bus**: Monotonically ordered, strongly-typed server-sent event streaming architecture with zero XML/protocol leakage.
- **Event-Driven ThinkingPanel**: Real-time reasoning visualization that automatically collapses on meaningful text output.
- **Intelligent Chat Auto-Scroll**: Non-intrusive viewport management with floating "New response" indicator.
- **Long-Term Memory & Personalization**: Automatic extraction and storage of user facts, preferences, and conversation summaries via Supabase.
- **Security-Hardened Sandboxing**: Strict CSP headers (`connect-src 'none'`) and origin isolation for safe execution of AI-generated web apps.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- Supabase account or local instance
- API key for at least one AI provider (Groq, Google Gemini, OpenRouter, etc.)

### 1. Clone the repository

```bash
git clone https://github.com/Kanani-Shubham/Makkari-ai.git
cd Makkari-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials and provider API keys in `.env.local`.

### 4. Run database migrations

Apply SQL files from `supabase/migrations/` to your Supabase project.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🧪 Testing & Verification

Run the master test suite containing 12 automated regression suites:

```bash
npx tsx scratch/run_all_tests.ts
```

Run TypeScript compilation check:

```bash
npx tsc --noEmit
```

Build for production:

```bash
npm run build
```

---

## 🛡️ License

MIT License. Built by [Kanani-Shubham](https://github.com/Kanani-Shubham).
