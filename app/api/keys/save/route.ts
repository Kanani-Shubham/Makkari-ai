import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptKey } from '@/lib/ai/encryption';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, apiKey } = body;

    console.log('[API_KEY_SAVE] Save request for provider:', provider);

    if (!provider || !apiKey) {
      console.error('[API_KEY_SAVE] Error: Missing provider or apiKey');
      return NextResponse.json({ success: false, error: 'Provider and API Key are required' }, { status: 400 });
    }

    // 1. Authenticate User
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.warn('[API_KEY_SAVE] Auth session warning:', authError.message);
    }

    const userId = user?.id;

    if (!userId) {
      console.error('[API_KEY_SAVE] Error: User session required to persist API key in database.');
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication session required. Please sign in to save API keys to database.',
        },
        { status: 401 }
      );
    }

    console.log('[API_KEY_SAVE] Authenticated User ID:', userId);

    // 2. Encrypt API Key using Web Crypto AES-256-GCM
    const { ciphertext, iv, hint } = await encryptKey(apiKey);
    console.log('[API_KEY_SAVE] Encrypted successfully. Hint:', hint);

    // 3. Robust Schema-Safe Upsert into Supabase user_api_keys table
    const payload: Record<string, unknown> = {
      user_id: userId,
      provider,
      encrypted_key: ciphertext,
      iv,
      key_hint: hint,
      is_valid: true,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('user_api_keys')
      .upsert(payload, { onConflict: 'user_id,provider' })
      .select();

    // Fallback attempt if table schema has status column enabled
    if (error && error.message.includes('column')) {
      console.warn('[API_KEY_SAVE] Retrying with status column...');
      payload.status = 'active';
      const retryResult = await supabase
        .from('user_api_keys')
        .upsert(payload, { onConflict: 'user_id,provider' })
        .select();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('[API_KEY_SAVE] Supabase DB Insert/Update failure:', error);
      return NextResponse.json(
        {
          success: false,
          error: `Database save failed: ${error.message}`,
          details: error,
        },
        { status: 500 }
      );
    }

    console.log('[API_KEY_SAVE] Database upsert success for provider:', provider, 'user:', userId);

    return NextResponse.json({
      success: true,
      valid: true,
      provider,
      keyHint: hint,
      persistedToDb: true,
      data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown exception occurred during API key encryption and save.';
    console.error('[API_KEY_SAVE] Unhandled exception:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
