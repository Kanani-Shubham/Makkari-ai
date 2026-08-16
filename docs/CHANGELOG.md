# CHANGELOG — MAKKARI AI

All notable changes to Phase 1 of Makkari will be documented in this file.

---

## [1.0.0-phase1] - 2026-07-23

### Added
- **Core Architecture & Setup**: Next.js 15 App Router foundation with TypeScript, TailwindCSS, Zustand state stores, and Framer Motion micro-animations.
- **Claude Warm Design System**: Theme implementation with `#F7F6F3` background, `#D97757` terracotta primary accent, soft borders `#E8E5E0`, and Apple + Claude inspired aesthetics.
- **Supabase Backend**: Complete PostgreSQL database schema with auto-triggers for profiles and settings, production RLS security rules, performance indexes, and seed metadata.
- **BYOK Encryption Engine**: Web Crypto AES-256-GCM encryption for cloud provider API keys (Gemini, Groq, OpenRouter, OpenAI, Anthropic). Plaintext keys are never stored.
- **Local Ollama AI Support**: Dynamic model discovery and SSE streaming with local Ollama instance (`http://localhost:11434`).
- **Streaming Chat System**: Real-time response streaming, Markdown rendering, syntax highlighted code blocks, message copying, regeneration, deletion, stopping, and auto-scroll.
- **Model Hub**: Interactive UI to switch default provider/models, test API key connections, and configure local and cloud model status.
- **Storage Buckets**: RLS-secured Supabase storage buckets for user `avatars` and `chat-attachments`.
- **Responsive Layout**: Desktop sidebar drawer and mobile navigation inspired directly by Claude mobile wireframe UI.
- **Documentation Suite**: Comprehensive guides in `docs/` covering Architecture, Database, Supabase Setup, Storage Buckets, API, Implementation Plan, and Changelog.
