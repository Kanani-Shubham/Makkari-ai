import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/ai/mcp/pkce';
import { buildCanvaMcpAuthUrl } from '@/lib/ai/mcp/canva-auth';
import { getAppBaseUrl } from '@/lib/ai/mcp/app-url';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serverId } = body;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const origin = getAppBaseUrl(req);

    const isCanva = serverId === 'canva-mcp' || serverId?.toLowerCase().includes('canva');
    const isGithub = serverId === 'github-mcp' || serverId?.toLowerCase().includes('github');

    // Generate high-entropy PKCE Code Verifier & Challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        serverId: isCanva ? 'canva-mcp' : serverId,
        codeVerifier,
        nonce: Math.random().toString(36).substring(2),
        timestamp: Date.now(),
      })
    ).toString('base64url');

    if (isCanva) {
      console.log('[CANVA_OAUTH] Starting authorization');
      const { authUrl } = await buildCanvaMcpAuthUrl({
        origin,
        userId: user.id,
        serverId: 'canva-mcp',
      });
      console.log('[CANVA_OAUTH] OAuth transaction created');
      console.log('[CANVA_OAUTH] PKCE generated');
      console.log('[CANVA_OAUTH] Authorization URL generated');

      return NextResponse.json({
        success: true,
        mode: 'oauth_redirect',
        authUrl,
      });
    }







    if (isGithub) {

      const clientId = process.env.GITHUB_CLIENT_ID;
      const redirectUri = `${origin}/api/mcp/github/callback`;

      console.log(`[MCP_AUTH_START] Server="GitHub MCP" user="${user.id}" redirectUri="${redirectUri}"`);

      if (clientId) {
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
          clientId
        )}&scope=repo%20read:user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

        console.log(`[MCP_AUTH_REDIRECT] Server="GitHub MCP" url="${githubAuthUrl}"`);
        return NextResponse.json({
          success: true,
          mode: 'oauth_redirect',
          authUrl: githubAuthUrl,
        });
      }

      return NextResponse.json({
        success: true,
        mode: 'manual_token',
        message:
          'GitHub MCP requires user authentication. Please enter your GitHub Personal Access Token (PAT) with repo scope.',
        helpUrl: 'https://github.com/settings/tokens',
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'manual_token',
      message: `Authentication required for ${serverId}. Please provide an API key or Bearer token.`,
    });
  } catch (err: any) {
    console.error('[MCP_AUTH_START] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to start authentication' },
      { status: 500 }
    );
  }
}
