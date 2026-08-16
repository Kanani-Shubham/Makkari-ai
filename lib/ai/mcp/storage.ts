import { MCPServerConfig } from './types';
import { encryptKey, decryptKey } from '../encryption';

export const DEFAULT_SAMPLE_SERVERS: MCPServerConfig[] = [
  {
    id: 'canva-mcp',
    name: 'Canva MCP',
    url: process.env.CANVA_MCP_URL || 'https://mcp.canva.com/mcp',
    transport: 'streamable-http',
    status: 'disconnected',
    toolCatalog: [],
  },


  {
    id: 'github-mcp',
    name: 'GitHub MCP',
    url: 'https://api.githubcopilot.com/mcp',
    transport: 'streamable-http',
    status: 'disconnected',
    toolCatalog: [],
  },
];

export async function getUserMcpServers(
  supabase: any,
  userId?: string
): Promise<MCPServerConfig[]> {
  if (!supabase || !userId) {
    return DEFAULT_SAMPLE_SERVERS;
  }

  try {
    const { data, error } = await supabase
      .from('user_mcp_servers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_SAMPLE_SERVERS;
    }

    const decryptedServers: MCPServerConfig[] = await Promise.all(
      data.map(async (row: any) => {
        let authHeader: string | undefined = undefined;
        let apiKey: string | undefined = undefined;

        if (row.encrypted_auth && row.iv) {
          try {
            const rawDecrypted = await decryptKey(row.encrypted_auth, row.iv);
            if (row.auth_type === 'bearer') {
              apiKey = rawDecrypted;
            } else {
              authHeader = rawDecrypted;
            }
          } catch (decErr) {
            console.warn(`[MCP_STORAGE] Failed to decrypt auth for server ${row.id}:`, decErr);
          }
        }

        return {
          id: row.id,
          name: row.name,
          url: row.url,
          transport: row.transport || 'streamable-http',
          authHeader,
          apiKey,
          status: row.status || 'disconnected',
          serverInfo: row.server_info || {},
          capabilities: row.capabilities || {},
          toolCatalog: row.tool_catalog || [],
          lastDiscoveredAt: row.last_discovered_at,
          lastConnectedAt: row.last_connected_at,
          errorMessage: row.last_error,
        };
      })
    );

    return decryptedServers;
  } catch (err) {
    console.error('[MCP_STORAGE] Error fetching user MCP servers:', err);
    return DEFAULT_SAMPLE_SERVERS;
  }
}

export async function saveUserMcpServer(
  supabase: any,
  userId: string,
  server: MCPServerConfig
): Promise<boolean> {
  if (!supabase || !userId) return false;

  try {
    let encrypted_auth: string | null = null;
    let iv: string | null = null;
    let auth_type = 'none';

    const secretToEncrypt = server.apiKey || server.authHeader;
    if (secretToEncrypt) {
      const enc = await encryptKey(secretToEncrypt);
      encrypted_auth = enc.ciphertext;
      iv = enc.iv;
      auth_type = server.apiKey ? 'bearer' : 'custom';
    }


    const payload = {
      id: server.id,
      user_id: userId,
      name: server.name,
      url: server.url,
      transport: server.transport || 'streamable-http',
      encrypted_auth,
      iv,
      auth_type,
      status: server.status,
      server_info: server.serverInfo || {},
      capabilities: server.capabilities || {},
      tool_catalog: server.toolCatalog || [],
      last_discovered_at: server.lastDiscoveredAt || null,
      last_connected_at: server.lastConnectedAt || null,
      last_error: server.errorMessage || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_mcp_servers')
      .upsert(payload, { onConflict: 'user_id,id' });

    if (error) {
      console.error(`[MCP_STORAGE_ERROR] Server="${server.name}" error="${error.message}" code="${error.code}"`);
      return false;
    }

    console.log(`[MCP_STORAGE_SUCCESS] Server="${server.name}" status="${server.status}" user="${userId}"`);
    return true;
  } catch (err) {
    console.error(`[MCP_STORAGE_ERROR] Unexpected error saving MCP server "${server.name}":`, err);
    return false;
  }

}

export async function deleteUserMcpServer(
  supabase: any,
  userId: string,
  serverId: string
): Promise<boolean> {
  if (!supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('user_mcp_servers')
      .delete()
      .eq('id', serverId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}
