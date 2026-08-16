import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { createOAuthTransaction } from './oauth-transactions';
import { getAppBaseUrl } from './app-url';

export type CanvaAuthMode = 'cimd' | 'manual_registration' | 'dcr';

export interface CanvaMcpAuthUrlOptions {
  origin?: string;
  userId: string;
  serverId?: string;
}

/**
 * Resolves the Canva MCP Client Identity based on configured authentication strategy:
 * 1. ManualRegistration: If CANVA_MCP_CLIENT_ID / CANVA_MCP_CLIENT_SECRET are set in environment
 * 2. CIMD (Recommended): Uses the public HTTPS metadata document URL as client_id
 * 3. DCR (Fallback): Legacy dynamic registration fallback
 */
export async function getCanvaMcpClientIdentity(origin: string): Promise<{
  mode: CanvaAuthMode;
  clientId: string;
  clientSecret?: string;
}> {
  // 1. Manual Pre-Registered MCP Integration Credentials
  if (process.env.CANVA_MCP_CLIENT_ID && process.env.CANVA_MCP_CLIENT_ID.trim() !== '') {
    return {
      mode: 'manual_registration',
      clientId: process.env.CANVA_MCP_CLIENT_ID,
      clientSecret: process.env.CANVA_MCP_CLIENT_SECRET,
    };
  }

  // 2. Official Standard: CIMD (Client ID Metadata Document)
  const isCimdDisabled = process.env.DISABLE_CANVA_CIMD === 'true';
  if (!isCimdDisabled) {
    return {
      mode: 'cimd',
      clientId: `${origin}/.well-known/oauth-client-metadata.json`,
      clientSecret: undefined,
    };
  }

  // 3. Legacy DCR Fallback
  return {
    mode: 'dcr',
    clientId: 'makkari-ai-client',
    clientSecret: undefined,
  };
}

/**
 * Builds the official Canva MCP Authorization URL (https://mcp.canva.com/authorize)
 * using PKCE (RFC 7636) and server-side OAuth transactions.
 * 
 * Ref: https://www.canva.dev/docs/mcp/
 */
export async function buildCanvaMcpAuthUrl(options: CanvaMcpAuthUrlOptions): Promise<{
  authUrl: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  mode: CanvaAuthMode;
}> {
  const origin = options.origin || getAppBaseUrl();

  const redirectUri =
    process.env.CANVA_MCP_REDIRECT_URI ||
    process.env.CANVA_REDIRECT_URI ||
    `${origin}/api/mcp/canva/callback`;

  const { mode, clientId, clientSecret } = await getCanvaMcpClientIdentity(origin);

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store transaction strictly server-side with encrypted state token
  const state = await createOAuthTransaction({
    userId: options.userId,
    serverId: options.serverId || 'canva-mcp',
    codeVerifier,
    clientId,
    clientSecret,
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

  console.log('[CANVA_MCP] Starting OAuth');
  console.log('[CANVA_MCP] OAuth transaction created');
  console.log(`[CANVA_MCP] auth_mode="${mode}" client_id="${clientId.substring(0, 30)}..."`);
  console.log(`[CANVA_MCP] redirect_uri="${redirectUri}"`);
  console.log('[CANVA_MCP] Authorization started');

  return {
    authUrl: authUrl.toString(),
    state,
    codeVerifier,
    redirectUri,
    clientId,
    mode,
  };
}
