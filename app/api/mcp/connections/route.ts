import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserMcpServers } from '@/lib/ai/mcp/storage';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const servers = await getUserMcpServers(supabase, user?.id);

    return NextResponse.json({
      success: true,
      servers,
    });
  } catch (err: any) {
    console.error('[MCP_API_CONNECTIONS] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch MCP connections' },
      { status: 500 }
    );
  }
}
