/**
 * MAKKARI AI — Runtime Message Types (Provider-Neutral)
 *
 * ARCHITECTURE CONTRACT:
 * The QueryEngine must NEVER construct provider-specific tool-call or
 * tool-result messages. RuntimeMessage objects remain provider-neutral.
 * Each ProviderAdapter is responsible for converting RuntimeMessage[]
 * into the provider's native format internally.
 *
 * callId is immutable: created once on provider response (or by Makkari
 * if the provider doesn't generate one) and preserved unchanged through:
 *   Provider response → RuntimeToolCall → ToolRouter → ToolExecutor
 *   → TOOL_CALL event → TOOL_RESULT event → RuntimeToolResult
 */

import { ChatAttachment } from '@/lib/ai/types';

// -------------------------------------------------------------
// Tool Call / Result Correlation
// -------------------------------------------------------------

/**
 * A tool call emitted by the model. callId is immutable after creation.
 */
export interface RuntimeToolCall {
  /** Immutable correlation ID — never regenerated after creation. */
  callId: string;
  /** Canonical tool name as registered in ToolRegistry. */
  toolName: string;
  /** Raw arguments from the model (validated by ToolRouter before execution). */
  arguments: Record<string, unknown>;
}

/**
 * The result of a tool execution, keyed by the same callId as its RuntimeToolCall.
 */
export interface RuntimeToolResult {
  /** Same callId as the RuntimeToolCall that triggered this execution. */
  callId: string;
  /** Tool name for audit correlation. */
  toolName: string;
  /** Whether the tool succeeded. */
  success: boolean;
  /**
   * Stringified result content for the model.
   * Always wrapped in <tool_result> boundaries by ToolRouter before this field is set.
   */
  content: string;
  /** Error message if success === false. */
  error?: string;
  /** Whether this result represents an execution error. */
  isError: boolean;
  /** Duration of tool execution in milliseconds. */
  durationMs?: number;
}

// -------------------------------------------------------------
// Runtime Messages (Provider-Neutral)
// -------------------------------------------------------------

export type RuntimeMessage =
  | RuntimeUserMessage
  | RuntimeAssistantMessage
  | RuntimeToolResultMessage;

/**
 * A message from the user. Corresponds to role: 'user' in provider APIs.
 */
export interface RuntimeUserMessage {
  role: 'user';
  content: string;
  attachments?: ChatAttachment[];
}

/**
 * A message from the assistant (model). May contain text, tool calls, or both.
 * Corresponds to role: 'assistant' in provider APIs.
 */
export interface RuntimeAssistantMessage {
  role: 'assistant';
  /** Text content from the model. May be empty string if only tool calls were generated. */
  content: string;
  /** Tool calls requested by the model in this turn. Empty array if none. */
  toolCalls: RuntimeToolCall[];
}

/**
 * A batch of tool results returned to the model.
 * Corresponds to role: 'tool' (OpenAI) / role: 'user' with tool_result blocks (Anthropic) /
 * role: 'function' (Gemini) — conversion is the adapter's responsibility.
 */
export interface RuntimeToolResultMessage {
  role: 'tool_result';
  /** Results for all tool calls in the preceding assistant message. */
  results: RuntimeToolResult[];
}

// -------------------------------------------------------------
// Utility Functions
// -------------------------------------------------------------

/**
 * Generates a unique, stable callId for a tool invocation.
 * Uses crypto.randomUUID() when available; falls back to a time+random hybrid.
 * callId must be generated ONCE per tool call and never regenerated.
 */
export function generateCallId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a RuntimeToolResult representing a tool execution error.
 * The callId is preserved from the original RuntimeToolCall.
 */
export function createErrorToolResult(
  callId: string,
  toolName: string,
  error: string,
  durationMs?: number
): RuntimeToolResult {
  return {
    callId,
    toolName,
    success: false,
    content: `<tool_result tool="${toolName}" status="error">\nError: ${error}\n</tool_result>`,
    error,
    isError: true,
    durationMs,
  };
}

/**
 * Creates a RuntimeToolResult representing a successful tool execution.
 * Expects content to already be boundary-wrapped by ToolRouter.
 */
export function createSuccessToolResult(
  callId: string,
  toolName: string,
  content: string,
  durationMs?: number
): RuntimeToolResult {
  return {
    callId,
    toolName,
    success: true,
    content,
    isError: false,
    durationMs,
  };
}
