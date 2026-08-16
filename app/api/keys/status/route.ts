import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProviderStatus } from '@/lib/services/provider-status';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Call service with user session (falls back to env keys if unauthenticated or missing DB key)
    const statusObj = await getProviderStatus(user?.id);

    return NextResponse.json({ success: true, providers: statusObj });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown status evaluation error';
    console.error('[API_KEYS_STATUS] Exception:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
