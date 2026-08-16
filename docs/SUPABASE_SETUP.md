# MAKKARI AI — Supabase Setup Guide

This guide details setting up Supabase Auth, PostgreSQL, Storage Buckets, and Row-Level Security for Makkari.

---

## 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://database.new) and create a new project named **Makkari AI**.
2. Note down your **Project URL**, **Anon Key**, and **Service Role Key** from `Project Settings -> API`.

---

## 2. Configure Environment Variables

Create `.env.local` in your root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
ENCRYPTION_SECRET=32_character_long_secret_key_string!
NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434
```

---

## 3. Run Database Migrations

1. Navigate to **SQL Editor** in your Supabase Dashboard.
2. Open the migration file: `supabase/migrations/20260723000000_phase1_foundation.sql`.
3. Copy the entire SQL content and execute it in the SQL Editor.
4. Verify that tables (`profiles`, `user_settings`, `user_api_keys`, `model_providers`, `chats`, `messages`) and storage buckets (`avatars`, `chat-attachments`) are created with active RLS.

---

## 4. Configure Authentication Providers

1. Go to **Authentication -> Providers** in Supabase Dashboard.
2. Enable **Email/Password**:
   - Confirm Email: Enabled or Disabled according to preference.
3. Enable **Google OAuth** (optional for production):
   - Add Client ID and Client Secret from Google Cloud Console.
   - Set Redirect URI to `https://<your-project-id>.supabase.co/auth/v1/callback`.
4. Enable **GitHub OAuth** (optional for production):
   - Add Client ID and Client Secret from GitHub Developer Settings.

---

## 5. Verify Storage Buckets

1. Navigate to **Storage** in Supabase Dashboard.
2. Confirm two buckets exist:
   - `avatars` (Public bucket, max 5MB, JPG/PNG/WebP allowed)
   - `chat-attachments` (Private bucket, max 25MB)
