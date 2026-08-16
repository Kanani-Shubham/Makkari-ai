import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const metadata = {
    client_name: 'Makkari AI Platform',
    client_uri: origin,
    logo_uri: `${origin}/icon.png`,
    redirect_uris: [
      `${origin}/api/mcp/canva/callback`,
      `${origin}/api/mcp/callback`,
    ],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'design:content:read design:content:write design:meta:read',
    token_endpoint_auth_method: 'client_secret_basic',
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
