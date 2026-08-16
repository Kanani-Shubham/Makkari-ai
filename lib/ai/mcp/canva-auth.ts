import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { createOAuthTransaction } from './oauth-transactions';

/**
 * In-memory / cache storage for Canva Dynamic Client Registration (DCR) credentials.
 */
let cachedMcpClient: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  registeredAt: number;
} | null = null;

export interface CanvaMcpAuthUrlOptions {
  origin: string;
  userId: string;
  serverId?: string;
}

/**
 * Obtains or registers a Canva MCP client via Dynamic Client Registration (DCR).
 * Endpoint: POST https://mcp.canva.com/register
 */
export async function getOrRegisterCanvaMcpClient(redirectUri: string): Promise<{
  clientId: string;
  clientSecret?: string;
}> {
  // If explicitly configured in environment variables, use that
  if (process.env.CANVA_MCP_CLIENT_ID) {
    return {
      clientId: process.env.CANVA_MCP_CLIENT_ID,
      clientSecret: process.env.CANVA_MCP_CLIENT_SECRET,
    };
  }

  // If cached and matches redirectUri, reuse
  if (
    cachedMcpClient &&
    cachedMcpClient.redirectUri === redirectUri &&
    Date.now() - cachedMcpClient.registeredAt < 24 * 60 * 60 * 1000
  ) {
    return {
      clientId: cachedMcpClient.clientId,
      clientSecret: cachedMcpClient.clientSecret,
    };
  }

  console.log('[CANVA_MCP_DCR] Registering MCP client at https://mcp.canva.com/register');

  try {
    const res = await fetch('https://mcp.canva.com/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_name: 'Makkari AI',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.client_id) {
        console.log('[CANVA_MCP_DCR] Dynamic client registration succeeded');
        cachedMcpClient = {
          clientId: data.client_id,
          clientSecret: data.client_secret,
          redirectUri,
          registeredAt: Date.now(),
        };
        return {
          clientId: data.client_id,
          clientSecret: data.client_secret,
        };
      }
    } else {
      const errText = await res.text();
      console.warn(`[CANVA_MCP_DCR] Registration endpoint returned status ${res.status}:`, errText);
    }
  } catch (err: any) {
    console.warn('[CANVA_MCP_DCR] Registration failed:', err.message);
  }

  // Fallback to CIMD URL or default client ID
  return {
    clientId: process.env.CANVA_MCP_CLIENT_ID || 'makkari-ai-client',
    clientSecret: undefined,
  };
}


/**
 * Builds the official Canva MCP Authorization URL (https://mcp.canva.com/authorize)
 * using PKCE (RFC 7636) and a secure server-side OAuth transaction.
 */
export async function buildCanvaMcpAuthUrl(options: CanvaMcpAuthUrlOptions): Promise<{
  authUrl: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}> {
  const origin = options.origin || 'http://localhost:3000';

  const redirectUri =
    process.env.CANVA_MCP_REDIRECT_URI ||
    process.env.CANVA_REDIRECT_URI ||
    `${origin}/api/mcp/canva/callback`;

  const { clientId, clientSecret } = await getOrRegisterCanvaMcpClient(redirectUri);

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

  return {
    authUrl: authUrl.toString(),
    state,
    codeVerifier,
    redirectUri,
    clientId,
  };
}

