import { SupabaseClient } from '@supabase/supabase-js';

export interface CapabilityExecutionLog {
  id: string;
  userId?: string;
  chatId?: string;
  turnId?: string;
  callId?: string;
  toolId: string;
  source: 'builtin' | 'mcp' | 'custom' | 'provider';
  status: 'started' | 'completed' | 'failed' | 'confirmation_required' | 'blocked' | 'loop_detected';
  durationMs: number;
  confirmationRequired?: boolean;
  confirmationResult?: 'allowed' | 'cancelled' | 'pending';
  errorCode?: string;
  timestamp: string;
}

const memoryAuditLogs: CapabilityExecutionLog[] = [];

/**
 * Records a capability execution event into memory and optionally writes to Supabase tool_execution_logs.
 * Zero secret leakage (no API keys, no tokens recorded).
 */
export function recordCapabilityExecution(
  log: Omit<CapabilityExecutionLog, 'id' | 'timestamp'>,
  supabase?: SupabaseClient | null
): CapabilityExecutionLog {
  const entry: CapabilityExecutionLog = {
    id: `audit-cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...log,
    timestamp: new Date().toISOString(),
  };

  memoryAuditLogs.push(entry);

  // Keep last 500 records in memory
  if (memoryAuditLogs.length > 500) {
    memoryAuditLogs.shift();
  }

  // Asynchronous persistent write to Supabase if client is available
  if (supabase) {
    Promise.resolve(
      supabase.from('tool_execution_logs').insert({
        user_id: log.userId || null,
        chat_id: log.chatId || null,
        turn_id: log.turnId || null,
        call_id: log.callId || entry.id,
        tool_name: log.toolId,
        source: log.source,
        status: log.status,
        duration_ms: log.durationMs,
        confirmation_required: log.confirmationRequired || false,
        confirmation_result: log.confirmationResult || null,
        error_code: log.errorCode || null,
      })
    )
      .then((res: any) => {
        if (res?.error) {
          console.warn('[AUDIT_LOG] Warning persisting tool execution log:', res.error.message);
        }
      })
      .catch((err: any) => {
        console.warn('[AUDIT_LOG] Error persisting tool execution log:', err);
      });
  }


  return entry;
}

export function getRecentCapabilityLogs(limit = 50): CapabilityExecutionLog[] {
  return memoryAuditLogs.slice(-limit).reverse();
}
