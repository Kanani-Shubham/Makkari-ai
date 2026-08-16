-- =============================================================
-- MAKKARI AI: MEMORY, PERSONALIZATION & POST-CHAT JOBS MIGRATION
-- Migration: 20260815010000_makkari_memory_personalization.sql
-- =============================================================

-- 1. User Memory Settings Table
CREATE TABLE IF NOT EXISTS public.user_memory_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  personalization_enabled boolean DEFAULT true NOT NULL,
  memory_enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Conversation Summaries (Layer 1 — Recent Context)
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE UNIQUE NOT NULL,
  summary text NOT NULL,
  importance float DEFAULT 0.8 NOT NULL CHECK (importance >= 0.0 AND importance <= 1.0),
  topics text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_used_at timestamptz DEFAULT now() NOT NULL
);

-- 3. User Memories (Layer 2 — Long-Term Persistent Memory)
CREATE TABLE IF NOT EXISTS public.user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('preference', 'profile', 'project', 'goal', 'workflow', 'technical_preference', 'other')),
  content text NOT NULL,
  source text DEFAULT 'ai' NOT NULL CHECK (source IN ('ai', 'user')),
  source_chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL,
  confidence float DEFAULT 0.9 NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_used_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Durable Post-Chat Job Queue with Idempotency
CREATE TABLE IF NOT EXISTS public.post_chat_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  job_type text DEFAULT 'post_chat_processing' NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts int DEFAULT 0 NOT NULL,
  max_attempts int DEFAULT 3 NOT NULL,
  available_at timestamptz DEFAULT now() NOT NULL,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

-- Partial unique index for post-chat job idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_chat_jobs_dedup 
  ON public.post_chat_jobs(chat_id) 
  WHERE status IN ('pending', 'processing');

-- 5. Extend Chats Table for Pinning, Title Ownership & Summary Tracking
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_order int DEFAULT 0 CHECK (pin_order >= 0),
  ADD COLUMN IF NOT EXISTS title_source text DEFAULT 'auto' CHECK (title_source IN ('auto', 'user')),
  ADD COLUMN IF NOT EXISTS summary_status text DEFAULT 'pending' CHECK (summary_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;

-- Safe legacy is_pinned reconciliation (Preserves at most 10 pinned chats per user)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chats' AND column_name = 'is_pinned'
  ) THEN
    WITH ranked_legacy_pins AS (
      SELECT id, user_id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) as rnk
      FROM public.chats
      WHERE is_pinned = true
    )
    UPDATE public.chats c
    SET pinned_at = CASE WHEN r.rnk <= 10 THEN now() ELSE NULL END,
        is_pinned = CASE WHEN r.rnk <= 10 THEN true ELSE false END
    FROM ranked_legacy_pins r
    WHERE c.id = r.id;
  END IF;
END $$;

-- 6. Partial & Performance Indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_pinned ON public.chats(user_id, pin_order) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conv_summaries_user_updated ON public.conversation_summaries(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_updated ON public.user_memories(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_chat_jobs_claim ON public.post_chat_jobs(status, available_at) WHERE status = 'pending';

-- 7. Expression-based Multilingual/Technical Full-Text Search (GIN Indexes)
CREATE INDEX IF NOT EXISTS idx_messages_fts_simple ON public.messages USING gin(to_tsvector('simple', coalesce(content, '')));
CREATE INDEX IF NOT EXISTS idx_chats_fts_simple ON public.chats USING gin(to_tsvector('simple', coalesce(title, '')));

-- 8. Atomic Chat Pin RPC Function with Transaction Lock
CREATE OR REPLACE FUNCTION public.toggle_chat_pin(p_chat_id uuid, p_pin boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Acquire per-user transaction advisory lock to serialize concurrent pin operations
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Verify chat ownership
  IF NOT EXISTS (SELECT 1 FROM public.chats WHERE id = p_chat_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Chat not found or unauthorized';
  END IF;

  IF p_pin THEN
    SELECT count(*) INTO v_current_count
    FROM public.chats
    WHERE user_id = v_user_id AND pinned_at IS NOT NULL;

    IF v_current_count >= 10 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'MAX_PINS_REACHED', 
        'message', 'Maximum 10 pinned chats reached. Unpin a chat to pin another.'
      );
    END IF;

    UPDATE public.chats
    SET pinned_at = now(),
        is_pinned = true,
        updated_at = now()
    WHERE id = p_chat_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'pinned', true, 'chat_id', p_chat_id);
  ELSE
    UPDATE public.chats
    SET pinned_at = NULL,
        is_pinned = false,
        updated_at = now()
    WHERE id = p_chat_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'pinned', false, 'chat_id', p_chat_id);
  END IF;
END;
$$;

-- 9. Truly Idempotent RLS Policies
ALTER TABLE public.user_memory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_chat_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own memory settings" ON public.user_memory_settings;
CREATE POLICY "Users can manage own memory settings"
  ON public.user_memory_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Conversation summaries: read-only for client, server service manages writes
DROP POLICY IF EXISTS "Users can read own conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Users can read own conversation summaries"
  ON public.conversation_summaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- User memories: client can view, insert, edit, and delete own memories
DROP POLICY IF EXISTS "Users can manage own user memories" ON public.user_memories;
CREATE POLICY "Users can manage own user memories"
  ON public.user_memories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Post-chat jobs: user can read own job status
DROP POLICY IF EXISTS "Users can read own post-chat jobs" ON public.post_chat_jobs;
CREATE POLICY "Users can read own post-chat jobs"
  ON public.post_chat_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
