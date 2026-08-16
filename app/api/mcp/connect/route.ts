import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mcpClientManager } from '@/lib/ai/mcp/client-manager';
import { saveUserMcpServer, getUserMcpServers } from '@/lib/ai/mcp/storage';
import { MCPServerConfig, MCPConnectionStatus } from '@/lib/ai/mcp/types';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serverId, url, name, apiKey, authHeader, transport = 'streamable-http' } = body;

    if (!serverId && !url) {
      return NextResponse.json(
        { success: false, error: 'serverId or url is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch existing server config or construct new
    const existingServers = await getUserMcpServers(supabase, user?.id);
    let targetServer: MCPServerConfig = existingServers.find((s) => s.id === serverId) || {
      id: serverId || `mcp_${Date.now()}`,
      name: name || 'Custom MCP Server',
      url: url || '',
      transport: transport as any,
      apiKey,
      authHeader,
      status: 'connecting',
    };

    if (url) targetServer.url = url;
    if (name) targetServer.name = name;
    if (apiKey !== undefined) targetServer.apiKey = apiKey;
    if (authHeader !== undefined) targetServer.authHeader = authHeader;
    if (transport) targetServer.transport = transport;

    targetServer.status = 'connecting';


    try {
      const discovery = await mcpClientManager.connect(targetServer);

      if (user) {
        await saveUserMcpServer(supabase, user.id, targetServer);
      }

      return NextResponse.json({
        success: true,
        status: 'connected',
        server: targetServer,
        tools: discovery.tools,
      });
    } catch (connErr: any) {
      const isAuth =
        (targetServer.status as MCPConnectionStatus) === 'auth_required' ||
        connErr.message?.includes('AUTH_REQUIRED') ||
        connErr.message?.includes('401') ||
        connErr.message?.includes('Authentication required');


      if (isAuth) {
        targetServer.status = 'auth_required';
        targetServer.errorMessage =
          targetServer.errorMessage || `Authentication required for ${targetServer.name}.`;
      } else {
        targetServer.status = 'error';
        targetServer.errorMessage = connErr.message || 'Connection failed';
      }

      if (user) {
        await saveUserMcpServer(supabase, user.id, targetServer);
      }

      return NextResponse.json(
        {
          success: false,
          status: targetServer.status,
          error: targetServer.errorMessage,
          server: targetServer,
        },
        { status: isAuth ? 401 : 502 }
      );
    }

  } catch (err: any) {
    console.error('[MCP_CONNECT_API] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
