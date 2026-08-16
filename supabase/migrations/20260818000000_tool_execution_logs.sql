-- Create tool_execution_logs table for auditability and capability observability
CREATE TABLE IF NOT EXISTS tool_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    chat_id TEXT,
    turn_id TEXT,
    call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'builtin', -- builtin, mcp, custom, provider
    status TEXT NOT NULL, -- started, completed, failed, confirmation_required, blocked, loop_detected
    duration_ms INTEGER NOT NULL DEFAULT 0,
    confirmation_required BOOLEAN DEFAULT FALSE,
    confirmation_result TEXT, -- allowed, cancelled, pending
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_user_chat ON tool_execution_logs(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_call_id ON tool_execution_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_created_at ON tool_execution_logs(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE tool_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tool execution logs"
    ON tool_execution_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tool execution logs"
    ON tool_execution_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
