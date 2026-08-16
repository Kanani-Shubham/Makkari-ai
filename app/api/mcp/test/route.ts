import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mcpClientManager } from '@/lib/ai/mcp/client-manager';
import { getUserMcpServers } from '@/lib/ai/mcp/storage';
import { MCPServerConfig } from '@/lib/ai/mcp/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serverId, url, name, apiKey, authHeader, transport = 'streamable-http' } = body;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const existingServers = await getUserMcpServers(supabase, user?.id);
    let targetServer = existingServers.find((s) => s.id === serverId);

    if (!targetServer) {
      targetServer = {
        id: serverId || 'temp-test',
        name: name || 'Test Server',
        url: url || '',
        transport: transport as any,
        apiKey,
        authHeader,
        status: 'connecting',
      };
    }

    const report = await mcpClientManager.testConnection(targetServer);

    return NextResponse.json({
      success: report.status === 'connected',
      report,
    });
  } catch (err: any) {
    console.error('[MCP_TEST_API] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Test failed' },
      { status: 500 }
    );
  }
}
