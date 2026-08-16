/**
 * MAKKARI AI - Runtime Types
 * Shared error types, runtime status codes, and utility interfaces.
 */

// Tool Execution Mode (for future parallel optimization)
export type ToolExecutionMode =
  | 'read_only'
  | 'write'
  | 'destructive'
  | 'external_action';

// Runtime Error Codes
export type RuntimeErrorCode =
  | 'BUDGET_MAX_ITERATIONS'
  | 'BUDGET_MAX_TOOL_CALLS'
  | 'BUDGET_MAX_MCP_CALLS'
  | 'BUDGET_MAX_DURATION'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_DISABLED'
  | 'TOOL_INVALID_ARGUMENTS'
  | 'TOOL_LOOP_DETECTED'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_REQUIRES_CONFIRMATION'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_EMPTY_RESPONSE'
  | 'CANCELLATION'
  | 'CONTEXT_LIMIT'
  | 'UNKNOWN';

export class RuntimeError extends Error {
  public readonly code: RuntimeErrorCode;
  public readonly retryable: boolean;
  public readonly toolName?: string;
  public readonly callId?: string;

  constructor(options: {
    code: RuntimeErrorCode;
    message: string;
    retryable?: boolean;
    toolName?: string;
    callId?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'RuntimeError';
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.toolName = options.toolName;
    this.callId = options.callId;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export interface QueryEngineResult {
  status: 'completed' | 'cancelled' | 'failed' | 'budget_exceeded';
  iterations: number;
  toolCallsExecuted: number;
  durationMs: number;
  error?: RuntimeError;
  budgetReason?: string;
}

export interface ProviderRuntimeCapabilities {
  nativeToolCalls: boolean;
  toolResultsInMessages: boolean;
  streaming: boolean;
  vision: boolean;
  abortSignal: boolean;
  structuredOutput: boolean;
  notes?: string;
}
