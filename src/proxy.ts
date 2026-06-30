import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Module-scoped map to store rate-limit counters in memory
const ipRequests = new Map<string, { count: number; windowStart: number }>();

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // 1. Rate Limit Protection for Public APIs (/api/signals/*, /api/feed/*)
  if (pathname.startsWith('/api/signals') || pathname.startsWith('/api/feed')) {
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || '127.0.0.1');
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000; // 1-minute bucket

    const rateLimit = ipRequests.get(ip);
    if (rateLimit) {
      if (rateLimit.windowStart === windowStart) {
        rateLimit.count++;
        if (rateLimit.count > 100) {
          return new NextResponse(
            JSON.stringify({ success: false, error: 'Too Many Requests', request_id: 'rl_' + now }),
            { status: 429, headers: { 'content-type': 'application/json' } }
          );
        }
      } else {
        rateLimit.windowStart = windowStart;
        rateLimit.count = 1;
      }
    } else {
      ipRequests.set(ip, { count: 1, windowStart });
    }
  }

  // 2. Protect all API admin paths (/api/admin/*)
  if (pathname.startsWith('/api/admin')) {
    const adminSecret = request.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_SECRET || 'fallback_admin_secret_key';

    if (!adminSecret || adminSecret !== expectedSecret) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Unauthorized admin access', request_id: 'auth_' + Date.now() }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }
  }

  // 3. Protect all visual /admin page paths
  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !pathname.startsWith('/admin/login/api')) {
    const adminSecretCookie = request.cookies.get('admin_secret')?.value;
    const expectedSecret = process.env.ADMIN_SECRET || 'fallback_admin_secret_key';

    if (!adminSecretCookie || adminSecretCookie !== expectedSecret) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/signals/:path*',
    '/api/feed/:path*'
  ],
};
