import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mcpClientManager } from '@/lib/ai/mcp/client-manager';
import { saveUserMcpServer, getUserMcpServers } from '@/lib/ai/mcp/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serverId } = body;

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'serverId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const existingServers = await getUserMcpServers(supabase, user?.id);
    const targetServer = existingServers.find((s) => s.id === serverId);

    if (!targetServer) {
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    try {
      const discovery = await mcpClientManager.connect(targetServer);

      if (user) {
        await saveUserMcpServer(supabase, user.id, targetServer);
      }

      return NextResponse.json({
        success: true,
        server: targetServer,
        tools: discovery.tools,
      });
    } catch (err: any) {
      targetServer.status = 'error';
      targetServer.errorMessage = err.message || 'Refresh failed';

      if (user) {
        await saveUserMcpServer(supabase, user.id, targetServer);
      }

      return NextResponse.json(
        { success: false, error: err.message, server: targetServer },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error('[MCP_REFRESH_API] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
