import { NextRequest } from 'next/server';

/**
 * Resolves the canonical base URL for Makkari AI across local and production environments.
 * 
 * In Local Development: http://localhost:3000
 * In Production: https://makkari-ai.vercel.app (or custom NEXT_PUBLIC_APP_URL)
 */
export function getAppBaseUrl(req?: NextRequest | Request): string {
  // 1. Explicit environment variable (Primary single source of truth)
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }

  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  }

  // 2. Vercel deployment environment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }

  // 3. Request origin / host inspection if request object is available
  if (req) {
    if ('nextUrl' in req && req.nextUrl?.origin) {
      return req.nextUrl.origin.replace(/\/+$/, '');
    }

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  // 4. Default fallback for local environment
  return 'http://localhost:3000';
}
