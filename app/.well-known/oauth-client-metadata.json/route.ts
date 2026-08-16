import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/ai/mcp/app-url';

/**
 * Official Client ID Metadata Document (CIMD) for Canva MCP
 * Specification: RFC 7591 / Canva MCP OAuth
 * Ref: https://www.canva.dev/docs/mcp/
 */
export async function GET(req: NextRequest) {
  const baseUri = getAppBaseUrl(req);

  const metadata = {
    client_id: `${baseUri}/.well-known/oauth-client-metadata.json`,
    client_name: 'Makkari AI',
    client_uri: baseUri,
    logo_uri: `${baseUri}/icon.png`,
    redirect_uris: [
      `${baseUri}/api/mcp/canva/callback`,
      'https://makkari-ai.vercel.app/api/mcp/canva/callback',
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
