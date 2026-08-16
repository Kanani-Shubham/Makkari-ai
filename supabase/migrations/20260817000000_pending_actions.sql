-- Create pending_actions table for multi-turn action confirmations
CREATE TABLE IF NOT EXISTS pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
    display_arguments JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, cancelled, expired
    execution_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_conv_user ON pending_actions(conversation_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires_at ON pending_actions(expires_at);

-- Row Level Security
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending actions"
    ON pending_actions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending actions"
    ON pending_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending actions"
    ON pending_actions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending actions"
    ON pending_actions FOR DELETE
    USING (auth.uid() = user_id);
