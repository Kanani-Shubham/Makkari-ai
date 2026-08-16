-- MAKKARI AI — Phase 1: Foundation Database Migration
-- Production Ready Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------------------------
-- 1. PROFILES TABLE
-------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    preferred_model_id TEXT DEFAULT 'gemini-2.5-flash',
    ai_preferences JSONB DEFAULT '{
        "customInstructions": "",
        "responseStyle": "concise",
        "temperature": 0.7
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-------------------------------------------------------
-- 2. USER SETTINGS TABLE
-------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    appearance JSONB DEFAULT '{
        "theme": "light",
        "fontSize": "medium",
        "reducedMotion": false,
        "compactMode": false
    }'::jsonb NOT NULL,
    model_preferences JSONB DEFAULT '{
        "defaultProvider": "gemini",
        "defaultModel": "gemini-2.5-flash",
        "autoStream": true,
        "temperature": 0.7,
        "maxTokens": 4096
    }'::jsonb NOT NULL,
    storage_preferences JSONB DEFAULT '{
        "autoSave": true,
        "maxHistory": 100
    }'::jsonb NOT NULL,
    privacy_settings JSONB DEFAULT '{
        "analyticsEnabled": false,
        "shareData": false,
        "storeHistory": true
    }'::jsonb NOT NULL,
    developer_mode BOOLEAN DEFAULT FALSE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-------------------------------------------------------
-- 3. USER API KEYS TABLE (BYOK - Encrypted Storage)
-------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'anthropic', 'groq', 'openrouter')),
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    key_hint TEXT NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_provider_key UNIQUE (user_id, provider)
);

-------------------------------------------------------
-- 4. MODEL PROVIDERS TABLE (System Registry)
-------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_providers (
    id TEXT PRIMARY KEY,
    provider_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('local', 'cloud')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'degraded')),
    default_model TEXT NOT NULL,
    enabled_by_default BOOLEAN DEFAULT TRUE NOT NULL,
    supported_models JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-------------------------------------------------------
-- 5. CHATS TABLE
-------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    provider_id TEXT NOT NULL DEFAULT 'gemini',
    model_id TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    system_prompt TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-------------------------------------------------------
-- 6. MESSAGES TABLE
-------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_id TEXT,
    provider_id TEXT,
    token_count JSONB DEFAULT '{"prompt": 0, "completion": 0, "total": 0}'::jsonb NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-------------------------------------------------------
-- INDEXES FOR MAXIMUM PERFORMANCE
-------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON public.user_api_keys(user_id);

-------------------------------------------------------
-- AUTOMATIC UPDATED_AT TRIGGER
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_api_keys_updated_at
    BEFORE UPDATE ON public.user_api_keys
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON public.chats
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-------------------------------------------------------
-- AUTOMATIC PROFILE & SETTINGS CREATION ON SIGNUP
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_name TEXT;
    default_username TEXT;
