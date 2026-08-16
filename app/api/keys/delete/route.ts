import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'Provider parameter is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log('[API_KEY_DELETE] User:', user?.id, 'Deleting provider:', provider);

    if (user) {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (error) {
        console.error('[API_KEY_DELETE] Supabase delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[API_KEY_DELETE] Successfully deleted provider key from Supabase DB:', provider);
    }

    return NextResponse.json({ success: true, provider });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API_KEY_DELETE] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
