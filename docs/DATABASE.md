# MAKKARI AI — Database Documentation

The Makkari database is built on **Supabase PostgreSQL** with full Row-Level Security (RLS), custom triggers, foreign key constraints, and indexing for ultra-fast queries.

---

## 🗄️ Tables Schema

### 1. `profiles`
Extends Supabase `auth.users`. Contains user profile metadata and preferences.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, FK -> `auth.users(id)` ON DELETE CASCADE | Scoped to auth user ID |
| `email` | TEXT | NOT NULL, UNIQUE | User email address |
| `full_name` | TEXT | NULLABLE | Display name |
| `username` | TEXT | NULLABLE, UNIQUE | Custom handle |
| `avatar_url` | TEXT | NULLABLE | Avatar image URL |
| `theme` | TEXT | DEFAULT 'light' | Interface theme preference |
| `preferred_model_id` | TEXT | DEFAULT 'gemini-2.5-flash' | Default AI model ID |
| `ai_preferences` | JSONB | NOT NULL | Custom system instructions, temperature, style |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Account creation date |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

### 2. `user_settings`
Stores extended user preferences including appearance, storage rules, privacy settings, and developer mode.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique settings ID |
| `user_id` | UUID | UNIQUE, FK -> `profiles(id)` ON DELETE CASCADE | Owner profile ID |
| `appearance` | JSONB | NOT NULL | Theme, font size, reduced motion settings |
| `model_preferences` | JSONB | NOT NULL | Default provider, model, streaming options |
| `storage_preferences` | JSONB | NOT NULL | Auto-save settings, history limits |
| `privacy_settings` | JSONB | NOT NULL | Analytics, data sharing toggles |
| `developer_mode` | BOOLEAN | DEFAULT FALSE | Enables detailed token metrics & raw logs |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

### 3. `user_api_keys`
Secure, AES-256 encrypted storage for cloud AI provider keys. Plaintext keys are NEVER stored.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Key entry ID |
| `user_id` | UUID | FK -> `profiles(id)` ON DELETE CASCADE | Key owner |
| `provider` | TEXT | CHECK IN ('openai', 'gemini', 'anthropic', 'groq', 'openrouter') | AI Provider handle |
| `encrypted_key` | TEXT | NOT NULL | Base64 AES-256-GCM ciphertext |
| `iv` | TEXT | NOT NULL | Base64 initialization vector |
| `key_hint` | TEXT | NOT NULL | Last 4 characters for UI identification |
| `is_valid` | BOOLEAN | DEFAULT TRUE | Connection validation flag |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation date |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update date |

---

### 4. `model_providers`
Public system registry of local (Ollama) and cloud providers and their available model lists.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique provider identifier (`ollama`, `gemini`, etc.) |
| `provider_key` | TEXT | UNIQUE, NOT NULL | Provider key name |
| `name` | TEXT | NOT NULL | Human readable provider name |
| `type` | TEXT | CHECK IN ('local', 'cloud') | Provider deployment type |
| `status` | TEXT | CHECK IN ('active', 'inactive', 'degraded') | Provider operational status |
| `default_model` | TEXT | NOT NULL | Default model string |
| `enabled_by_default` | BOOLEAN | DEFAULT TRUE | System default status |
| `supported_models` | JSONB | NOT NULL | List of model specs and capabilities |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Registration date |

---

### 5. `chats`
Individual conversation threads.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Chat ID |
| `user_id` | UUID | FK -> `profiles(id)` ON DELETE CASCADE | Owner profile ID |
| `title` | TEXT | DEFAULT 'New Conversation' | Chat title |
| `provider_id` | TEXT | DEFAULT 'gemini' | Selected AI provider ID |
| `model_id` | TEXT | DEFAULT 'gemini-2.5-flash' | Selected AI model ID |
| `is_pinned` | BOOLEAN | DEFAULT FALSE | Pinned status in sidebar |
| `is_archived` | BOOLEAN | DEFAULT FALSE | Archived status |
| `system_prompt` | TEXT | NULLABLE | Custom system prompt for chat |
| `metadata` | JSONB | DEFAULT '{}' | Additional context metadata |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last activity timestamp |

---

### 6. `messages`
Individual messages within chats.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Message ID |
| `chat_id` | UUID | FK -> `chats(id)` ON DELETE CASCADE | Parent chat thread |
| `user_id` | UUID | FK -> `profiles(id)` ON DELETE CASCADE | Author user ID |
| `role` | TEXT | CHECK IN ('user', 'assistant', 'system') | Message role |
| `content` | TEXT | NOT NULL | Markdown message content |
| `model_id` | TEXT | NULLABLE | Model used for generation |
| `provider_id` | TEXT | NULLABLE | Provider used for generation |
| `token_count` | JSONB | DEFAULT `{"prompt": 0, "completion": 0, "total": 0}` | Token usage statistics |
| `attachments` | JSONB | DEFAULT '[]' | File attachment references |
| `metadata` | JSONB | DEFAULT '{}' | Additional message metadata |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Generation timestamp |

---

## 🔐 Row Level Security (RLS) Rules

1. **Profiles**: Users can SELECT and UPDATE strictly where `auth.uid() = id`.
2. **User Settings**: Users can SELECT, INSERT, and UPDATE strictly where `auth.uid() = user_id`.
3. **User API Keys**: Users can SELECT, INSERT, UPDATE, and DELETE strictly where `auth.uid() = user_id`.
4. **Chats & Messages**: Full CRUD permissions restricted strictly to owner `auth.uid() = user_id`.
5. **Model Providers**: SELECT permitted for all authenticated users.

---

## ⚡ Performance Indexes

```sql
CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_chats_updated_at ON public.chats(updated_at DESC);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys(user_id);
```
