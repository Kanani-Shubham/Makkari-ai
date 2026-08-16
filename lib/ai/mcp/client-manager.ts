import {
  MCPServerConfig,
  MCPToolDefinition,
  MCPDiscoveryResult,
  MCPDiagnosticReport,
  MCPCallToolResult,
} from './types';
import { ToolDefinition } from '../tools/types';
import { toolRegistry } from '../tools/registry';
import { mcpRegistry } from './registry';


export class McpClientManager {
  private static instance: McpClientManager;
  private activeServers: Map<string, MCPServerConfig> = new Map();
  private catalogCache: Map<string, { tools: MCPToolDefinition[]; timestamp: number }> = new Map();
  private CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

  private constructor() {}

  public static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Builds headers with secure authentication
   */
  private buildHeaders(server: MCPServerConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };

    if (server.authHeader) {
      headers['Authorization'] = server.authHeader;
    } else if (server.apiKey) {
      headers['Authorization'] = `Bearer ${server.apiKey}`;
    }

    return headers;
  }

  /**
   * Establishes real MCP connection via Protocol Handshake (initialize -> capabilities -> tools/list)
   */
  public async connect(server: MCPServerConfig): Promise<MCPDiscoveryResult> {
    console.log(`[MCP_CONNECT_START] server="${server.name}" url="${server.url}" transport="${server.transport}"`);

    const headers = this.buildHeaders(server);
    if (headers['Authorization']) {
      console.log(`[MCP_AUTH] Server="${server.name}" using configured authorization credentials`);
    } else {
      console.log(`[MCP_AUTH] Server="${server.name}" connecting without auth credentials`);
    }

    console.log(`[MCP_TRANSPORT] Transport="${server.transport || 'streamable-http'}"`);

    const timeoutMs = 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 1. Send JSON-RPC 2.0 'initialize' handshake
      const initUrl = `${server.url.replace(/\/$/, '')}/initialize`;
      const initFallbackUrl = server.url;

      let initData: any = null;

      let initResStatus = 0;
      try {
        const initRes = await fetch(initUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `init-${Date.now()}`,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {
                roots: { listChanged: true },
                sampling: {},
              },
              clientInfo: {
                name: 'Makkari-AI',
                version: '1.0.0',
              },
            },
          }),
          signal: controller.signal,
        });

        initResStatus = initRes.status;
        if (initRes.ok) {
          initData = await initRes.json().catch(() => null);
        }
      } catch {
        // Try fallback root endpoint
      }

      // If dedicated /initialize failed or was 404, send to base endpoint
      if (!initData) {
        const baseRes = await fetch(initFallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `init-${Date.now()}`,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {
                roots: { listChanged: true },
                sampling: {},
              },
              clientInfo: {
                name: 'Makkari-AI',
                version: '1.0.0',
              },
            },
          }),
          signal: controller.signal,
        });

        if (initResStatus === 401 || baseRes.status === 401) {
          server.status = 'auth_required';
          server.errorMessage = `Authentication required for ${server.name}. Please connect your account.`;
          console.log(`[MCP_AUTH] Server="${server.name}" status=auth_required`);
          throw new Error(`[MCP_AUTH_REQUIRED] Authentication required for ${server.name}`);
        }

        if (!baseRes.ok && baseRes.status !== 404 && baseRes.status !== 405) {
          throw new Error(`MCP initialize handshake failed with HTTP status ${baseRes.status}`);
        }

        if (baseRes.ok) {
          initData = await baseRes.json().catch(() => null);
        }
      }


      const serverInfo = {
        name: initData?.result?.serverInfo?.name || server.name,
        version: initData?.result?.serverInfo?.version || '1.0.0',
        protocolVersion: initData?.result?.protocolVersion || initData?.result?.serverInfo?.protocolVersion || '2024-11-05',
      };
      const capabilities = initData?.result?.capabilities || { tools: {} };

      console.log(
        `[MCP_INITIALIZE] Server="${server.name}" Handshake OK. ProtocolVersion="${serverInfo.protocolVersion}"`
      );


      // 2. Discover Tools via 'tools/list'
      const toolsListUrl = `${server.url.replace(/\/$/, '')}/tools/list`;
      let toolsData: any = null;

      try {
        const tRes = await fetch(toolsListUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `list-${Date.now()}`,
            method: 'tools/list',
            params: {},
          }),
          signal: controller.signal,
        });

        if (tRes.ok) {
          toolsData = await tRes.json().catch(() => null);
        }
      } catch {}

      if (!toolsData) {
        const tBaseRes = await fetch(server.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `list-${Date.now()}`,
            method: 'tools/list',
            params: {},
          }),
          signal: controller.signal,
        });

        if (!tBaseRes.ok) {
          throw new Error(`MCP tools/list failed with HTTP status ${tBaseRes.status}`);
        }

        toolsData = await tBaseRes.json();
      }

      const rawTools = toolsData?.result?.tools || toolsData?.tools || [];
      console.log(`[MCP_TOOLS_LIST] Server="${server.name}" returned ${rawTools.length} tools`);

      // 3. Normalize discovered tools
      const normalizedTools: MCPToolDefinition[] = rawTools.map((t: any) => {
        const isDelete = /^(delete|remove|destroy|drop)/i.test(t.name);
        const isWrite = /^(create|write|update|modify|generate|export|post|patch)/i.test(t.name);

        console.log(`[MCP_TOOL_DISCOVERED] Server="${server.name}" tool="${t.name}"`);

        return {
          name: t.name,
          description: t.description || `MCP Tool from ${server.name}`,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
          serverId: server.id,
          serverName: server.name,
          permission: isDelete ? 'delete' : isWrite ? 'write' : 'read',
          requiresConfirmation: isDelete,
        };
      });

      // 4. Update memory state & register into ToolRegistry
      server.status = 'connected';
      server.serverInfo = serverInfo;
      server.capabilities = capabilities;
      server.toolCatalog = normalizedTools;
      server.lastConnectedAt = new Date().toISOString();
      server.lastDiscoveredAt = new Date().toISOString();
      server.errorMessage = undefined;

      this.activeServers.set(server.id, server);
      this.catalogCache.set(server.id, {
        tools: normalizedTools,
        timestamp: Date.now(),
      });

      this.registerToolsInMakkariRegistry(server, normalizedTools);
      mcpRegistry.addServer(server);

      console.log(`[MCP_CONNECTION_STATUS] Server="${server.name}" status="connected" totalTools=${normalizedTools.length}`);


      return {
        serverId: server.id,
        serverInfo,
        capabilities,
        tools: normalizedTools,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown connection error';
      console.error(`[MCP_ERROR] Server="${server.name}" connection failed: ${msg}`);
      if (server.status !== 'auth_required') {
        server.status = 'error';
      }
      server.errorMessage = msg;
      throw new Error(`[MCP_CONNECT_ERROR] ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }


  /**
   * Registers discovered MCP tools into the central Makkari ToolRegistry
   */
  public registerToolsInMakkariRegistry(server: MCPServerConfig, tools: MCPToolDefinition[]) {
    for (const mcpTool of tools) {
      const canonicalId = `mcp:${server.id}:${mcpTool.name}`;
      const prefixedName = `mcp_${server.id}_${mcpTool.name}`;
      const shortName = mcpTool.name;

      const toolDef: ToolDefinition = {
        id: canonicalId,
        name: shortName,
        description: mcpTool.description,
        category: 'mcp',
        inputSchema: mcpTool.inputSchema,
        permissions: mcpTool.permission,
        requiresConfirmation: mcpTool.requiresConfirmation,
        enabled: true,
        source: 'mcp',
        handler: async (args: Record<string, any>) => {
          return this.callTool(server, mcpTool.name, args);
        },
      };

      // Register under both canonical and short name in ToolRegistry
      toolRegistry.registerTool(toolDef);
      // Also alias with prefixed name
      toolRegistry.registerTool({
        ...toolDef,
        name: prefixedName,
      });
    }
  }

  /**
   * Unregisters MCP tools from ToolRegistry upon disconnection
   */
  public unregisterToolsFromRegistry(server: MCPServerConfig) {
    const cached = this.catalogCache.get(server.id)?.tools || server.toolCatalog || [];
    for (const t of cached) {
      toolRegistry.unregisterTool(`mcp:${server.id}:${t.name}`);
      toolRegistry.unregisterTool(`mcp_${server.id}_${t.name}`);
      toolRegistry.unregisterTool(t.name);
    }
  }

  /**
   * Executes a tool on the remote MCP server via JSON-RPC 2.0 'tools/call'
   */
  public async callTool(
    server: MCPServerConfig,
    toolName: string,
    toolArgs: Record<string, any>,
    timeoutMs = 15000
  ): Promise<{ success: boolean; result?: any; error?: string; formattedOutput?: string }> {
    console.log(`[MCP_CALL] Server="${server.name}" method="tools/call" tool="${toolName}"`);

    const headers = this.buildHeaders(server);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const callUrl = `${server.url.replace(/\/$/, '')}/tools/call`;
      let callRes = await fetch(callUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `call-${Date.now()}`,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolArgs || {},
          },
        }),
        signal: controller.signal,
      });

      if (!callRes.ok) {
        // Try root endpoint fallback
        callRes = await fetch(server.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `call-${Date.now()}`,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: toolArgs || {},
            },
          }),
          signal: controller.signal,
        });
      }

      if (!callRes.ok) {
        if (callRes.status === 401) {
          server.status = 'auth_expired';
          server.errorMessage = `Authentication token for ${server.name} has expired. Please re-authenticate in Settings.`;
          console.log(`[MCP_TOKEN_EXPIRED] Server="${server.name}" status=auth_expired`);
          return {
            success: false,
            error: 'Authentication token expired',
            formattedOutput: `<tool_result name="${toolName}" status="error">\nError: Authentication token expired. Please re-authenticate ${server.name} in Settings → Skills & Tools.\n</tool_result>`,
          };
        }
        throw new Error(`MCP remote tool call returned HTTP status ${callRes.status}`);
      }


      const data: MCPCallToolResult = await callRes.json();

      if (data.isError) {
        const errMsg = JSON.stringify(data.content || 'MCP Tool reported error');
        console.error(`[MCP_RESULT] Server="${server.name}" tool="${toolName}" status="error":`, errMsg);
        return {
          success: false,
          error: errMsg,
          formattedOutput: `<tool_result name="${toolName}" status="error">\nError: ${errMsg}\n</tool_result>`,
        };
      }

      const content = data.content || (data as any).result?.content || data;
      console.log(`[MCP_RESULT] Server="${server.name}" tool="${toolName}" status="success"`);

      const formattedOutput =
        typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);

      return {
        success: true,
        result: content,
        formattedOutput: `<tool_result name="${toolName}">\n${formattedOutput}\n</tool_result>`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'MCP execution failure';
      console.error(`[MCP_ERROR] Server="${server.name}" tool="${toolName}" failed: ${msg}`);
      return {
        success: false,
        error: msg,
        formattedOutput: `<tool_result name="${toolName}" status="error">\nError: ${msg}\n</tool_result>`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Disconnects an MCP server and unregisters its tools
   */
  public disconnect(server: MCPServerConfig): void {
    console.log(`[MCP_DISCONNECT] Server="${server.name}" status="disconnected"`);
    server.status = 'disconnected';
    this.unregisterToolsFromRegistry(server);
    this.catalogCache.delete(server.id);
    this.activeServers.delete(server.id);
  }

  /**
   * Runs end-to-end non-mutating health check test
   */
  public async testConnection(server: MCPServerConfig): Promise<MCPDiagnosticReport> {
    const startTime = Date.now();
    try {
      const discovery = await this.connect(server);
      return {
        serverId: server.id,
        serverName: server.name,
        serverUrl: server.url,
        status: 'connected',
        protocolNegotiated: true,
        serverInfo: discovery.serverInfo,
        capabilities: discovery.capabilities,
        discoveredToolsCount: discovery.tools.length,
        tools: discovery.tools.map((t) => t.name),
        latencyMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      return {
        serverId: server.id,
        serverName: server.name,
        serverUrl: server.url,
        status: 'error',
        protocolNegotiated: false,
        discoveredToolsCount: 0,
        tools: [],
        latencyMs: Date.now() - startTime,
        error: msg,
      };
    }
  }

  public getActiveServer(serverId: string): MCPServerConfig | undefined {
    return this.activeServers.get(serverId);
  }

  public getAllActiveServers(): MCPServerConfig[] {
    return Array.from(this.activeServers.values());
  }
}

export const mcpClientManager = McpClientManager.getInstance();
