-- MAKKARI AI — User MCP Servers and Connection State Schema (Fully Idempotent)
CREATE TABLE IF NOT EXISTS user_mcp_servers (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    transport TEXT NOT NULL DEFAULT 'streamable-http',
    encrypted_auth TEXT,
    iv TEXT,
    auth_type TEXT DEFAULT 'bearer',
    status TEXT NOT NULL DEFAULT 'disconnected',
    server_info JSONB DEFAULT '{}'::jsonb,
    capabilities JSONB DEFAULT '{}'::jsonb,
    tool_catalog JSONB DEFAULT '[]'::jsonb,
    last_discovered_at TIMESTAMPTZ,
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure primary key / unique constraint on (user_id, id) exists safely
DO $$
BEGIN
    -- Drop any old conflicting single-column primary key or unique key
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_mcp_servers_user_id_id_key' 
        AND conrelid = 'user_mcp_servers'::regclass
    ) THEN
        ALTER TABLE user_mcp_servers DROP CONSTRAINT user_mcp_servers_user_id_id_key;
    END IF;

    -- Add unique constraint for (user_id, id) to support Supabase ON CONFLICT (user_id, id)
    ALTER TABLE user_mcp_servers ADD CONSTRAINT user_mcp_servers_user_id_id_key UNIQUE (user_id, id);
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_user ON user_mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_status ON user_mcp_servers(status);

-- Enable Row Level Security (RLS)
ALTER TABLE user_mcp_servers ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies: Drop existing policies before creating to avoid 42710 errors
DROP POLICY IF EXISTS "Users can view their own MCP servers" ON user_mcp_servers;
CREATE POLICY "Users can view their own MCP servers"
    ON user_mcp_servers FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own MCP servers" ON user_mcp_servers;
CREATE POLICY "Users can insert their own MCP servers"
    ON user_mcp_servers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own MCP servers" ON user_mcp_servers;
CREATE POLICY "Users can update their own MCP servers"
    ON user_mcp_servers FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own MCP servers" ON user_mcp_servers;
CREATE POLICY "Users can delete their own MCP servers"
    ON user_mcp_servers FOR DELETE
    USING (auth.uid() = user_id);
