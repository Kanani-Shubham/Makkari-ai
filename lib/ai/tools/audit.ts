export interface CapabilityExecutionLog {
  id: string;
  userId?: string;
  chatId?: string;
  toolId: string;
  source: 'builtin' | 'mcp' | 'custom' | 'provider';
  status: 'started' | 'completed' | 'failed' | 'confirmation_required' | 'blocked';
  durationMs: number;
  confirmationRequired?: boolean;
  confirmationResult?: 'allowed' | 'cancelled' | 'pending';
  errorCode?: string;
  timestamp: string;
}

const memoryAuditLogs: CapabilityExecutionLog[] = [];

/**
 * Records a capability execution event into audit log (zero secret leakage)
 */
export function recordCapabilityExecution(
  log: Omit<CapabilityExecutionLog, 'id' | 'timestamp'>
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

  return entry;
}

export function getRecentCapabilityLogs(limit = 50): CapabilityExecutionLog[] {
  return memoryAuditLogs.slice(-limit).reverse();
}
