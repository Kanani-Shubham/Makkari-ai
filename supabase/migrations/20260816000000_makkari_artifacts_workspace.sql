-- ==============================================================================
-- Migration: 20260816000000_makkari_artifacts_workspace.sql
-- Description: Makkari AI Artifacts, Files, Attachments & Multi-file Workspace
-- ==============================================================================

-- 1. Table: public.conversation_artifacts
CREATE TABLE IF NOT EXISTS public.conversation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  artifact_type TEXT NOT NULL DEFAULT 'code',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: public.artifact_files
CREATE TABLE IF NOT EXISTS public.artifact_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES public.conversation_artifacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'plaintext',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  content_hash TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_entry_file BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: public.message_attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content TEXT,
  storage_path TEXT,
  is_pasted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes for high performance lookup
CREATE INDEX IF NOT EXISTS idx_conv_artifacts_user_chat ON public.conversation_artifacts (user_id, chat_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_files_artifact_id ON public.artifact_files (artifact_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_files_user_chat ON public.artifact_files (user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_artifact_files_content_hash ON public.artifact_files (content_hash);
CREATE INDEX IF NOT EXISTS idx_message_attachments_chat_id ON public.message_attachments (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_attachments_user_id ON public.message_attachments (user_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.conversation_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- 6. Granular RLS Policies for conversation_artifacts
CREATE POLICY "Users can select own conversation artifacts"
  ON public.conversation_artifacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation artifacts"
  ON public.conversation_artifacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation artifacts"
  ON public.conversation_artifacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversation artifacts"
  ON public.conversation_artifacts FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Granular RLS Policies for artifact_files
CREATE POLICY "Users can select own artifact files"
  ON public.artifact_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own artifact files"
  ON public.artifact_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own artifact files"
  ON public.artifact_files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own artifact files"
  ON public.artifact_files FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Granular RLS Policies for message_attachments
CREATE POLICY "Users can select own message attachments"
  ON public.message_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own message attachments"
  ON public.message_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own message attachments"
  ON public.message_attachments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own message attachments"
  ON public.message_attachments FOR DELETE
  USING (auth.uid() = user_id);
