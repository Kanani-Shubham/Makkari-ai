import { ToolExecutionMode } from '@/lib/ai/runtime/runtime-types';

export type ToolCategory =
  | 'memory'
  | 'search'
  | 'computation'
  | 'web'
  | 'coding'
  | 'mcp'
  | 'custom';


export type ToolPermissionLevel = 'read' | 'write' | 'delete' | 'external_action';

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: ToolInputSchema;
  outputSchema?: ToolInputSchema;
  permissions: ToolPermissionLevel;
  requiresConfirmation: boolean;
  enabled: boolean;
  skillId?: string;
  source: 'builtin' | 'mcp' | 'custom' | 'provider';
  /**
   * Execution mode for Phase 4+ parallel scheduling.
   * Phase 3: All tools execute SERIALLY regardless of this value.
   * Phase 4+: read_only tools with independentExecution=true may run in parallel.
   * Default: 'write' (safe assumption when unknown).
   */
  executionMode?: ToolExecutionMode;
  /**
   * Whether this tool's execution is independent of other concurrent tool calls.
   * Only relevant when executionMode === 'read_only'.
   * Phase 3: Ignored.
   */
  independentExecution?: boolean;
  handler: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionContext {
  userId?: string;
  chatId?: string;
  turnId?: string;
  callId?: string;
  providerId?: string;
  modelId?: string;
  supabaseClient?: any;
  /** Optional callback for long-running tools to report intermediate progress (0.0 to 1.0) and status */
  onProgress?: (progress?: number, message?: string) => void;
}


export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  formattedOutput?: string;
  actionTaken?: string;
  requiresConfirmation?: boolean;
}

export interface ToolCallPayload {
  toolId: string;
  toolName: string;
  arguments: Record<string, any>;
  /** Immutable correlation ID — must be set before ToolRouter is called. Never regenerated. */
  callId: string;
}
