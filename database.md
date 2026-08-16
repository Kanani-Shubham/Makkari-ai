# Makkari AI Database & Storage Schema

## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` | Unique |
| `full_name` | `text` | Nullable |
| `username` | `text` | Nullable Unique |
| `avatar_url` | `text` | Nullable |
| `theme` | `text` | Nullable ('light' \| 'dark' \| 'system') |
| `preferred_model_id` | `text` | Nullable |
| `ai_preferences` | `jsonb` | Nullable |
| `created_at` | `timestamptz` | Default now() |
| `updated_at` | `timestamptz` | Default now() |

---

## Table `user_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | Unique (FK -> auth.users.id) |
| `appearance` | `jsonb` | |
| `model_preferences` | `jsonb` | |
| `storage_preferences` | `jsonb` | |
| `privacy_settings` | `jsonb` | |
| `developer_mode` | `bool` | |
| `updated_at` | `timestamptz` | Default now() |

---

## Table `user_memory_settings`

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `uuid` | Primary | |
| `user_id` | `uuid` | Unique (FK -> auth.users.id) | User identifier |
| `personalization_enabled` | `bool` | Default true | Controls prompt context injection |
| `memory_enabled` | `bool` | Default true | Controls memory creation / updates |
| `created_at` | `timestamptz` | Default now() | |
| `updated_at` | `timestamptz` | Default now() | |

---

## Table `conversation_summaries` (Layer 1 — Recent Context)

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `uuid` | Primary | |
| `user_id` | `uuid` | FK -> auth.users.id | |
| `chat_id` | `uuid` | Unique (FK -> public.chats.id) | Source conversation |
| `summary` | `text` | Not Null | 1-2 sentence rolling summary |
| `importance` | `float` | 0.0 .. 1.0 (default 0.8) | Importance weight |
| `topics` | `text[]` | Default '{}' | Extracted topic tags |
| `created_at` | `timestamptz` | Default now() | |
| `updated_at` | `timestamptz` | Default now() | |
| `last_used_at` | `timestamptz` | Default now() | Prompt retrieval timestamp |

---

## Table `user_memories` (Layer 2 — Long-Term Persistent Memory)

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `uuid` | Primary | |
| `user_id` | `uuid` | FK -> auth.users.id | |
| `type` | `text` | 'preference' \| 'profile' \| 'project' \| 'goal' \| 'workflow' \| 'technical_preference' \| 'other' | Category tag |
| `content` | `text` | Not Null | Stable user fact/preference |
| `source` | `text` | 'ai' \| 'user' | Provenance badge |
| `source_chat_id` | `uuid` | Nullable (FK -> public.chats.id) | Optional origin chat |
| `confidence` | `float` | 0.0 .. 1.0 (default 0.9) | Confidence score |
| `created_at` | `timestamptz` | Default now() | |
| `updated_at` | `timestamptz` | Default now() | |
| `last_used_at` | `timestamptz` | Default now() | |

---

## Table `post_chat_jobs` (Durable Server Worker Queue)

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `uuid` | Primary | |
| `user_id` | `uuid` | FK -> auth.users.id | |
| `chat_id` | `uuid` | FK -> public.chats.id | |
| `job_type` | `text` | Default 'post_chat_processing' | Title, Summary & Memory job |
| `status` | `text` | 'pending' \| 'processing' \| 'completed' \| 'failed' | |
| `attempts` | `int` | Default 0 | Retry counter |
| `max_attempts` | `int` | Default 3 | Retry limit |
| `available_at`| `timestamptz`| Default now() | Exponential backoff target |
| `locked_at` | `timestamptz`| Nullable | Worker lease timestamp |
| `last_error` | `text` | Nullable | Error log |
| `created_at` | `timestamptz`| Default now() | |
| `completed_at`| `timestamptz`| Nullable | |

---

## Table `user_api_keys`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | FK -> auth.users.id |
| `provider` | `text` | |
| `encrypted_key` | `text` | AES-256-GCM ciphertext |
| `iv` | `text` | AES-256-GCM IV |
| `key_hint` | `text` | |
| `is_valid` | `bool` | |
| `created_at` | `timestamptz` | Default now() |
| `updated_at` | `timestamptz` | Default now() |
| `status` | `text` | Nullable |

