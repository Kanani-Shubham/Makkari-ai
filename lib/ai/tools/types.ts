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
  handler: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionContext {
  userId?: string;
  chatId?: string;
  providerId?: string;
  modelId?: string;
  supabaseClient?: any;
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
  callId?: string;
}