BEGIN
    default_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
    default_username := SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTRING(NEW.id::text, 1, 6);

    INSERT INTO public.profiles (id, email, full_name, username, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        default_name,
        default_username,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow clean reapplying
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-------------------------------------------------------

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- USER SETTINGS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- USER API KEYS
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api keys" ON public.user_api_keys;
CREATE POLICY "Users can view own api keys"
    ON public.user_api_keys FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own api keys" ON public.user_api_keys;
CREATE POLICY "Users can insert own api keys"
    ON public.user_api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own api keys" ON public.user_api_keys;
CREATE POLICY "Users can update own api keys"
    ON public.user_api_keys FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own api keys" ON public.user_api_keys;
CREATE POLICY "Users can delete own api keys"
    ON public.user_api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- MODEL PROVIDERS (Registry readable by all authenticated users)
ALTER TABLE public.model_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view model providers" ON public.model_providers;
CREATE POLICY "Anyone can view model providers"
    ON public.model_providers FOR SELECT
    USING (true);

-- CHATS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
CREATE POLICY "Users can view own chats"
    ON public.chats FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chats" ON public.chats;
CREATE POLICY "Users can create own chats"
    ON public.chats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
CREATE POLICY "Users can update own chats"
    ON public.chats FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
CREATE POLICY "Users can delete own chats"
    ON public.chats FOR DELETE
    USING (auth.uid() = user_id);

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat messages" ON public.messages;
CREATE POLICY "Users can view own chat messages"
    ON public.messages FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create messages in own chats" ON public.messages;
CREATE POLICY "Users can create messages in own chats"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
    ON public.messages FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
    ON public.messages FOR DELETE
    USING (auth.uid() = user_id);

-------------------------------------------------------
-- SEED MODEL PROVIDERS REGISTRY DATA
-------------------------------------------------------
INSERT INTO public.model_providers (id, provider_key, name, type, status, default_model, enabled_by_default, supported_models)
VALUES
(
    'ollama',
    'ollama',
    'Ollama (Local AI)',
    'local',
    'active',
    'llama3.2',
    true,
    '[
        {"id": "llama3.2", "name": "Llama 3.2", "context": 131072, "tag": "Recommended"},
        {"id": "llama3.1", "name": "Llama 3.1 8B", "context": 131072},
        {"id": "mistral", "name": "Mistral 7B", "context": 32768},
        {"id": "codellama", "name": "CodeLlama 7B", "context": 16384},
        {"id": "deepseek-r1:8b", "name": "DeepSeek R1 8B", "context": 65536, "tag": "Reasoning"}
    ]'::jsonb
),
(
    'gemini',
    'gemini',
    'Google Gemini',
    'cloud',
    'active',
    'gemini-2.5-flash',
    true,
    '[
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "context": 1048576, "tag": "Fast & Smart"},
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "context": 2097152, "tag": "Reasoning & Coding"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "context": 1048576},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "context": 2097152}
    ]'::jsonb
),
(
    'groq',
    'groq',
    'Groq Cloud',
    'cloud',
    'active',
    'llama-3.3-70b-versatile',
    true,
    '[
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile", "context": 128000, "tag": "Ultra Fast"},
        {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "context": 32768},
        {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 Distill 70B", "context": 128000, "tag": "Reasoning"}
    ]'::jsonb
),
(
    'openrouter',
    'openrouter',
    'OpenRouter',
    'cloud',
    'active',
    'anthropic/claude-3.5-sonnet',
    true,
    '[
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "context": 200000, "tag": "Top Pick"},
        {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1", "context": 163840, "tag": "Reasoning"},
        {"id": "openai/gpt-4o", "name": "GPT-4o", "context": 128000},
        {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B", "context": 128000}
    ]'::jsonb
),
(
    'openai',
    'openai',
    'OpenAI',
    'cloud',
    'active',
    'gpt-4o',
    true,
    '[
        {"id": "gpt-4o", "name": "GPT-4o", "context": 128000, "tag": "Flagship"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "context": 128000, "tag": "Fast & Efficient"},
        {"id": "o3-mini", "name": "o3-mini", "context": 200000, "tag": "Reasoning"}
    ]'::jsonb
),
(
    'anthropic',
    'anthropic',
    'Anthropic',
    'cloud',
    'active',
    'claude-3-5-sonnet-latest',
    true,
    '[
        {"id": "claude-3-5-sonnet-latest", "name": "Claude 3.5 Sonnet", "context": 200000, "tag": "Flagship"},
        {"id": "claude-3-5-haiku-latest", "name": "Claude 3.5 Haiku", "context": 200000, "tag": "Fast"},
        {"id": "claude-3-opus-latest", "name": "Claude 3 Opus", "context": 200000, "tag": "Complex Tasks"}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    supported_models = EXCLUDED.supported_models,
    default_model = EXCLUDED.default_model;

-------------------------------------------------------
-- STORAGE BUCKETS & STORAGE RLS POLICIES
-------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
    ('chat-attachments', 'chat-attachments', false, 26214400, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/markdown', 'application/json'])
ON CONFLICT (id) DO NOTHING;

-- Avatars RLS policies
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Users Upload Avatar" ON storage.objects;
CREATE POLICY "Authenticated Users Upload Avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users Update Own Avatar" ON storage.objects;
CREATE POLICY "Users Update Own Avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars' 
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users Delete Own Avatar" ON storage.objects;
CREATE POLICY "Users Delete Own Avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars' 
        AND auth.role() = 'authenticated'
    );

-- Chat Attachments RLS policies
DROP POLICY IF EXISTS "Users Read Own Attachments" ON storage.objects;
CREATE POLICY "Users Read Own Attachments"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'chat-attachments' 
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users Upload Own Attachments" ON storage.objects;
CREATE POLICY "Users Upload Own Attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'chat-attachments' 
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users Delete Own Attachments" ON storage.objects;
CREATE POLICY "Users Delete Own Attachments"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'chat-attachments' 
        AND auth.role() = 'authenticated'
    );
