import { MCPServerConfig, MCPToolDefinition } from './types';
import { mcpClient } from './client';
import { ToolDefinition } from '../tools/types';
import { toolRegistry } from '../tools/registry';

interface ServerCacheEntry {
  tools: MCPToolDefinition[];
  timestamp: number;
}

export class MCPRegistry {
  private static instance: MCPRegistry;
  private servers: Map<string, MCPServerConfig> = new Map();
  private catalogCache: Map<string, ServerCacheEntry> = new Map();
  private CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cacheable tool catalog

  private constructor() {
    this.registerSampleServers();
  }

  public static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  private registerSampleServers() {
    // Register standard MCP integration templates
    this.addServer({
      id: 'canva-mcp',
      name: 'Canva MCP',
      url: 'https://mcp.canva.com/v1',
      transport: 'http',
      status: 'disconnected',
      allowedTools: ['create_design', 'generate_presentation', 'export_asset'],
    });

    this.addServer({
      id: 'github-mcp',
      name: 'GitHub MCP',
      url: 'https://api.githubcopilot.com/mcp',
      transport: 'http',
      status: 'disconnected',
      allowedTools: ['search_repositories', 'get_file_contents', 'create_pull_request'],
    });
  }

  public addServer(server: MCPServerConfig) {
    this.servers.set(server.id, server);
    this.catalogCache.delete(server.id);
  }

  public removeServer(serverId: string) {
    this.servers.delete(serverId);
    this.catalogCache.delete(serverId);
  }

  public getAllServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  public getServer(serverId: string): MCPServerConfig | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Discovers and caches tool catalog for an MCP server, normalizing into Makkari ToolDefinitions
   */
  public async discoverServerTools(serverId: string, forceRefresh = false): Promise<MCPToolDefinition[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];

    const cached = this.catalogCache.get(serverId);
    const now = Date.now();

    if (!forceRefresh && cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.tools;
    }

    try {
      const disc = await mcpClient.discoverCapabilities(server);
      server.status = 'connected';
      server.lastDiscoveredAt = new Date().toISOString();
      server.errorMessage = undefined;

      this.catalogCache.set(serverId, {
        tools: disc.tools,
        timestamp: now,
      });

      // Register each MCP tool into Makkari Tool Registry
      for (const mcpTool of disc.tools) {
        const canonicalTool: ToolDefinition = {
          id: `mcp_${server.id}_${mcpTool.name}`,
          name: `${server.id}_${mcpTool.name}`,
          description: mcpTool.description,
          category: 'mcp',
          inputSchema: mcpTool.inputSchema,
          permissions: mcpTool.permission,
          requiresConfirmation: mcpTool.requiresConfirmation,
          enabled: true,
          source: 'mcp',
          handler: async (args) => {
            const rawRes = await mcpClient.callTool(server, mcpTool.name, args);
            return {
              success: true,
              result: rawRes,
              formattedOutput: typeof rawRes === 'object' ? JSON.stringify(rawRes, null, 2) : String(rawRes),
            };
          },
        };

        toolRegistry.registerTool(canonicalTool);
      }

      return disc.tools;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Discovery error';
      server.status = 'error';
      server.errorMessage = msg;
      return [];
    }
  }
}

export const mcpRegistry = MCPRegistry.getInstance();
