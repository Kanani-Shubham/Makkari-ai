import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { createOAuthTransaction } from './oauth-transactions';
import { getAppBaseUrl } from './app-url';

export interface CanvaMcpAuthUrlOptions {
  origin?: string;
  userId: string;
  serverId?: string;
}

/**
 * Builds the official Canva MCP Authorization URL (https://mcp.canva.com/authorize)
 * using CIMD (Client ID Metadata Document) and PKCE (RFC 7636).
 * 
 * Ref: https://www.canva.dev/docs/mcp/
 */
export async function buildCanvaMcpAuthUrl(options: CanvaMcpAuthUrlOptions): Promise<{
  authUrl: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}> {
  const origin = options.origin || getAppBaseUrl();

  const redirectUri =
    process.env.CANVA_MCP_REDIRECT_URI ||
    process.env.CANVA_REDIRECT_URI ||
    `${origin}/api/mcp/canva/callback`;

  // CIMD: Client ID is the HTTPS URL of the metadata document
  const clientId =
    process.env.CANVA_MCP_CLIENT_ID ||
    `${origin}/.well-known/oauth-client-metadata.json`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store transaction strictly server-side with encrypted state token
  const state = await createOAuthTransaction({
    userId: options.userId,
    serverId: options.serverId || 'canva-mcp',
    codeVerifier,
    clientId,
    clientSecret: process.env.CANVA_MCP_CLIENT_SECRET,
    redirectUri,
    origin,
  });

  const authUrl = new URL('https://mcp.canva.com/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 's256');
  authUrl.searchParams.set('state', state);

  console.log('[CANVA_OAUTH] Starting authorization');
  console.log(`[CANVA_OAUTH] auth_method="CIMD" client_id_url="${clientId.substring(0, 30)}..."`);
  console.log(`[CANVA_OAUTH] redirect_uri="${redirectUri}"`);
  console.log('[CANVA_OAUTH] Authorization URL generated');

  return {
    authUrl: authUrl.toString(),
    state,
    codeVerifier,
    redirectUri,
    clientId,
  };
}
