import { MemoryType, MemorySource, UserMemory } from '@/lib/ai/memory/types';

export type MemoryToolOperation = 'remember' | 'forget' | 'update' | 'search' | 'list';

export interface MemoryRememberArgs {
  operation: 'remember';
  content: string;
  type?: MemoryType;
  reason?: string;
  source?: MemorySource;
  sourceChatId?: string | null;
}

export interface MemoryForgetArgs {
  operation: 'forget';
  memoryId?: string;
  query?: string;
}

export interface MemoryUpdateArgs {
  operation: 'update';
  memoryId: string;
  content: string;
  type?: MemoryType;
}

export interface MemorySearchArgs {
  operation: 'search';
  query: string;
  limit?: number;
}

export interface MemoryListArgs {
  operation: 'list';
  limit?: number;
}

export type MemoryToolArgs =
  | MemoryRememberArgs
  | MemoryForgetArgs
  | MemoryUpdateArgs
  | MemorySearchArgs
  | MemoryListArgs;

export type MemoryToolErrorCode =
  | 'MEMORY_DISABLED'
  | 'PERSONALIZATION_DISABLED'
  | 'SENSITIVE_DATA'
  | 'INVALID_CONTENT'
  | 'AMBIGUOUS_MATCH'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'DATABASE_ERROR';

export type MemoryToolAction =
  | 'created'
  | 'updated'
  | 'already_exists'
  | 'deleted'
  | 'cleared'
  | 'found'
  | 'listed'
  | 'ambiguous'
  | 'rejected';

export interface MemoryToolResult {
  success: boolean;
  operation: MemoryToolOperation;
  action?: MemoryToolAction;
  memoryId?: string;
  memory?: UserMemory;
  memories?: UserMemory[];
  count?: number;
  message?: string;
  error?: MemoryToolErrorCode;
  details?: string;
}
