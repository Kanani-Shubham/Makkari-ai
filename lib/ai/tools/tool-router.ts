import { ToolRegistry } from './registry';
import { ToolCallPayload, ToolExecutionContext, ToolExecutionResult } from './types';
import { recordCapabilityExecution } from './audit';

export interface TurnExecutionBudget {
  totalCalls: number;
  mcpCalls: number;
  startTime: number;
  callHistory: string[];
}

export class ToolRouter {
  private registry: ToolRegistry;
  private MAX_TOOL_CALLS = 10;
  private MAX_MCP_CALLS = 8;
  private MAX_EXECUTION_TIME_MS = 60000;

  constructor(registry = ToolRegistry.getInstance()) {
    this.registry = registry;
  }

  /**
   * Validates and executes a tool call with strict execution budgets, loop detection, and audit logging
   */
  public async executeToolCall(
    call: ToolCallPayload,
    context: ToolExecutionContext,
    budget?: TurnExecutionBudget
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.registry.getTool(call.toolName) || this.registry.getTool(call.toolId);

    // 1. Budget & Loop Checks
    if (budget) {
      // Time limit check
      if (Date.now() - budget.startTime > this.MAX_EXECUTION_TIME_MS) {
        recordCapabilityExecution({
          userId: context.userId,
          chatId: context.chatId,
          toolId: call.toolName,
          source: tool?.source || 'builtin',
          status: 'blocked',
          durationMs: Date.now() - startTime,
          errorCode: 'EXECUTION_TIMEOUT',
        });
        return {
          success: false,
          error: 'Execution time budget exceeded for this turn (max 60s).',
        };
      }

      // Turn count limit
      if (budget.totalCalls >= this.MAX_TOOL_CALLS) {
        recordCapabilityExecution({
          userId: context.userId,
          chatId: context.chatId,
          toolId: call.toolName,
          source: tool?.source || 'builtin',
          status: 'blocked',
          durationMs: Date.now() - startTime,
          errorCode: 'MAX_CALLS_EXCEEDED',
        });
        return {
          success: false,
          error: `Tool execution budget exceeded (max ${this.MAX_TOOL_CALLS} tool calls per turn).`,
        };
      }

      // Loop detection (prevent A -> B -> A -> B repetitive cycles)
      const callSignature = `${call.toolName}:${JSON.stringify(call.arguments || {})}`;
      const duplicateCount = budget.callHistory.filter((c) => c === callSignature).length;
      if (duplicateCount >= 2) {
        recordCapabilityExecution({
          userId: context.userId,
          chatId: context.chatId,
          toolId: call.toolName,
          source: tool?.source || 'builtin',
          status: 'blocked',
          durationMs: Date.now() - startTime,
          errorCode: 'TOOL_LOOP_DETECTED',
        });
        return {
          success: false,
          error: `Recursive loop detected for tool "${call.toolName}". Execution halted to protect system resources.`,
        };
      }

      budget.totalCalls++;
      budget.callHistory.push(callSignature);
      if (tool?.source === 'mcp') {
        if (budget.mcpCalls >= this.MAX_MCP_CALLS) {
          return {
            success: false,
            error: `MCP call budget exceeded (max ${this.MAX_MCP_CALLS} MCP calls per turn).`,
          };
        }
        budget.mcpCalls++;
      }
    }

    // 2. Tool existence check
    if (!tool) {
      recordCapabilityExecution({
        userId: context.userId,
        chatId: context.chatId,
        toolId: call.toolName || call.toolId,
        source: 'builtin',
        status: 'failed',
        durationMs: Date.now() - startTime,
        errorCode: 'TOOL_NOT_FOUND',
      });
      return {
        success: false,
        error: `Tool "${call.toolName || call.toolId}" not found in capability registry.`,
      };
    }

    // 3. Tool enabled check
    if (!tool.enabled) {
      recordCapabilityExecution({
        userId: context.userId,
        chatId: context.chatId,
        toolId: tool.id,
        source: tool.source,
        status: 'blocked',
        durationMs: Date.now() - startTime,
        errorCode: 'TOOL_DISABLED',
      });
      return {
        success: false,
        error: `Tool "${tool.name}" is currently disabled in your Skills & Tools settings.`,
      };
    }

    // 4. Schema validation (required arguments)
    const requiredArgs = tool.inputSchema.required || [];
    for (const req of requiredArgs) {
      if (call.arguments[req] === undefined || call.arguments[req] === null || call.arguments[req] === '') {
        recordCapabilityExecution({
          userId: context.userId,
          chatId: context.chatId,
          toolId: tool.id,
          source: tool.source,
          status: 'failed',
          durationMs: Date.now() - startTime,
          errorCode: 'INVALID_ARGUMENTS',
        });
        return {
          success: false,
          error: `Missing required parameter "${req}" for tool "${tool.name}".`,
        };
      }
    }

    // 5. Confirmation requirement check for destructive / external side effects
    if (tool.requiresConfirmation) {
      recordCapabilityExecution({
        userId: context.userId,
        chatId: context.chatId,
        toolId: tool.id,
        source: tool.source,
        status: 'confirmation_required',
        durationMs: Date.now() - startTime,
        confirmationRequired: true,
        confirmationResult: 'pending',
      });
      return {
        success: false,
        requiresConfirmation: true,
        actionTaken: 'confirmation_required',
        formattedOutput: `Tool "${tool.name}" requires user confirmation before executing.`,
      };
    }

    // 6. Execute tool safely
    try {
      const result = await tool.handler(call.arguments, context);
      const durationMs = Date.now() - startTime;

      recordCapabilityExecution({
        userId: context.userId,
        chatId: context.chatId,
        toolId: tool.id,
        source: tool.source,
        status: result.success ? 'completed' : 'failed',
        durationMs,
        errorCode: result.error ? 'HANDLER_ERROR' : undefined,
      });

      // 7. Untrusted data boundary sanitization
      const outputText = result.formattedOutput || JSON.stringify(result.result || {});
      const boundedOutput = `<tool_result name="${tool.name}">\n${outputText}\n</tool_result>`;

      return {
        ...result,
        formattedOutput: boundedOutput,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown tool execution failure';
      const durationMs = Date.now() - startTime;

      recordCapabilityExecution({
        userId: context.userId,
        chatId: context.chatId,
        toolId: tool.id,
        source: tool.source,
        status: 'failed',
        durationMs,
        errorCode: 'EXECUTION_EXCEPTION',
      });

      console.error(`[TOOL_ROUTER] Error executing ${tool.name}:`, err);
      return {
        success: false,
        error: msg,
        formattedOutput: `<tool_result name="${tool.name}" status="error">\nError: ${msg}\n</tool_result>`,
      };
    }
  }
}

export const toolRouter = new ToolRouter();
