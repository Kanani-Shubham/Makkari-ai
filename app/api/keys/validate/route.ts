import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/adapter';
import { ProviderId } from '@/lib/ai/types';
import { encryptKey } from '@/lib/ai/encryption';

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey }: { provider: ProviderId; apiKey: string } = await req.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API Key are required' }, { status: 400 });
    }

    const adapter = getAIProvider(provider);
    const health = await adapter.healthCheck(apiKey);
    const isValid = health.status === 'connected';

    if (!isValid) {
      return NextResponse.json(
        { valid: false, message: health.message || `Failed to validate key with ${adapter.name}` },
        { status: 400 }
      );
    }

    const { ciphertext, iv, hint } = await encryptKey(apiKey);

    return NextResponse.json({
      valid: true,
      provider,
      keyHint: hint,
      ciphertext,
      iv,
      message: 'API Key successfully validated',
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Validation failed';
    return NextResponse.json({ valid: false, error: errMessage }, { status: 500 });
  }
}