---

## Table `model_providers`

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `text` | Primary | e.g. 'gemini', 'ollama', 'groq' |
| `provider_key` | `text` | Unique | Provider identifier |
| `name` | `text` | | Display name |
| `type` | `text` | | 'local' or 'cloud' |
| `status` | `text` | | Provider status |
| `default_model` | `text` | | Default model ID |
| `enabled_by_default`| `bool` | | |
| `supported_models` | `jsonb` | | Cached discovered models |
| `model_capabilities`| `jsonb` | | Dynamic capabilities map |
| `metadata` | `jsonb` | | Provider metadata |
| `last_synced_at` | `timestamptz`| | Discovery timestamp |
| `last_sync_error` | `text` | | Last discovery error |
| `discovery_status` | `text` | | 'active' \| 'degraded' \| 'offline' |
| `created_at` | `timestamptz`| | |

---

## Table `chats`

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `uuid` | Primary | |
| `user_id` | `uuid` | FK -> auth.users.id | |
| `title` | `text` | | Conversation title |
| `title_source` | `text` | 'auto' \| 'user' | Manual title protection |
| `provider_id` | `text` | | Active provider |
| `model_id` | `text` | | Discovered provider model ID |
| `pinned_at` | `timestamptz` | Nullable | **Canonical Pin State** (`pinned_at IS NOT NULL`) |
| `pin_order` | `int` | Default 0 | Custom pin order |
| `is_pinned` | `bool` | Default false | Legacy compatibility column |
| `is_archived` | `bool` | Default false | |
| `summary_status`| `text` | 'pending' \| 'processing' \| 'completed' \| 'failed' | Post-chat status |
| `summary_updated_at`| `timestamptz`| Nullable | |
| `system_prompt` | `text` | Nullable | |
| `metadata` | `jsonb` | | |
| `created_at` | `timestamptz` | Default now() | |
| `updated_at` | `timestamptz` | Default now() | |
| `title_generated`| `bool` | | |
| `title_locked` | `bool` | | |

---

## Table `messages`

### Columns

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | `uuid` | Primary | |
| `chat_id` | `uuid` | FK -> public.chats.id | |
| `user_id` | `uuid` | FK -> auth.users.id | |
| `role` | `text` | 'user' \| 'assistant' \| 'system' | |
| `content` | `text` | Markdown text | |
| `model_id` | `text` | Nullable | Model ID used |
| `provider_id` | `text` | Nullable | Provider ID used |
| `token_count` | `jsonb` | Token metrics | |
| `attachments` | `jsonb` | `ChatAttachment[]` metadata | Storage path: `${user.id}/chats/${chatId}/${attachmentId}` |
| `metadata` | `jsonb` | Reasoning & timing | `{ reasoning: { available: bool, summary: string, durationMs: number, provider: string } }` |
| `created_at` | `timestamptz` | Default now() | |

---

## RPC Functions

### `toggle_chat_pin(p_chat_id uuid, p_pin boolean) -> jsonb`
- **Description**: Atomically pins or unpins a chat for the authenticated user.
- **Concurrency**: Employs `pg_advisory_xact_lock(hashtext(auth.uid()::text))` inside transaction to prevent concurrent race conditions from exceeding the 10-pin maximum limit.
- **Returns**: `{ "success": true, "pinned": true, "chat_id": "..." }` or `{ "success": false, "error": "MAX_PINS_REACHED", "message": "Maximum 10 pinned chats reached. Unpin a chat to pin another." }`.

---

## Storage Buckets

### Bucket `chat-attachments` (Private)
- **File size limit**: 25 MB (`26214400` bytes)
- **Path format**: `${user.id}/chats/${chatId}/${attachmentId}` (UUID isolated)
- **Access**: Short-lived signed URLs (1-hour validity)
- **Policy**: `Users can manage own attachments` restricted to `(storage.foldername(name))[1] = auth.uid()::text`

### Bucket `avatars` (Public)
- **File size limit**: 5 MB (`5242880` bytes)
- **Path format**: `${user.id}/avatar.${ext}`
- **Access**: Public URL
