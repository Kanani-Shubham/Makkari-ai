## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` |  Unique |
| `full_name` | `text` |  Nullable |
| `username` | `text` |  Nullable Unique |
| `avatar_url` | `text` |  Nullable |
| `theme` | `text` |  Nullable |
| `preferred_model_id` | `text` |  Nullable |
| `ai_preferences` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `user_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Unique |
| `appearance` | `jsonb` |  |
| `model_preferences` | `jsonb` |  |
| `storage_preferences` | `jsonb` |  |
| `privacy_settings` | `jsonb` |  |
| `developer_mode` | `bool` |  |
| `updated_at` | `timestamptz` |  |

## Table `user_api_keys`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `provider` | `text` |  |
| `encrypted_key` | `text` |  |
| `iv` | `text` |  |
| `key_hint` | `text` |  |
| `is_valid` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `status` | `text` |  Nullable |

## Table `model_providers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `provider_key` | `text` |  Unique |
| `name` | `text` |  |
| `type` | `text` |  |
| `status` | `text` |  |
| `default_model` | `text` |  |
| `enabled_by_default` | `bool` |  |
| `supported_models` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `model_capabilities` | `jsonb` |  Nullable |
| `metadata` | `jsonb` |  Nullable |
| `last_synced_at` | `timestamptz` |  Nullable |
| `last_sync_error` | `text` |  Nullable |
| `discovery_status` | `text` |  Nullable |

## Table `chats`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `title` | `text` |  |
| `provider_id` | `text` |  |
| `model_id` | `text` |  |
| `is_pinned` | `bool` |  |
| `is_archived` | `bool` |  |
| `system_prompt` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `title_generated` | `bool` |  |
| `title_locked` | `bool` |  |
| `pinned_at` | `timestamptz` |  Nullable |
| `pin_order` | `int4` |  Nullable |
| `title_source` | `text` |  Nullable |
| `summary_status` | `text` |  Nullable |
| `summary_updated_at` | `timestamptz` |  Nullable |

## Table `messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `chat_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `content` | `text` |  |
| `model_id` | `text` |  Nullable |
| `provider_id` | `text` |  Nullable |
| `token_count` | `jsonb` |  |
| `attachments` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `user_memory_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Unique |
| `personalization_enabled` | `bool` |  |
| `memory_enabled` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `conversation_summaries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `chat_id` | `uuid` |  Unique |
| `summary` | `text` |  |
| `importance` | `float8` |  |
| `topics` | `_text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `last_used_at` | `timestamptz` |  |

## Table `user_memories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `type` | `text` |  |
| `content` | `text` |  |
| `source` | `text` |  |
| `source_chat_id` | `uuid` |  Nullable |
| `confidence` | `float8` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `last_used_at` | `timestamptz` |  |

## Table `post_chat_jobs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `chat_id` | `uuid` |  |
| `job_type` | `text` |  |
| `status` | `text` |  |
| `attempts` | `int4` |  |
| `max_attempts` | `int4` |  |
| `available_at` | `timestamptz` |  |
| `locked_at` | `timestamptz` |  Nullable |
| `last_error` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `completed_at` | `timestamptz` |  Nullable |

## Table `conversation_artifacts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `chat_id` | `uuid` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `artifact_type` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `artifact_files`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `artifact_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `chat_id` | `uuid` |  |
| `filename` | `text` |  |
| `mime_type` | `text` |  |
| `language` | `text` |  |
| `size_bytes` | `int8` |  |
| `content` | `text` |  |
| `storage_path` | `text` |  Nullable |
| `content_hash` | `text` |  |
| `version` | `int4` |  |
| `is_entry_file` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `message_attachments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `message_id` | `uuid` |  Nullable |
| `chat_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `filename` | `text` |  |
| `mime_type` | `text` |  |
| `size_bytes` | `int8` |  |
| `content` | `text` |  Nullable |
| `storage_path` | `text` |  Nullable |
| `is_pasted` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `tool_execution_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `chat_id` | `text` |  Nullable |
| `turn_id` | `text` |  Nullable |
| `call_id` | `text` |  |
| `tool_name` | `text` |  |
| `source` | `text` |  |
| `status` | `text` |  |
| `duration_ms` | `int4` |  |
| `confirmation_required` | `bool` |  Nullable |
| `confirmation_result` | `text` |  Nullable |
| `error_code` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `pending_actions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `conversation_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `tool` | `text` |  |
| `arguments` | `jsonb` |  |
| `display_arguments` | `jsonb` |  Nullable |
| `status` | `text` |  |
| `execution_id` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `expires_at` | `timestamptz` |  |
| `completed_at` | `timestamptz` |  Nullable |

## Table `user_mcp_servers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `user_id` | `uuid` |  |
| `name` | `text` |  |
| `url` | `text` |  |
| `transport` | `text` |  |
| `encrypted_auth` | `text` |  Nullable |
| `iv` | `text` |  Nullable |
| `auth_type` | `text` |  Nullable |
| `refresh_token_encrypted` | `text` | Nullable |
| `token_expires_at` | `timestamptz` | Nullable |
| `scopes` | `_text` | Nullable |
| `status` | `text` |  |
| `server_info` | `jsonb` |  Nullable |
| `capabilities` | `jsonb` |  Nullable |
| `tool_catalog` | `jsonb` |  Nullable |
| `last_discovered_at` | `timestamptz` |  Nullable |
| `connected_at` | `timestamptz` | Nullable |
| `last_connected_at` | `timestamptz` |  Nullable |
| `last_error` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |


## RLS Policies

### `conversation_artifacts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can delete own conversation artifacts` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can insert own conversation artifacts` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can select own conversation artifacts` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can update own conversation artifacts` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `artifact_files`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can delete own artifact files` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can insert own artifact files` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can select own artifact files` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can update own artifact files` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `message_attachments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can delete own message attachments` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can insert own message attachments` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can select own message attachments` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can update own message attachments` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `model_providers`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Anyone can view model providers` | SELECT | public | PERMISSIVE | `true` | — |

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can update own profile` | UPDATE | public | PERMISSIVE | `(auth.uid() = id)` | — |
| `Users can view own profile` | SELECT | public | PERMISSIVE | `(auth.uid() = id)` | — |

### `user_settings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can insert own settings` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can update own settings` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can view own settings` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `messages`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can create messages in own chats` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can delete own messages` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can update own messages` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can view own chat messages` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `user_api_keys`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can delete own api keys` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can insert own api keys` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can update own api keys` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can view own api keys` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `chats`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can create own chats` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can delete own chats` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can update own chats` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can view own chats` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `user_memory_settings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own memory settings` | ALL | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `conversation_summaries`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can read own conversation summaries` | SELECT | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `user_memories`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own user memories` | ALL | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `post_chat_jobs`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can read own post-chat jobs` | SELECT | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `tool_execution_logs`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can insert their own tool execution logs` | INSERT | public | PERMISSIVE | — | `((auth.uid() = user_id) OR (user_id IS NULL))` |
| `Users can view their own tool execution logs` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `pending_actions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can delete their own pending actions` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can insert their own pending actions` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can update their own pending actions` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can view their own pending actions` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `user_mcp_servers`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can delete their own MCP servers` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can insert their own MCP servers` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `Users can update their own MCP servers` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `Users can view their own MCP servers` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

