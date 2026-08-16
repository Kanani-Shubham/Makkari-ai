-- MAKKARI AI — Enhance user_mcp_servers table for Granular OAuth Token Refresh and Scopes Lifecycle
-- Migration: 20260820000000_enhance_user_mcp_servers_oauth.sql

ALTER TABLE user_mcp_servers 
    ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scopes TEXT[],
    ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Index on token_expires_at for background token expiration checks
CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_token_expiry 
    ON user_mcp_servers(token_expires_at) 
    WHERE token_expires_at IS NOT NULL;
