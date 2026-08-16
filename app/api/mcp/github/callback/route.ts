import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mcpClientManager } from '@/lib/ai/mcp/client-manager';
import { saveUserMcpServer } from '@/lib/ai/mcp/storage';
import { MCPServerConfig } from '@/lib/ai/mcp/types';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('[MCP_AUTH_CALLBACK] GitHub callback received');

  if (error) {
    console.error(`[MCP_AUTH_FAILURE] Server="GitHub MCP" error="${error}"`);
    return NextResponse.redirect(
      new URL(`/settings?mcp=github&status=error&error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/settings?mcp=github&status=error&error=missing_code_or_state', req.url)
    );
  }

  try {
    const stateObj = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
    const { userId, serverId } = stateObj;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      console.error('[MCP_AUTH_FAILURE] User mismatch in OAuth state');
      return NextResponse.redirect(
        new URL('/settings?mcp=github&status=error&error=user_mismatch', req.url)
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    let accessToken = code;

    if (clientId && clientSecret) {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error(`[MCP_AUTH_FAILURE] GitHub token exchange failed:`, errText);
        return NextResponse.redirect(
          new URL(`/settings?mcp=github&status=error&error=token_exchange_failed`, req.url)
        );
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
    }

    console.log(`[MCP_AUTH_SUCCESS] Server="GitHub MCP" user="${user.id}" status=authenticated`);

    const githubServer: MCPServerConfig = {
      id: serverId || 'github-mcp',
      name: 'GitHub MCP',
      url: 'https://api.githubcopilot.com/mcp',
      transport: 'streamable-http',
      apiKey: accessToken,
      status: 'connecting',
    };

    const discovery = await mcpClientManager.connect(githubServer);
    await saveUserMcpServer(supabase, user.id, githubServer);

    console.log(
      `[MCP_CONNECTED] Server="GitHub MCP" user="${user.id}" toolsDiscovered=${discovery.tools.length}`
    );

    return NextResponse.redirect(
      new URL(
        `/settings?mcp=github&status=connected&tools=${discovery.tools.length}`,
        req.url
      )
    );
  } catch (err: any) {
    console.error('[MCP_AUTH_CALLBACK] Fatal error:', err);
    return NextResponse.redirect(
      new URL(`/settings?mcp=github&status=error&error=${encodeURIComponent(err.message)}`, req.url)
    );
  }
}
