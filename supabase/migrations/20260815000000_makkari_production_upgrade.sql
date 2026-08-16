-- =============================================================
-- MAKKARI AI: PRODUCTION UPGRADE MIGRATION
-- Migration: 20260815000000_makkari_production_upgrade.sql
-- =============================================================

-- 1. Extend public.model_providers with dynamic discovery metadata
ALTER TABLE IF EXISTS public.model_providers
  ADD COLUMN IF NOT EXISTS model_capabilities jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_sync_error text,
  ADD COLUMN IF NOT EXISTS discovery_status text DEFAULT 'active';

-- 2. Extend public.messages with structured attachments and metadata if missing
ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Storage bucket setup for chat-attachments with UUID isolation
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  26214400, -- 25 MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json',
    'text/javascript', 'text/typescript', 'text/html', 'text/css'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400;

-- 4. Storage RLS Policies
-- Users can only upload and read files within their own folder prefix (${auth.uid()}/...)
CREATE POLICY "Users can manage own attachments"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
