import { SupabaseClient } from '@supabase/supabase-js';
import { ActionRequiredPayload } from '../events/canonical-events';
import { toolRegistry } from '../tools/registry';
import { mcpRegistry } from '../mcp/registry';
import { toolRouter } from '../tools/tool-router';
import { ToolExecutionContext } from '../tools/types';

export interface PendingActionRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  display_arguments?: Record<string, string | number | boolean | null>;
  status: 'pending' | 'executing' | 'completed' | 'cancelled' | 'expired';
  execution_id?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
}

// In-memory fallback cache for development or when Supabase table is not yet migrated
const memoryStore = new Map<string, PendingActionRecord>();

export class PendingActionStore {
  /**
   * Creates a new pending action requiring user confirmation.
   * Real execution arguments are stored server-side only; returns sanitized ActionRequiredPayload.
   */
  public static async createPendingAction(
    supabase: SupabaseClient | null,
    userId: string,
    conversationId: string,
    tool: string,
    args: Record<string, unknown>,
    description: string,
    displayArgs?: Record<string, string | number | boolean | null>
  ): Promise<{ actionId: string; payload: ActionRequiredPayload }> {
    const actionId = `act_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const record: PendingActionRecord = {
      id: actionId,
      conversation_id: conversationId,
      user_id: userId,
      tool,
      arguments: args,
      display_arguments: displayArgs || {},
      status: 'pending',
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    if (supabase) {
      try {
        await supabase.from('pending_actions').insert({
          id: record.id,
          conversation_id: record.conversation_id,
          user_id: record.user_id,
          tool: record.tool,
          arguments: record.arguments,
          display_arguments: record.display_arguments,
          status: record.status,
          created_at: record.created_at,
          expires_at: record.expires_at,
        });
      } catch (err) {
        console.warn('[PENDING_ACTIONS] Supabase insert failed, using memory store:', err);
        memoryStore.set(actionId, record);
      }
    } else {
      memoryStore.set(actionId, record);
    }

    const payload: ActionRequiredPayload = {
      actionId,
      action: tool,
      description,
      requiresConfirmation: true,
      displayArguments: displayArgs,
    };

    return { actionId, payload };
  }

  /**
   * Retrieves the active pending action for a conversation.
   * Checks expiration.
   */
  public static async getActiveActionForConversation(
    supabase: SupabaseClient | null,
    userId: string,
    conversationId: string
  ): Promise<PendingActionRecord | null> {
    let action: PendingActionRecord | null = null;

    if (supabase) {
      try {
        const { data } = await supabase
          .from('pending_actions')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) action = data as PendingActionRecord;
      } catch {
        // Fallback to memory
      }
    }

    if (!action) {
      for (const item of memoryStore.values()) {
        if (item.conversation_id === conversationId && item.user_id === userId && item.status === 'pending') {
          action = item;
          break;
        }
      }
    }

    if (!action) return null;

    // Check expiration
    if (new Date(action.expires_at).getTime() < Date.now()) {
      action.status = 'expired';
      if (supabase) {
        try {
          await supabase.from('pending_actions').update({ status: 'expired' }).eq('id', action.id);
        } catch {}
      }
      return null;
    }

    return action;
  }

  /**
   * Re-evaluates authorization at execution time and executes the pending action
   * through ToolRouter (provides budget, audit, schema validation).
   *
   * SEC-002 / SEC-007 FIX: Replaced stub with real ToolRouter execution.
   * The previous implementation marked the action 'completed' without calling any tool.
   */
  public static async executeAction(
    supabase: SupabaseClient | null,
    userId: string,
    actionId: string,
    executionId: string,
    toolContext: ToolExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    let action: PendingActionRecord | null = null;

    if (supabase) {
      try {
        const { data } = await supabase.from('pending_actions').select('*').eq('id', actionId).single();
        if (data) action = data as PendingActionRecord;
      } catch {}
    }

    if (!action) {
      action = memoryStore.get(actionId) || null;
    }

    if (!action) {
      return { success: false, error: 'Action not found.' };
    }

    if (action.user_id !== userId) {
      return { success: false, error: 'Unauthorized: action belongs to another user.' };
    }

    if (action.status === 'completed') {
      return { success: true, result: { message: 'Action already completed.', idempotencySkipped: true } };
    }

    if (action.status === 'expired' || new Date(action.expires_at).getTime() < Date.now()) {
      return { success: false, error: 'That action has expired. Please request it again.' };
    }

    if (action.status === 'cancelled') {
      return { success: false, error: 'Action was cancelled.' };
    }

    // Execution-time Authorization & Connectivity Re-Check
    if (action.tool.startsWith('mcp.')) {
      const serverId = action.tool.split('.')[1];
      const server = mcpRegistry.getAllServers().find((s) => s.id === serverId || s.id === `${serverId}-mcp`);
      if (!server || server.status !== 'connected') {
        return {
          success: false,
          error: `Cannot execute ${action.tool}: Connected service is currently offline or disconnected.`,
        };
      }
    } else {
      const toolDef = toolRegistry.getTool(action.tool);
      if (toolDef && !toolDef.enabled) {
        return { success: false, error: `Tool ${action.tool} is disabled.` };
      }
    }

    // Mark as executing
    action.status = 'executing';
    action.execution_id = executionId;

    // Execute through ToolRouter — applies budget, schema validation, loop detection, audit
    const callId = executionId;
    const routerResult = await toolRouter.executeToolCall(
      {
        toolId: action.tool,
        toolName: action.tool,
        callId,
        arguments: action.arguments as Record<string, any>,
      },
      toolContext
    );

    const completedNow = new Date().toISOString();

    if (routerResult.success) {
      action.status = 'completed';
      action.completed_at = completedNow;

      if (supabase) {
        try {
          await supabase
            .from('pending_actions')
            .update({
              status: 'completed',
              execution_id: executionId,
              completed_at: completedNow,
            })
            .eq('id', actionId);
        } catch {}
      }

      return {
        success: true,
        result: {
          actionId,
          tool: action.tool,
          executedAt: completedNow,
          summary: routerResult.formattedOutput || `Successfully executed ${action.tool}`,
          output: routerResult.result,
        },
      };
    } else {
      // Execution failed — reset status to pending so user can retry
      action.status = 'pending';

      return {
        success: false,
        error: routerResult.error || `Tool ${action.tool} execution failed.`,
      };
    }
  }
}
