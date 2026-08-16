import { MCPServerConfig, MCPToolDefinition } from './types';
import { mcpClientManager } from './client-manager';
import { DEFAULT_SAMPLE_SERVERS } from './storage';

export class MCPRegistry {
  private static instance: MCPRegistry;
  private servers: Map<string, MCPServerConfig> = new Map();

  private constructor() {
    this.registerDefaultServers();
  }

  public static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  private registerDefaultServers() {
    for (const s of DEFAULT_SAMPLE_SERVERS) {
      this.servers.set(s.id, { ...s });
    }
  }

  public addServer(server: MCPServerConfig) {
    this.servers.set(server.id, server);
  }

  public removeServer(serverId: string) {
    const s = this.servers.get(serverId);
    if (s) {
      mcpClientManager.disconnect(s);
      this.servers.delete(serverId);
    }
  }

  public getAllServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  public getServer(serverId: string): MCPServerConfig | undefined {
    return this.servers.get(serverId);
  }

  public async discoverServerTools(
    serverId: string,
    forceRefresh = false
  ): Promise<MCPToolDefinition[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];

    try {
      const discovery = await mcpClientManager.connect(server);
      return discovery.tools;
    } catch {
      return server.toolCatalog || [];
    }
  }
}

export const mcpRegistry = MCPRegistry.getInstance();
