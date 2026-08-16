import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[API_KEY_FETCH] No authenticated user found.');
      return NextResponse.json({ keys: [] });
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .select('provider, key_hint, is_valid, status, updated_at, last_used_at')
      .eq('user_id', user.id);

    if (error) {
      console.error('[API_KEY_FETCH] Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API_KEY_FETCH] Successfully loaded ${data.length} keys for user:`, user.id);

    const keysMap = data.map((item) => ({
      provider: item.provider,
      keyHint: item.key_hint,
      isValid: item.is_valid,
      status: item.status,
      updatedAt: item.updated_at,
      lastUsedAt: item.last_used_at,
    }));

    return NextResponse.json({ keys: keysMap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API_KEY_FETCH] Unhandled exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
