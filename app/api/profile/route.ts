import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 1. GET /api/profile — Fetch current authenticated user's profile from Supabase
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ profile: null });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[PROFILE_GET] Supabase query error:', error);
      // Return basic user info fallback if profile row creation was delayed
      return NextResponse.json({
        profile: {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url || '',
          theme: 'light',
          preferred_model_id: 'gemini-1.5-flash',
        },
      });


    }

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PROFILE_GET] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 2. PATCH /api/profile — Update current user's profile in Supabase
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, username, avatar_url, theme, preferred_model_id } = body;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (username !== undefined) updatePayload.username = username;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;
    if (theme !== undefined) updatePayload.theme = theme;
    if (preferred_model_id !== undefined) updatePayload.preferred_model_id = preferred_model_id;

    console.log('[PROFILE_PATCH] Updating user profile:', user.id, updatePayload);

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[PROFILE_PATCH] Supabase profile update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PROFILE_PATCH] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
