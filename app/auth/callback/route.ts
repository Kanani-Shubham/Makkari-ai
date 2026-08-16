import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function getSafeRedirectUrl(nextParam: string | null, origin: string): string {
  if (!nextParam) return `${origin}/`;
  // Must be a relative path starting with a single '/'
  if (nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('\\') && !nextParam.includes(':')) {
    return `${origin}${nextParam}`;
  }
  return `${origin}/`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const targetUrl = getSafeRedirectUrl(next, origin);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Bootstrap user profile if not present
      try {
        const user = data.user;
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Makkari User';
        const username =
          user.user_metadata?.user_name ||
          user.email?.split('@')[0] ||
          `user_${user.id.slice(0, 6)}`;
        const avatarUrl =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          '';

        await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email: user.email || '',
              full_name: fullName,
              username: username,
              avatar_url: avatarUrl,
              theme: 'system',
              preferred_model_id: 'gemini-2.0-flash',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );

        // Also ensure user_memory_settings exists
        await supabase
          .from('user_memory_settings')
          .upsert(
            {
              user_id: user.id,
              personalization_enabled: true,
              memory_enabled: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id', ignoreDuplicates: true }
          );
      } catch (profileErr) {
        console.error('[AUTH_CALLBACK] Profile bootstrap warning:', profileErr);
      }

      return NextResponse.redirect(targetUrl);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
