import crypto from 'crypto';

/**
 * Generates a high-entropy cryptographically random code_verifier for PKCE.
 * Compliant with RFC 7636 (43-128 characters, base64url encoded).
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Calculates the S256 code_challenge from a code_verifier.
 * code_challenge = BASE64URL( SHA256( ASCII(code_verifier) ) )
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
