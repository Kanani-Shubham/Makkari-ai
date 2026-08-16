import { ToolInputSchema, ToolPermissionLevel } from '../tools/types';

export type MCPTransportType = 'streamable-http' | 'http' | 'sse' | 'stdio';

export type MCPConnectionStatus =
  | 'disconnected'
  | 'authorizing'
  | 'authenticating'
  | 'initializing'
  | 'discovering_tools'
  | 'connected'
  | 'auth_required'
  | 'auth_expired'
  | 'error'
  | 'connecting'
  | 'unauthorized';



export interface MCPServerInfo {
  name: string;
  version?: string;
  protocolVersion?: string;
  description?: string;
}

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: MCPTransportType;
  authHeader?: string;
  apiKey?: string;
  status: MCPConnectionStatus;
  serverInfo?: MCPServerInfo;
  capabilities?: MCPServerCapabilities;
  toolCatalog?: MCPToolDefinition[];
  allowedTools?: string[];
  lastDiscoveredAt?: string;
  lastConnectedAt?: string;
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
  serverInfo?: MCPServerInfo;
  capabilities?: MCPServerCapabilities;
  tools: MCPToolDefinition[];
}

export interface MCPCallToolResult {
  content?: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface MCPDiagnosticReport {
  serverId: string;
  serverName: string;
  serverUrl: string;
  status: MCPConnectionStatus;
  protocolNegotiated: boolean;
  serverInfo?: MCPServerInfo;
  capabilities?: MCPServerCapabilities;
  discoveredToolsCount: number;
  tools: string[];
  latencyMs?: number;
  error?: string;
}
