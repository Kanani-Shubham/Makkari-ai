import { ToolInputSchema, ToolPermissionLevel } from '../tools/types';

export type MCPTransportType = 'http' | 'sse' | 'stdio';

export type MCPConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: MCPTransportType;
  authHeader?: string;
  apiKey?: string;
  status: MCPConnectionStatus;
  allowedTools?: string[];
  lastDiscoveredAt?: string;
  errorMessage?: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  serverId: string;
  serverName: string;
  permission: ToolPermissionLevel;
  requiresConfirmation: boolean;
}

export interface MCPDiscoveryResult {
  serverId: string;
  tools: MCPToolDefinition[];
  resources?: any[];
  prompts?: any[];
}
