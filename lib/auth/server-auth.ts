import { SupabaseClient } from '@supabase/supabase-js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

/**
 * Fast, request-scoped server authentication helper
 * Resolves user identity using JWT claims first (avoiding remote network round-trip),
 * and falls back to getUser() only when full fresh user records are explicitly required.
 * Preserves strict RLS and zero token exposure.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseClient
): Promise<AuthenticatedUser | null> {
  const startTime = Date.now();

  try {
    // 1. Try local claims resolution first (Supabase getClaims / session validation)
    if (typeof (supabase.auth as any).getClaims === 'function') {
      const { data: claims, error: claimsErr } = await (supabase.auth as any).getClaims();
      if (!claimsErr && claims && (claims.sub || claims.id)) {
        const userId = String(claims.sub || claims.id);
        const duration = Date.now() - startTime;
        if (process.env.NODE_ENV === 'development' && duration > 50) {
          console.log(`[PERF][AUTH] Local claims resolved in ${duration}ms for ${userId}`);
        }
        return {
          id: userId,
          email: claims.email,
          role: claims.role,
          app_metadata: claims.app_metadata,
          user_metadata: claims.user_metadata,
        };
      }
    }

    // 2. Standard session check (reads local cookie without network call)
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (!sessionErr && sessionData?.session?.user) {
      const u = sessionData.session.user;
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV === 'development' && duration > 50) {
        console.log(`[PERF][AUTH] Session resolved in ${duration}ms for ${u.id}`);
      }
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
      };
    }

    // 3. Fallback to getUser() if session cookies require fresh validation
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (!userErr && userData?.user) {
      const u = userData.user;
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV === 'development' && duration > 50) {
        console.log(`[PERF][AUTH] Remote getUser() resolved in ${duration}ms for ${u.id}`);
      }
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
      };
    }

    return null;
  } catch (err) {
    console.error('[PERF][AUTH] Authentication resolution exception:', err);
    return null;
  }
}
