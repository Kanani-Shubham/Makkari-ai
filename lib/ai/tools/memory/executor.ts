import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryToolArgs, MemoryToolResult } from './types';
import {
  getUserMemorySettings,
  sanitizeMemoryContent,
  listUserMemories,
  updateUserMemory,
  deleteUserMemory,
  searchUserMemories,
  resolveMemoryConflict,
  forgetMemoryByQuery,
} from '@/lib/ai/memory/memory-service';

export interface MemoryExecutorContext {
  supabase: SupabaseClient;
  userId: string;
  isUserExplicit?: boolean;
  sourceChatId?: string | null;
}

/**
 * Makkari AI — Universal Memory Tool Executor
 * Server-authoritative executor enforcing permissions, sanitization, and conflict resolution.
 */
const SENSITIVE_PATTERNS = [
  /\bsk-[a-zA-Z0-9_-]{20,}\b/i,
  /\bgh[pousr]_[a-zA-Z0-9]{20,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z-_]{35}\b/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  /\b(?:password|passwd|api_key|apikey|secret_key|private_key)\s*[:=]\s*[^\s]+/i,
  /\bsecret\s+key\b/i,
  /\bapi\s+key\s+is\b/i,
  /\bpassword\s+is\b/i,
  /\[REDACTED_/i,
];

export function containsSensitiveData(text: string): boolean {
  if (!text) return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export async function executeMemoryTool(
  context: MemoryExecutorContext,
  args: MemoryToolArgs
): Promise<MemoryToolResult> {
  const { supabase, userId, isUserExplicit = false, sourceChatId } = context;
  const operation = args.operation;

  try {
    const settings = await getUserMemorySettings(supabase, userId);

    // 1. Check Memory Disabled Guard for write operations
    if (operation === 'remember' && !settings.memory_enabled) {
      return {
        success: false,
        operation: 'remember',
        error: 'MEMORY_DISABLED',
        message: 'Memory is currently turned off in Personalization & Memory settings. You can enable it to save memories.',
      };
    }

    // 2. Execute requested operation
    switch (operation) {
      case 'remember': {
        const rawContent = args.content?.trim();
        if (!rawContent) {
          return {
            success: false,
            operation: 'remember',
            error: 'INVALID_CONTENT',
            message: 'Memory content cannot be empty.',
          };
        }

        // Sensitive credential check — strictly reject API keys, passwords, secrets
        if (containsSensitiveData(rawContent)) {
          return {
            success: false,
            operation: 'remember',
            error: 'SENSITIVE_DATA',
            message: 'Sensitive credentials, API keys, passwords, or tokens cannot be saved to memory.',
          };
        }

        const sanitized = sanitizeMemoryContent(rawContent);
        if (!sanitized || containsSensitiveData(sanitized)) {
          return {
            success: false,
            operation: 'remember',
            error: 'SENSITIVE_DATA',
            message: 'Sensitive credentials, API keys, passwords, or tokens cannot be saved to memory.',
          };
        }

        const type = args.type || 'other';
        const result = await resolveMemoryConflict(
          supabase,
          userId,
          type,
          sanitized,
          isUserExplicit,
          sourceChatId
        );

        return {
          success: true,
          operation: 'remember',
          action: result.action,
          memoryId: result.memory.id,
          memory: result.memory,
          message:
            result.action === 'already_exists'
              ? `Memory already exists: "${result.memory.content}"`
              : result.action === 'updated'
              ? `Updated existing memory: "${result.memory.content}"`
              : `Saved new memory: "${result.memory.content}"`,
        };
      }

      case 'forget': {
        if (args.memoryId) {
          await deleteUserMemory(supabase, userId, args.memoryId);
          return {
            success: true,
            operation: 'forget',
            action: 'deleted',
            memoryId: args.memoryId,
            message: 'Memory successfully deleted.',
          };
        }

        if (args.query) {
          const forgetResult = await forgetMemoryByQuery(supabase, userId, args.query);

          if (forgetResult.isAmbiguous) {
            return {
              success: false,
              operation: 'forget',
              error: 'AMBIGUOUS_MATCH',
              action: 'ambiguous',
              memories: forgetResult.ambiguousCandidates,
              message: `Multiple matching memories found for "${args.query}". Please clarify which specific memory to forget.`,
            };
          }

          if (forgetResult.deletedCount === 0) {
            return {
              success: false,
              operation: 'forget',
              error: 'NOT_FOUND',
              message: `No saved memories found matching "${args.query}".`,
            };
          }

          return {
            success: true,
            operation: 'forget',
            action: 'deleted',
            count: forgetResult.deletedCount,
            memories: forgetResult.deletedMemories,
            message: `Removed memory matching "${args.query}".`,
          };
        }

        return {
          success: false,
          operation: 'forget',
          error: 'INVALID_CONTENT',
          message: 'Either memoryId or query must be provided to forget a memory.',
        };
      }

      case 'update': {
        if (!args.memoryId || !args.content) {
          return {
            success: false,
            operation: 'update',
            error: 'INVALID_CONTENT',
            message: 'Both memoryId and content are required for update.',
          };
        }

        const sanitized = sanitizeMemoryContent(args.content);
        if (!sanitized) {
          return {
            success: false,
            operation: 'update',
            error: 'SENSITIVE_DATA',
            message: 'Cannot update memory with sensitive credentials.',
          };
        }

        const updated = await updateUserMemory(supabase, userId, args.memoryId, sanitized);
        return {
          success: true,
          operation: 'update',
          action: 'updated',
          memoryId: updated.id,
          memory: updated,
          message: `Memory updated: "${updated.content}"`,
        };
      }

      case 'search': {
        const query = args.query?.trim() || '';
        const limit = args.limit || 5;
        const matches = await searchUserMemories(supabase, userId, query, limit);

        return {
          success: true,
          operation: 'search',
          action: 'found',
          count: matches.length,
          memories: matches,
          message: `Found ${matches.length} matching memory item(s).`,
        };
      }

      case 'list': {
        const limit = args.limit || 20;
        const allMemories = await listUserMemories(supabase, userId);
        const sliced = allMemories.slice(0, limit);

        return {
          success: true,
          operation: 'list',
          action: 'listed',
          count: sliced.length,
          memories: sliced,
          message: `Retrieved ${sliced.length} saved memory item(s).`,
        };
      }

      default:
        return {
          success: false,
          operation: operation as any,
          error: 'INVALID_CONTENT',
          message: `Unknown operation: ${operation}`,
        };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown database error';
    console.error('[MEMORY_EXECUTOR] Execution error:', errorMsg);

    return {
      success: false,
      operation,
      error: 'DATABASE_ERROR',
      message: 'Failed to process memory operation.',
      details: errorMsg,
    };
  }
}
