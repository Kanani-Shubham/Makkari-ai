import { ToolDefinition } from '../types';
import { executeMemoryTool, MemoryExecutorContext } from '../memory/executor';
import { MemoryToolArgs, MemoryToolOperation } from '../memory/types';

export const makkariMemoryTool: ToolDefinition = {
  id: 'memory',
  name: 'makkari_memory',
  description: 'Makkari Universal Memory Tool. Stores, updates, searches, lists, and removes user preferences and project knowledge.',
  category: 'memory',
  permissions: 'write',
  requiresConfirmation: false,
  enabled: true,
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The memory operation to execute: "remember", "forget", "update", "search", or "list"',
        enum: ['remember', 'forget', 'update', 'search', 'list'],
      },
      content: {
        type: 'string',
        description: 'The factual user preference, project detail, or goal to remember/update',
      },
      type: {
        type: 'string',
        description: 'Memory category',
        enum: ['preference', 'technical_preference', 'project', 'goal', 'workflow', 'profile', 'other'],
      },
      query: {
        type: 'string',
        description: 'Query string for search or forget actions',
      },
      memoryId: {
        type: 'string',
        description: 'Target memory ID for update or explicit deletion',
      },
    },
    required: ['action'],
  },
  handler: async (args, context) => {
    if (!context.supabaseClient || !context.userId) {
      return {
        success: false,
        error: 'Authenticated session is required to access user memory.',
      };
    }

    const execContext: MemoryExecutorContext = {
      supabase: context.supabaseClient,
      userId: context.userId,
      isUserExplicit: false,
      sourceChatId: context.chatId,
    };

    const operation = (args.action || args.operation || 'remember') as MemoryToolOperation;
    const toolArgs: MemoryToolArgs = {
      operation,
      content: args.content,
      type: args.type,
      query: args.query,
      memoryId: args.memoryId,
    };

    const res = await executeMemoryTool(execContext, toolArgs);

    return {
      success: res.success,
      result: res,
      formattedOutput: res.message || JSON.stringify(res),
      actionTaken: res.action,
    };
  },
};
