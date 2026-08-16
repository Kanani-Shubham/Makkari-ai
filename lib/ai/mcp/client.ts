import { MCPServerConfig, MCPDiscoveryResult, MCPToolDefinition } from './types';

export class MCPClient {
  /**
   * Discovers tools from a remote Streamable HTTP MCP server
   */
  public async discoverCapabilities(server: MCPServerConfig): Promise<MCPDiscoveryResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };

    if (server.authHeader) {
      headers['Authorization'] = server.authHeader;
    } else if (server.apiKey) {
      headers['Authorization'] = `Bearer ${server.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(`${server.url}/tools/list`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `disc-${Date.now()}`,
          method: 'tools/list',
          params: {},
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`MCP server returned status ${res.status}`);
      }

      const data = await res.json();
      const rawTools = data.result?.tools || data.tools || [];

      const normalizedTools: MCPToolDefinition[] = rawTools.map((t: any) => ({
        name: t.name,
        description: t.description || `MCP Tool from ${server.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
        serverId: server.id,
        serverName: server.name,
        permission: t.name.startsWith('delete') || t.name.startsWith('remove') ? 'delete' : t.name.startsWith('write') || t.name.startsWith('create') ? 'write' : 'read',
        requiresConfirmation: t.name.startsWith('delete') || t.name.startsWith('remove'),
      }));

      return {
        serverId: server.id,
        tools: normalizedTools,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'MCP connection failed';
      throw new Error(`[MCP_CLIENT] Error connecting to ${server.name} (${server.url}): ${msg}`);
    }
  }

  /**
   * Invokes a tool on the remote MCP server
   */
  public async callTool(
    server: MCPServerConfig,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (server.authHeader) {
      headers['Authorization'] = server.authHeader;
    } else if (server.apiKey) {
      headers['Authorization'] = `Bearer ${server.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(`${server.url}/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `call-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: toolArgs,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`MCP Tool execution failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.result || data;
  }
}

export const mcpClient = new MCPClient();
