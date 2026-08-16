/**
 * AES-256-GCM Web Crypto Encryption Utility for BYOK API Keys.
 * Encrypts API keys before storing in Supabase database.
 */

const DEFAULT_SECRET = process.env.ENCRYPTION_SECRET || 'makkari_secure_32_byte_secret_key_2026';

async function getEncryptionKey(secret: string = DEFAULT_SECRET): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('makkari_salt_v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptKey(plainKey: string): Promise<{ ciphertext: string; iv: string; hint: string }> {
  const enc = new TextEncoder();
  const key = await getEncryptionKey();
  const ivArray = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    enc.encode(plainKey)
  );

  const ciphertext = Buffer.from(encryptedBuffer).toString('base64');
  const iv = Buffer.from(ivArray).toString('base64');
  const hint = plainKey.length >= 4 ? plainKey.slice(-4) : '****';

  return { ciphertext, iv, hint };
}

export async function decryptKey(ciphertext: string, ivBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
  const ivArray = Buffer.from(ivBase64, 'base64');

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    ciphertextBuffer
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
