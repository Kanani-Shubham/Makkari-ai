import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mcpClientManager } from '@/lib/ai/mcp/client-manager';
import { saveUserMcpServer } from '@/lib/ai/mcp/storage';
import { MCPServerConfig } from '@/lib/ai/mcp/types';
import { getAndConsumeOAuthTransaction } from '@/lib/ai/mcp/oauth-transactions';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  console.log('[CANVA_OAUTH] Authorization callback received');

  if (error) {
    let errorMsg = errorDescription ? `${error}: ${errorDescription}` : error;
    if (errorMsg.toLowerCase().includes('allowed host') || errorMsg.toLowerCase().includes('invalid redirect uri')) {
      errorMsg = 'Canva authorization host pending approval: The production domain (makkari-ai.vercel.app) needs to be allowlisted in Canva MCP developer settings.';
    }
    console.error(`[CANVA_OAUTH] Authorization failed from provider: ${errorMsg}`);
    return NextResponse.redirect(
      new URL(`/settings?mcp=canva&status=error&error=${encodeURIComponent(errorMsg)}`, req.url)
    );
  }


  if (!code || !stateParam) {
    console.error('[CANVA_OAUTH] Missing authorization code or state parameter');
    return NextResponse.redirect(
      new URL('/settings?mcp=canva&status=error&error=missing_code_or_state', req.url)
    );
  }

  // 1. Retrieve and consume server-side OAuth transaction
  const transaction = await getAndConsumeOAuthTransaction(stateParam);

  if (!transaction) {
    console.error('[CANVA_OAUTH] Invalid or expired OAuth state');
    return NextResponse.redirect(
      new URL('/settings?mcp=canva&status=error&error=state_expired', req.url)
    );
  }

  const returnUrlBase = transaction.origin || 'http://localhost:3000';


  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify session user matches OAuth transaction initiator
    if (user && user.id !== transaction.userId) {
      console.error('[CANVA_OAUTH] User mismatch with OAuth transaction');
      return NextResponse.redirect(
        new URL('/settings?mcp=canva&status=error&error=user_mismatch', returnUrlBase)
      );
    }

    const targetUserId = user?.id || transaction.userId;
    console.log('[CANVA_OAUTH] OAuth transaction validated');

    const { clientId, clientSecret, redirectUri, codeVerifier, serverId } = transaction;

    let accessToken = code;

    // 2. Exchange authorization code + PKCE code_verifier for Canva MCP access token
    if (clientId) {
      const tokenBody: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
      };

      if (codeVerifier) {
        tokenBody.code_verifier = codeVerifier;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (clientSecret) {
        headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
      }

      console.log(
        `[CANVA_OAUTH] Token exchange: endpoint="https://mcp.canva.com/token" client_id_prefix="${clientId.substring(0, 4)}..." auth_method="${clientSecret ? 'client_secret_basic' : 'none_pkce'}"`
      );

      // Primary attempt: Official Canva MCP Token Endpoint
      let tokenRes = await fetch('https://mcp.canva.com/token', {
        method: 'POST',
        headers,
        body: new URLSearchParams(tokenBody),
      });

      // If Basic Auth failed or was rejected, retry as pure Public Client with PKCE (no client_secret)
      if (!tokenRes.ok && clientSecret) {
        console.warn('[CANVA_OAUTH] Retrying token exchange without client_secret (Public PKCE Client)');
        const publicHeaders: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
        tokenRes = await fetch('https://mcp.canva.com/token', {
          method: 'POST',
          headers: publicHeaders,
          body: new URLSearchParams(tokenBody),
        });
      }

      if (!tokenRes.ok) {
        // Fallback attempt: Connect API token endpoint
        tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
          method: 'POST',
          headers,
          body: new URLSearchParams(tokenBody),
        });
      }

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error(`[CANVA_OAUTH] Token exchange failed with status ${tokenRes.status}`);
        return NextResponse.redirect(
          new URL(
            `/settings?mcp=canva&status=error&error=${encodeURIComponent(
              'Token exchange failed: ' + errText
            )}`,
            returnUrlBase
          )
        );
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      console.log('[CANVA_OAUTH] Authorization code exchanged');
    }


    const canvaServer: MCPServerConfig = {
      id: serverId || 'canva-mcp',
      name: 'Canva MCP',
      url: process.env.CANVA_MCP_URL || 'https://mcp.canva.com/mcp',
      transport: 'streamable-http',
      apiKey: accessToken,
      status: 'connecting',
    };

    console.log('[CANVA_MCP] Initializing');

    // 3. Establish authenticated MCP connection over Streamable HTTP
    const discovery = await mcpClientManager.connect(canvaServer);

    console.log('[CANVA_MCP] MCP initialize successful');
    console.log('[CANVA_MCP] tools/list successful');
    console.log(`[CANVA_MCP] Discovered ${discovery.tools.length} tools`);

    // 4. Persist to encrypted database storage
    await saveUserMcpServer(supabase, targetUserId, canvaServer);

    console.log('[CANVA_MCP] Connection persisted');

    return NextResponse.redirect(
      new URL(
        `/settings?mcp=canva&status=connected&tools=${discovery.tools.length}`,
        returnUrlBase
      )
    );
  } catch (err: any) {
    console.error('[CANVA_MCP] Fatal connection error:', err?.message || err);
    return NextResponse.redirect(
      new URL(
        `/settings?mcp=canva&status=error&error=${encodeURIComponent(err.message || 'Connection failed')}`,
        returnUrlBase
      )
    );
  }
}

