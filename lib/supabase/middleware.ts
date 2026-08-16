import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http') &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project')
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : 'https://makkari-demo.supabase.co';

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your-supabase-anon-key-here'
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : 'demo_anon_key';

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  // For API routes and static resources, bypass heavy remote auth checks in proxy/middleware
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return supabaseResponse;
  }

  let user = null;
  try {
    const authPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: any } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 1200)
    );
    const authRes = await Promise.race([authPromise, timeoutPromise]);
    user = authRes.data?.user || null;
  } catch {
    user = null;
  }

  const proxyDurationMs = Date.now() - startTime;
  if (process.env.NODE_ENV === 'development' && proxyDurationMs > 50) {
    console.log(`[PERF][PROXY] Path: ${pathname} took ${proxyDurationMs}ms`);
  }

  const publicRoutes = ['/login', '/signup', '/forgot-password', '/callback', '/auth/callback'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const isRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http') &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project') &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('makkari-demo');

  // If user is authenticated and visits an auth page (/login or /signup), redirect to Makkari Home (/)
  if (user && isPublicRoute && pathname !== '/callback' && pathname !== '/auth/callback') {
    const urlObj = request.nextUrl.clone();
    urlObj.pathname = '/';
    return NextResponse.redirect(urlObj);
  }

  // If user is NOT authenticated and visits a protected route, redirect to /login
  if (!user && !isPublicRoute && isRealSupabase) {
    const urlObj = request.nextUrl.clone();
    urlObj.pathname = '/login';
    return NextResponse.redirect(urlObj);
  }

  return supabaseResponse;
}
