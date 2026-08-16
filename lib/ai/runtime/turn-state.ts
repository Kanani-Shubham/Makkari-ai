/**
 * MAKKARI AI - TurnState (Runtime State Model)
 *
 * TurnState is the single source of truth for a turn's execution.
 * Created before the QueryEngine starts; carried through every step.
 */

import { MakkariModel, ChatMessage } from '@/lib/ai/types';
import { TurnLimits, ExecutionBudget, createExecutionBudget, resolveTurnLimits } from './turn-limits';

// Phase 3 note: messages typed as ChatMessage[] (existing provider format).
// Phase 4: migrate to RuntimeMessage[] with ProviderNormalizer layer.
// RuntimeToolCall tracked separately in activeToolCalls.
export interface RuntimeToolCall {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}


export type TurnStatus =
  | 'initializing'
  | 'generating'
  | 'executing_tools'
  | 'waiting_confirmation'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'budget_exceeded';

export interface TurnState {
  // Identity
  turnId: string;
  conversationId: string;
  userId: string | undefined;

  // Messages (ChatMessage[] in Phase 3; migrates to RuntimeMessage[] in Phase 4)
  messages: ChatMessage[];


  // Iteration tracking
  iteration: number;
  toolCallsThisTurn: number;
  mcpCallsThisTurn: number;

  // Budget
  limits: TurnLimits;
  budget: ExecutionBudget;

  // Timing
  startedAt: number;

  // Status
  status: TurnStatus;

  // Active tool tracking
  activeToolCalls: RuntimeToolCall[];

  // Context
  estimatedTokens?: number;
  maxTokens?: number;
  compactionApplied?: boolean;

  // Cancellation
  abortController: AbortController;
}

export function createTurnState(options: {
  conversationId: string;
  userId: string | undefined;
  initialMessages: ChatMessage[];
  model: MakkariModel | null;
  abortController: AbortController;
  environment?: 'development' | 'production';
}): TurnState {
  const { conversationId, userId, initialMessages, model, abortController, environment } = options;
  const limits = resolveTurnLimits(model, userId, environment ?? 'production');
  const budget = createExecutionBudget(limits);
  const now = Date.now();
  return {
    turnId: generateTurnId(),
    conversationId,
    userId,
    messages: [...initialMessages],
    iteration: 0,
    toolCallsThisTurn: 0,
    mcpCallsThisTurn: 0,
    limits,
    budget,
    startedAt: now,
    status: 'initializing',
    activeToolCalls: [],
    abortController,
  };
}

function generateTurnId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `turn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isTurnCancelled(state: TurnState): boolean {
  return state.abortController.signal.aborted || state.status === 'cancelled';
}

export function isTurnTerminal(state: TurnState): boolean {
  return (
    state.status === 'completed' ||
    state.status === 'cancelled' ||
    state.status === 'failed' ||
    state.status === 'budget_exceeded'
  );
}
