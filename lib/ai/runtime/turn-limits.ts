/**
 * MAKKARI AI — TurnLimits (Configurable Budget Constraints)
 *
 * ARCHITECTURE CONTRACT:
 * TurnLimits are resolved ONCE at turn start via resolveTurnLimits().
 * The QueryEngine reads from TurnState.limits — it NEVER hardcodes budget values.
 * This enables future tiering (free/pro/long-task/MCP-async) without
 * changing the QueryEngine implementation.
 */

import { MakkariModel } from '@/lib/ai/types';

// -------------------------------------------------------------
// TurnLimits Interface
// -------------------------------------------------------------

export interface TurnLimits {
  /** Maximum tool-loop iterations before forced termination. Default: 8. */
  maxIterations: number;
  /** Maximum total tool executions per turn. Default: 10. */
  maxToolCalls: number;
  /** Maximum MCP tool executions per turn. Default: 8. */
  maxMcpCalls: number;
  /** Maximum wall-clock duration for the entire turn in milliseconds. Default: 60_000. */
  maxDurationMs: number;
  /**
   * Maximum tokens the model may generate per turn.
   * undefined = use provider default.
   */
  maxOutputTokens?: number;
}

// -------------------------------------------------------------
// Execution Budget (runtime snapshot of remaining budget)
// -------------------------------------------------------------

/**
 * A mutable snapshot of remaining budget for a turn.
 * Created from TurnLimits and updated as the turn progresses.
 */
export interface ExecutionBudget {
  /** Remaining tool-loop iterations. */
  iterationsRemaining: number;
  /** Remaining tool executions this turn. */
  toolCallsRemaining: number;
  /** Remaining MCP tool executions this turn. */
  mcpCallsRemaining: number;
  /** Turn start time (Unix ms) for wall-clock enforcement. */
  startedAt: number;
  /** Maximum wall-clock duration for this turn. */
  maxDurationMs: number;
  /** Call signature history for loop detection. */
  callHistory: string[];
}

// -------------------------------------------------------------
// Resolution Function
// -------------------------------------------------------------

/**
 * Resolves TurnLimits for a given model, user, and environment.
 *
 * Phase 3 implementation: returns sensible defaults for all users.
 * Future phases: implement tiered limits (free / pro / enterprise / long-task).
 *
 * IMPORTANT: The QueryEngine must always call this function — never hardcode limits.
 */
export function resolveTurnLimits(
  _model: MakkariModel | null,
  _userId: string | undefined,
  environment: 'development' | 'production' = 'production'
): TurnLimits {
  // Development environment: more generous limits for testing
  if (environment === 'development') {
    return {
      maxIterations: 12,
      maxToolCalls: 15,
      maxMcpCalls: 10,
      maxDurationMs: 120_000, // 2 minutes for dev
    };
  }

  // Phase 3 production defaults
  // Future: switch on user tier, model context window, etc.
  return {
    maxIterations: 8,
    maxToolCalls: 10,
    maxMcpCalls: 8,
    maxDurationMs: 60_000, // 60 seconds
  };

  // Future tier examples (not implemented yet):
  // Pro tier:         { maxIterations: 12, maxToolCalls: 20, maxDurationMs: 120_000 }
  // Long-task tier:   { maxIterations: 20, maxToolCalls: 40, maxDurationMs: 300_000 }
  // MCP async:        delegate to background job system
}

/**
 * Creates a fresh ExecutionBudget from TurnLimits.
 * Call once at the start of a turn.
 */
export function createExecutionBudget(limits: TurnLimits): ExecutionBudget {
  return {
    iterationsRemaining: limits.maxIterations,
    toolCallsRemaining: limits.maxToolCalls,
    mcpCallsRemaining: limits.maxMcpCalls,
    startedAt: Date.now(),
    maxDurationMs: limits.maxDurationMs,
    callHistory: [],
  };
}

/**
 * Checks whether the execution budget has been exceeded.
 * Returns the reason for exhaustion, or null if budget is still available.
 */
export function checkBudgetExhausted(budget: ExecutionBudget): string | null {
  if (budget.iterationsRemaining <= 0) {
    return 'MAX_ITERATIONS: Maximum tool-loop iterations reached.';
  }
  if (budget.toolCallsRemaining <= 0) {
    return 'MAX_TOOL_CALLS: Maximum tool calls per turn reached.';
  }
  if (Date.now() - budget.startedAt > budget.maxDurationMs) {
    return `MAX_DURATION: Turn exceeded ${budget.maxDurationMs}ms time limit.`;
  }
  return null;
}
