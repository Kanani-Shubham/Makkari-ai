import { NextRequest, NextResponse } from 'next/server';

/**
 * Official Client ID Metadata Document (CIMD) for Makkari MCP Client
 * URL: https://makkari.ai/.well-known/oauth-client-metadata.json
 * Ref: https://www.canva.dev/docs/mcp/
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
  const baseUri = isLocal ? origin : 'https://makkari.ai';

  const metadata = {
    client_id: `${baseUri}/.well-known/oauth-client-metadata.json`,
    client_name: 'Makkari AI',
    client_uri: baseUri,
    logo_uri: `${baseUri}/icon.png`,
    redirect_uris: [
      `${baseUri}/api/mcp/canva/callback`,
      'http://localhost:3000/api/mcp/canva/callback',
    ],

    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'design:content:read design:content:write design:meta:read',
    token_endpoint_auth_method: 'none',
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
